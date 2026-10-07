import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { resolve, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from './seed.js';
import { AppError, requireValue, validateProject, assetIds, publishCheck, validateContours } from './validation.js';
import { imageWorker } from './image-worker.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const deriveKey=promisify(scrypt);
const sessionTTL=7*24*60*60*1000;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const demoFiles={'demo-still-life':'still-life.png','demo-night':'night.png','demo-together':'together.png','demo-characters':'characters.png'};
const tokenHash=value=>createHash('sha256').update(value).digest('hex');
const safeSlug=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{2,60}$/.test(value);

export async function createApp(options={}) {
  const dataDir=resolve(options.dataDir||process.env.DATA_DIR||join(root,'data'));
  await mkdir(join(dataDir,'uploads'),{recursive:true});
  const db=new DatabaseSync(join(dataDir,'atelier.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sites(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),slug TEXT UNIQUE NOT NULL,draft TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,published TEXT,published_version INTEGER,published_at TEXT,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS versions(id INTEGER PRIMARY KEY AUTOINCREMENT,site_id TEXT NOT NULL REFERENCES sites(id),content TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),original TEXT,filename TEXT,created_at TEXT NOT NULL);
  `);
  const worker=options.worker||imageWorker(options.pythonBin||process.env.PYTHON_BIN||'python3');
  const now=()=>new Date().toISOString();
  const limits=new Map();
  const fetchImpl=options.fetchImpl||fetch;
  const deeplKey=options.deeplKey??process.env.DEEPL_API_KEY??'';

  function user(req) {
    const match=/(?:^|;\s*)atelier_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
    if(!match)return null;
    return db.prepare('SELECT users.id, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(tokenHash(match[1]),Date.now());
  }
  function authenticated(req){const owner=user(req);requireValue(owner,'로그인해 주세요.',401);return owner;}
  function ownedSite(id,owner){const site=db.prepare('SELECT * FROM sites WHERE id=? AND owner_id=?').get(id,owner.id);requireValue(site,'전시를 찾을 수 없습니다.',404);return site;}
  function cookie(res,token,maxAge=sessionTTL/1000){res.setHeader('Set-Cookie',`atelier_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'?'; Secure':''}`);}
  function rateLimit(req,key,max=20,window=60000){
    const name=`${req.socket.remoteAddress}:${key}`;const entry=limits.get(name)||{count:0,time:Date.now()};
    if(Date.now()-entry.time>window){entry.count=0;entry.time=Date.now();}entry.count++;limits.set(name,entry);
    requireValue(entry.count<=max,'요청이 많습니다. 잠시 후 다시 시도해 주세요.',429);
    if(limits.size>10000){for(const[k,v]of limits)if(Date.now()-v.time>window)limits.delete(k);}
  }
  async function bytes(req,max=2*1024*1024){
    if(Number(req.headers['content-length']||0)>max)throw new AppError(413,'파일 또는 입력 내용이 너무 큽니다.');
    const chunks=[];let length=0;
    for await(const chunk of req){length+=chunk.length;if(length>max)throw new AppError(413,'파일 또는 입력 내용이 너무 큽니다.');chunks.push(chunk);}
    return Buffer.concat(chunks);
  }
  async function body(req){try{const value=JSON.parse((await bytes(req)).toString());requireValue(value&&typeof value==='object'&&!Array.isArray(value),'JSON 객체가 필요합니다.');return value;}catch(e){if(e instanceof AppError)throw e;throw new AppError(400,'JSON 형식이 올바르지 않습니다.');}}
  function response(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
  function sameOrigin(req){
    if(req.headers['sec-fetch-site']==='cross-site')throw new AppError(403,'다른 사이트의 요청은 허용되지 않습니다.');
    if(req.headers.origin){
      const configured=options.origin||process.env.APP_ORIGIN;
      const expected=configured?new URL(configured).host:req.headers.host;
      let origin;try{origin=new URL(req.headers.origin);}catch{throw new AppError(403,'요청 출처가 올바르지 않습니다.');}
      requireValue(origin.host===expected&&(!configured||origin.origin===new URL(configured).origin),'요청 출처가 올바르지 않습니다.',403);
    }
  }
  async function imageSource(id,owner){
    if(demoFiles[id])return join(root,'public/assets',demoFiles[id]);
    const asset=db.prepare('SELECT * FROM assets WHERE id=? AND owner_id=?').get(id,owner.id);
    requireValue(asset,'이미지를 찾을 수 없습니다.',404);return join(dataDir,'uploads',`${id}.png`);
  }
  function assertAssets(project,owner){
    for(const id of assetIds(project))if(!demoFiles[id])requireValue(db.prepare('SELECT id FROM assets WHERE id=? AND owner_id=?').get(id,owner.id),'다른 계정의 이미지 또는 없는 이미지를 사용할 수 없습니다.',403);
  }
  function publicAsset(id){
    const sites=db.prepare('SELECT published FROM sites WHERE published IS NOT NULL').all();
    return sites.some(s=>assetIds(JSON.parse(s.published)).has(id));
  }
  function listing(owner){return db.prepare('SELECT id,slug,version,published_version,published_at,updated_at,draft FROM sites WHERE owner_id=? ORDER BY updated_at DESC').all(owner.id).map(s=>({...s,draft:JSON.parse(s.draft)}));}
  function sitePayload(s){return{id:s.id,slug:s.slug,version:s.version,publishedVersion:s.published_version,publishedAt:s.published_at,project:JSON.parse(s.draft)};}

  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      let url;try{url=new URL(req.url,'http://localhost');}catch{throw new AppError(400,'주소를 확인해 주세요.');}
      let path;try{path=decodeURIComponent(url.pathname);}catch{throw new AppError(400,'주소를 확인해 주세요.');}const method=req.method;
      if(['POST','PUT','DELETE','PATCH'].includes(method))sameOrigin(req);
      if(path==='/api/health'&&method==='GET')return response(res,200,{ok:true,segmentation:process.env.SAM2_MODEL_ID?'sam2':'color',translation:!!deeplKey});
      if(path==='/api/demo'&&method==='GET')return response(res,200,{project:createProject()});
      if(['/api/auth/register','/api/auth/login'].includes(path)&&method==='POST') {
        rateLimit(req,'auth',10);
        const input=await body(req);const email=String(input.email||'').trim().toLowerCase(),password=String(input.password||'');
        requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254,'이메일 주소를 확인해 주세요.');
        requireValue(password.length>=10&&password.length<=200,'비밀번호는 10자 이상 200자 이하로 입력해 주세요.');
        let owner;
        if(path.endsWith('register')) {
          requireValue(!db.prepare('SELECT id FROM users WHERE email=?').get(email),'이미 등록된 이메일입니다.',409);
          const salt=randomBytes(16).toString('hex');const hash=(await deriveKey(password,salt,64)).toString('hex');owner={id:randomUUID(),email};
          db.exec('BEGIN IMMEDIATE');
          try {
            db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(owner.id,email,`${salt}:${hash}`,now());
            const id=randomUUID(),slug=`garden-${randomBytes(4).toString('hex')}`;
            db.prepare('INSERT INTO sites(id,owner_id,slug,draft,updated_at) VALUES(?,?,?,?,?)').run(id,owner.id,slug,JSON.stringify(createProject()),now());db.exec('COMMIT');
          }catch(error){db.exec('ROLLBACK');if(db.prepare('SELECT id FROM users WHERE email=?').get(email))throw new AppError(409,'이미 등록된 이메일입니다.');throw error;}
        } else {
          const record=db.prepare('SELECT * FROM users WHERE email=?').get(email);
          const[salt,stored]=(record?.password||'00000000000000000000000000000000:'+'0'.repeat(128)).split(':');
          const actual=await deriveKey(password,salt,64);
          requireValue(record&&timingSafeEqual(actual,Buffer.from(stored,'hex')),'이메일 또는 비밀번호가 일치하지 않습니다.',401);owner={id:record.id,email:record.email};
        }
        const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),owner.id,Date.now()+sessionTTL);cookie(res,token);
        return response(res,200,{user:owner,sites:listing(owner)});
      }
      if(path==='/api/auth/me'&&method==='GET'){const owner=user(req);return response(res,200,{user:owner,sites:owner?listing(owner):[]});}
      if(path==='/api/auth/logout'&&method==='POST'){const match=/atelier_session=([a-f0-9]{64})/.exec(req.headers.cookie||'');if(match)db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(match[1]));cookie(res,'',0);return response(res,200,{ok:true});}
      if(path==='/api/sites'&&method==='POST'){
        const owner=authenticated(req),id=randomUUID(),slug=`garden-${randomBytes(4).toString('hex')}`;rateLimit(req,'new-site',5);
        db.prepare('INSERT INTO sites(id,owner_id,slug,draft,updated_at) VALUES(?,?,?,?,?)').run(id,owner.id,slug,JSON.stringify(createProject()),now());return response(res,201,sitePayload(ownedSite(id,owner)));
      }
      const siteMatch=/^\/api\/sites\/([a-f0-9-]+)(?:\/(publish|history|restore|export))?$/.exec(path);
      if(siteMatch){
        const owner=authenticated(req),action=siteMatch[2];let site=ownedSite(siteMatch[1],owner);
        if(!action&&method==='GET')return response(res,200,sitePayload(site));
        if(!action&&method==='PUT'){
          const input=await body(req);site=ownedSite(siteMatch[1],owner);validateProject(input.project);assertAssets(input.project,owner);
          requireValue(input.version===site.version,'다른 화면에서 수정되었습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.',409);
          requireValue(safeSlug(input.slug),'주소는 영문 소문자·숫자·하이픈으로 3~61자까지 사용할 수 있습니다.');
          requireValue(!site.published||input.slug===site.slug,'공개한 주소는 QR 링크를 보존하기 위해 변경할 수 없습니다.');
          const used=db.prepare('SELECT id FROM sites WHERE slug=? AND id<>?').get(input.slug,site.id);requireValue(!used,'이미 사용 중인 전시 주소입니다.',409);
          const previous=JSON.parse(site.draft);
          if(sourceChanged(previous,input.project)&&foreignUnchanged(previous,input.project))input.project.translationReviewed=false;
          const result=db.prepare('UPDATE sites SET draft=?,slug=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(JSON.stringify(input.project),input.slug,now(),site.id,input.version);
          requireValue(result.changes===1,'저장 충돌이 발생했습니다. 새로고침해 주세요.',409);
          return response(res,200,sitePayload(ownedSite(site.id,owner)));
        }
        if(action==='publish'&&method==='POST'){
          const input=await body(req);site=ownedSite(siteMatch[1],owner);requireValue(input.version===site.version,'최신 내용을 저장한 뒤 공개해 주세요.',409);const project=JSON.parse(site.draft);publishCheck(project);assertAssets(project,owner);
          db.exec('BEGIN IMMEDIATE');
          try{db.prepare('INSERT INTO versions(site_id,content,created_at) VALUES(?,?,?)').run(site.id,site.draft,now());db.prepare('UPDATE sites SET published=draft,published_version=version,published_at=? WHERE id=?').run(now(),site.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
          return response(res,200,{...sitePayload(ownedSite(site.id,owner)),url:`/e/${site.slug}`});
        }
        if(action==='history'&&method==='GET')return response(res,200,{versions:db.prepare('SELECT id,created_at FROM versions WHERE site_id=? ORDER BY id DESC LIMIT 30').all(site.id)});
        if(action==='restore'&&method==='POST'){
          const input=await body(req);site=ownedSite(siteMatch[1],owner);requireValue(input.version===site.version,'최신 내용을 불러온 뒤 복원해 주세요.',409);
          const version=db.prepare('SELECT * FROM versions WHERE id=? AND site_id=?').get(input.versionId,site.id);requireValue(version,'공개 기록을 찾을 수 없습니다.',404);
          db.prepare('UPDATE sites SET draft=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(version.content,now(),site.id,site.version);return response(res,200,sitePayload(ownedSite(site.id,owner)));
        }
        if(action==='export'&&method==='GET'){res.setHeader('Content-Disposition','attachment; filename="exhibition.json"');return response(res,200,{schemaVersion:1,project:JSON.parse(site.draft)});}
        throw new AppError(405,'지원하지 않는 요청입니다.');
      }
      const publicMatch=/^\/api\/public\/([a-z0-9-]+)$/.exec(path);
      if(publicMatch&&method==='GET'){
        const site=db.prepare('SELECT slug,published,published_at FROM sites WHERE slug=? AND published IS NOT NULL').get(publicMatch[1]);requireValue(site,'공개된 전시를 찾을 수 없습니다.',404);
        return response(res,200,{slug:site.slug,project:JSON.parse(site.published),publishedAt:site.published_at});
      }
      if(path==='/api/assets'&&method==='POST'){
        const owner=authenticated(req);rateLimit(req,'upload',20);requireValue(['image/png','image/jpeg','image/webp'].includes((req.headers['content-type']||'').split(';')[0]),'PNG·JPEG·WebP 파일을 선택해 주세요.');
        const data=await bytes(req,20*1024*1024);requireValue(data.length>0,'빈 파일입니다.');const id=randomUUID(),original=join(dataDir,'uploads',`${id}.source`),output=join(dataDir,'uploads',`${id}.png`);
        await writeFile(original,data);
        try{const dimensions=await worker.run({op:'inspect',source:original,output});db.prepare('INSERT INTO assets VALUES(?,?,?,?,?)').run(id,owner.id,`${id}.source`,String(req.headers['x-file-name']||'artwork').slice(0,200),now());return response(res,201,{id,url:`/media/${id}`,...dimensions});}
        catch(error){await unlink(original).catch(()=>{});await unlink(output).catch(()=>{});throw error;}
      }
      const originalMatch=/^\/api\/assets\/([a-f0-9-]+)\/original$/.exec(path);
      if(originalMatch&&method==='GET'){
        const owner=authenticated(req),asset=db.prepare('SELECT * FROM assets WHERE id=? AND owner_id=?').get(originalMatch[1],owner.id);requireValue(asset?.original,'원본을 찾을 수 없습니다.',404);
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="original-artwork"','Cache-Control':'private, no-store'});return res.end(await readFile(join(dataDir,'uploads',asset.original)));
      }
      if(path==='/api/segment'&&method==='POST'){
        const owner=authenticated(req);rateLimit(req,'segment',50);const input=await body(req),source=await imageSource(input.imageId,owner);
        requireValue(Array.isArray(input.points)&&input.points.length>0&&input.points.length<=100&&input.points.some(p=>p.label===1)&&input.points.every(p=>[p.x,p.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&[0,1].includes(p.label)),'선택 위치를 확인해 주세요.');
        const algorithm=input.algorithm==='sam2'?'sam2':'color';requireValue(algorithm!=='sam2'||process.env.SAM2_MODEL_ID,'SAM 2 모델을 설정한 뒤 정밀 선택을 사용할 수 있습니다.',503);
        return response(res,200,await worker.run({op:'segment',source,points:input.points,algorithm,tolerance:Math.min(160,Math.max(10,Number(input.tolerance)||48))}));
      }
      if(path==='/api/cutouts'&&method==='POST'){
        const owner=authenticated(req);rateLimit(req,'cutout',20);const input=await body(req);validateContours(input.contours);const source=await imageSource(input.imageId,owner),id=randomUUID(),output=join(dataDir,'uploads',`${id}.png`);
        const dimensions=await worker.run({op:'cutout',source,output,contours:input.contours});db.prepare('INSERT INTO assets VALUES(?,?,?,?,?)').run(id,owner.id,null,'cutout.png',now());return response(res,201,{id,url:`/media/${id}`,...dimensions});
      }
      if(path==='/api/translate'&&method==='POST'){
        authenticated(req);rateLimit(req,'translate',10);requireValue(deeplKey,'자동 번역 연결이 필요합니다. 직접 번역을 입력하거나 README의 DeepL 설정을 진행해 주세요.',503);
        const input=await body(req);requireValue(['ko','en'].includes(input.source)&&['ko','en'].includes(input.target)&&input.source!==input.target,'번역 언어를 확인해 주세요.');
        requireValue(Array.isArray(input.texts)&&input.texts.length>0&&input.texts.length<=50&&input.texts.every(t=>typeof t.key==='string'&&typeof t.text==='string')&&input.texts.reduce((sum,t)=>sum+t.text.length,0)<=30000,'번역할 내용을 확인해 주세요.');
        const endpoint=deeplKey.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate';
        const result=await fetchImpl(endpoint,{method:'POST',headers:{Authorization:`DeepL-Auth-Key ${deeplKey}`,'Content-Type':'application/json'},body:JSON.stringify({text:input.texts.map(t=>t.text),source_lang:input.source.toUpperCase(),target_lang:input.target.toUpperCase(),context:String(input.context||'Artist exhibition descriptions and artwork symbolism.').slice(0,2000)}),signal:AbortSignal.timeout(30000)});
        if(!result.ok)throw new AppError(502,'번역 서비스가 응답하지 않았습니다. API 설정과 사용량을 확인해 주세요.');
        const translated=await result.json();requireValue(Array.isArray(translated.translations)&&translated.translations.length===input.texts.length,'번역 결과가 올바르지 않습니다.',502);
        return response(res,200,{translations:input.texts.map((t,i)=>({key:t.key,text:translated.translations[i].text}))});
      }
      if(path==='/api/qr'&&method==='POST'){
        authenticated(req);const input=await body(req);requireValue(typeof input.url==='string'&&input.url.length<=1000&&/^https?:\/\//.test(input.url),'공유 주소를 확인해 주세요.');return response(res,200,await worker.run({op:'qr',text:input.url}));
      }
      if(path.startsWith('/api/'))throw new AppError(404,'요청한 기능을 찾을 수 없습니다.');
      if(path.startsWith('/media/')){
        const id=path.slice(7);requireValue(/^[a-f0-9-]{36}$/.test(id),'이미지를 찾을 수 없습니다.',404);const asset=db.prepare('SELECT * FROM assets WHERE id=?').get(id);requireValue(asset,'이미지를 찾을 수 없습니다.',404);
        const owner=user(req);requireValue(owner?.id===asset.owner_id||publicAsset(id),'이미지를 찾을 수 없습니다.',404);
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':owner?.id===asset.owner_id?'private, no-store':'public, max-age=3600'});return res.end(await readFile(join(dataDir,'uploads',`${id}.png`)));
      }
      if(!['GET','HEAD'].includes(method))throw new AppError(405,'지원하지 않는 요청입니다.');
      const filename=path==='/'||path==='/app'||path.startsWith('/e/')?'/index.html':path;
      const file=resolve(root,'public','.'+filename);requireValue(file.startsWith(join(root,'public')+sep),'파일을 찾을 수 없습니다.',404);
      let data;try{data=await readFile(file);}catch{throw new AppError(404,'페이지를 찾을 수 없습니다.');}
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':filename==='/index.html'?'no-cache':'public, max-age=300'});res.end(method==='HEAD'?undefined:data);
    } catch(error) {
      if(res.headersSent){res.destroy();return;}
      const status=error instanceof AppError?error.status:500;
      if(status===500)console.error('Request failed:',error.message);
      response(res,status,{error:status===500?'요청을 처리하지 못했습니다. 다시 시도해 주세요.':error.message});
    }
  });
  return {server,db,close(){worker.close();server.close();db.close();}};
}

function languageStrings(value,language,out=[]) {
  if(!value||typeof value!=='object')return out;
  if(!Array.isArray(value)&&typeof value[language]==='string'){out.push(value[language]);return out;}
  for(const v of Object.values(value))languageStrings(v,language,out);return out;
}
function sourceChanged(a,b){return JSON.stringify(languageStrings(a,b.sourceLanguage))!==JSON.stringify(languageStrings(b,b.sourceLanguage));}
function foreignUnchanged(a,b){const other=b.sourceLanguage==='ko'?'en':'ko';return JSON.stringify(languageStrings(a,other))===JSON.stringify(languageStrings(b,other));}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.loadEnvFile(join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const app=await createApp();const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>console.log(`Atelier Stories · http://${host}:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{app.close();process.exit(0);});
}
