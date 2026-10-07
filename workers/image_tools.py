"""JSON-line image worker. Color selection is not presented as an AI model."""
import sys, json, os, base64, io, traceback
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = 30_000_000
predictor = None
cached_path = None

def png_data(image):
    output = io.BytesIO()
    image.save(output, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode()

def simplify(points, epsilon=1.2):
    if len(points) <= 3: return points
    a, b = np.asarray(points[0], dtype=float), np.asarray(points[-1], dtype=float)
    v = b-a
    middle = np.asarray(points[1:-1], dtype=float)
    denom = float(np.dot(v,v))
    d = np.linalg.norm(middle-a, axis=1) if denom == 0 else np.linalg.norm(middle-(a+np.clip(((middle-a)@v)/denom,0,1)[:,None]*v),axis=1)
    idx = int(np.argmax(d)) + 1
    if float(d[idx-1]) <= epsilon: return [points[0],points[-1]]
    return simplify(points[:idx+1],epsilon)[:-1] + simplify(points[idx:],epsilon)

def contours(mask):
    # Trace boundary grid edges; opposite orientation preserves holes via even-odd fill.
    ys,xs = np.nonzero(mask)
    edges = {}
    h,w = mask.shape
    def add(a,b): edges.setdefault(a,[]).append(b)
    for y,x in zip(ys.tolist(),xs.tolist()):
        if y == 0 or not mask[y-1,x]: add((x,y),(x+1,y))
        if x == w-1 or not mask[y,x+1]: add((x+1,y),(x+1,y+1))
        if y == h-1 or not mask[y+1,x]: add((x+1,y+1),(x,y+1))
        if x == 0 or not mask[y,x-1]: add((x,y+1),(x,y))
    paths = []
    while edges and len(paths) < 80:
        first = next(iter(edges)); current=first; chain=[first]
        while current in edges:
            nxt=edges[current].pop()
            if not edges[current]: del edges[current]
            chain.append(nxt); current=nxt
            if current == first: break
        if len(chain) >= 5:
            chain=simplify(chain)
            if len(chain)>=4:
                paths.append([[round(x/w,5),round(y/h,5)] for x,y in chain[:-1]])
    return [p for p in paths if len(p)>=3]

def load_image(path):
    image=Image.open(path)
    image.load()
    return image.convert('RGB')

def sam_mask(path,image,points):
    global predictor,cached_path
    import torch
    if predictor is None:
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        predictor=SAM2ImagePredictor.from_pretrained(os.environ['SAM2_MODEL_ID'],device=os.getenv('SAM2_DEVICE','cpu'))
    with torch.inference_mode():
        if cached_path != path:
            predictor.set_image(np.asarray(image)); cached_path=path
        w,h=image.size
        coordinates=np.asarray([[p['x']*(w-1),p['y']*(h-1)] for p in points],dtype=np.float32)
        labels=np.asarray([p['label'] for p in points],dtype=np.int32)
        masks,scores,_=predictor.predict(point_coords=coordinates,point_labels=labels,multimask_output=True)
    order=np.argsort(scores)[::-1]
    return [(np.asarray(masks[i],dtype=bool),float(scores[i])) for i in order]

def color_mask(image,points,tolerance):
    array=np.asarray(image,dtype=float); h,w=array.shape[:2]
    result=np.zeros((h,w),dtype=bool)
    positive=[p for p in points if p['label']==1]
    negative=[p for p in points if p['label']==0]
    for pt in positive:
        x=min(w-1,int(pt['x']*w)); y=min(h-1,int(pt['y']*h))
        reference=np.median(array[max(0,y-1):y+2,max(0,x-1):x+2],axis=(0,1))
        candidate=np.linalg.norm(array-reference,axis=2) <= tolerance
        labelled,_=ndimage.label(candidate)
        label=labelled[y,x]
        if label: result |= labelled == label
    if negative:
        pos=np.ones((h,w),dtype=bool); neg=np.ones((h,w),dtype=bool)
        for pt in positive: pos[min(h-1,int(pt['y']*h)),min(w-1,int(pt['x']*w))]=False
        for pt in negative: neg[min(h-1,int(pt['y']*h)),min(w-1,int(pt['x']*w))]=False
        result &= ndimage.distance_transform_edt(pos) <= ndimage.distance_transform_edt(neg)
    return [(result,None)]

def process(request):
    op=request['op']
    if op=='inspect':
        image=Image.open(request['source'])
        if image.format not in ['JPEG','PNG','WEBP']: raise ValueError('PNG, JPEG, WebP 이미지를 사용해 주세요.')
        width,height=image.size
        if width<16 or height<16 or width*height>30_000_000: raise ValueError('이미지 크기를 확인해 주세요.')
        image.load(); image=ImageOps.exif_transpose(image)
        width,height=image.size
        image.thumbnail((2400,2400))
        image.convert('RGBA').save(request['output'],format='PNG',icc_profile=image.info.get('icc_profile'))
        return {'width':width,'height':height}
    if op=='segment':
        image=load_image(request['source']); image.thumbnail((512,512))
        algorithm=request.get('algorithm','color')
        masks=sam_mask(request['source'],image,request['points']) if algorithm=='sam2' else color_mask(image,request['points'],request.get('tolerance',48))
        candidates=[]
        for mask,score in masks:
            if int(mask.sum())<3: continue
            outline=contours(mask)
            if not outline: continue
            overlay=Image.new('RGBA',image.size,(153,190,162,0))
            overlay.putalpha(Image.fromarray((mask.astype(np.uint8)*115),'L'))
            candidates.append({'contours':outline,'overlay':png_data(overlay),'score':score})
        if not candidates: raise ValueError('선택된 영역이 없습니다. 위치나 허용 범위를 조정해 주세요.')
        return {'algorithm':algorithm,'candidates':candidates,'width':image.width,'height':image.height}
    if op=='cutout':
        image=Image.open(request['source']).convert('RGBA')
        mask=np.zeros((image.height,image.width),dtype=bool)
        for polygon in request['contours']:
            part=Image.new('1',image.size)
            ImageDraw.Draw(part).polygon([(round(x*image.width),round(y*image.height)) for x,y in polygon],fill=1)
            mask ^= np.asarray(part,dtype=bool)
        if not mask.any(): raise ValueError('누끼 영역이 비어 있습니다.')
        alpha=np.asarray(image.getchannel('A')).copy(); alpha[~mask]=0
        image.putalpha(Image.fromarray(alpha,'L')); box=image.getbbox()
        if not box: raise ValueError('선택한 영역에 보이는 픽셀이 없습니다.')
        image=image.crop(box); image.save(request['output'],format='PNG',icc_profile=image.info.get('icc_profile'))
        return {'width':image.width,'height':image.height}
    if op=='qr':
        from reportlab.graphics.barcode import qrencoder
        code=qrencoder.QRCode(None,qrencoder.QRErrorCorrectLevel.M)
        code.addData(request['text']); code.make(); n=code.getModuleCount()
        blocks=''.join(f'<rect x="{x+4}" y="{y+4}" width="1" height="1"/>' for y in range(n) for x in range(n) if code.isDark(y,x))
        return {'svg':f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n+8} {n+8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">{blocks}</g></svg>'}
    raise ValueError('지원하지 않는 작업입니다.')

for line in sys.stdin:
    try:
        request=json.loads(line)
        result=process(request)
        response={'id':request['id'],'result':result}
    except Exception as error:
        response={'id':locals().get('request',{}).get('id'),'error':str(error)}
    print(json.dumps(response,ensure_ascii=False),flush=True)
