export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new AppError(status, message);
}
export function validateProject(project) {
  requireValue(project && typeof project === 'object' && !Array.isArray(project), '전시 데이터가 올바르지 않습니다.');
  requireValue(project.schemaVersion === 1, '지원하지 않는 데이터 버전입니다.');
  requireValue(['ko','en'].includes(project.sourceLanguage), '원문 언어를 확인해 주세요.');
  requireValue(Array.isArray(project.languages) && project.languages.length > 0 && project.languages.length <= 2 && new Set(project.languages).size === project.languages.length && project.languages.every(l => ['ko','en'].includes(l)) && project.languages.includes(project.sourceLanguage), '지원 언어를 확인해 주세요.');
  requireValue(project.artist && project.exhibition && project.theme, '작가·전시·디자인 정보가 필요합니다.');
  function localized(value){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&['ko','en'].every(l=>typeof value[l]==='string'),'다국어 입력 형식을 확인해 주세요.');}
  for(const key of ['name','bio','statement','cv'])localized(project.artist[key]);
  for(const key of ['title','subtitle','description','gallery','address','closed','parking','events','admission'])localized(project.exhibition[key]);
  for(const value of [project.artist.instagram,project.artist.email,project.exhibition.hours,project.exhibition.sns])requireValue(typeof value==='string','입력 형식을 확인해 주세요.');
  requireValue(typeof project.translationReviewed==='boolean','번역 검토 상태를 확인해 주세요.');
  requireValue(Array.isArray(project.artworks) && project.artworks.length <= 100, '작품은 최대 100개까지 등록할 수 있습니다.');
  requireValue(Array.isArray(project.symbols) && project.symbols.length <= 300, '상징은 최대 300개까지 등록할 수 있습니다.');
  const idOk = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
  const symbols = new Set(), artworks = new Set();
  for (const s of project.symbols) { requireValue(s&&idOk(s.id) && !symbols.has(s.id), '상징 ID가 올바르지 않습니다.'); localized(s.name);localized(s.story);symbols.add(s.id); }
  for (const a of project.artworks) {
    requireValue(a&&idOk(a.id) && !artworks.has(a.id) && idOk(a.imageId), '작품 정보가 올바르지 않습니다.'); artworks.add(a.id);
    for(const key of ['title','medium','description'])localized(a[key]);requireValue(typeof a.date==='string','제작 날짜를 확인해 주세요.');
    requireValue(Number.isFinite(Number(a.width)) && Number(a.width) >= 0 && Number(a.width) <= 10000 && Number.isFinite(Number(a.height)) && Number(a.height) >= 0 && Number(a.height) <= 10000, '작품 크기를 확인해 주세요.');
    requireValue(Array.isArray(a.hotspots) && a.hotspots.length <= 100, '상징 영역을 확인해 주세요.');
    const hotIds = new Set();
    for (const hotspot of a.hotspots) {
      requireValue(hotspot&&idOk(hotspot.id) && !hotIds.has(hotspot.id), '영역 ID가 올바르지 않습니다.'); hotIds.add(hotspot.id);
      requireValue(symbols.has(hotspot.symbolId), '연결된 상징을 찾을 수 없습니다.');
      localized(hotspot.story);
      validateContours(hotspot.contours);
    }
  }
  const t = project.theme;
  requireValue(['dots','none','lines'].includes(t.pattern) && ['none','float','sway'].includes(t.motion) && ['serif','sans'].includes(t.font) && ['storybook','gallery','archive'].includes(t.template), '디자인 설정이 올바르지 않습니다.');
  for (const k of ['background','accent','patternColor']) requireValue(/^#[a-f0-9]{6}$/i.test(t[k]), '색상 형식을 확인해 주세요.');
  for (const [k,min,max] of [['patternSize',1,20],['patternSpacing',15,100],['patternOpacity',0,70]]) requireValue(Number.isFinite(t[k]) && t[k] >= min && t[k] <= max, '패턴 설정을 확인해 주세요.');
  requireValue(idOk(t.heroImage), '대표 이미지가 올바르지 않습니다.');
  const menus = ['home','info','cv','statement','paintings','symbolism'];
  requireValue(Array.isArray(project.menu) && new Set(project.menu).size === project.menu.length && project.menu.length <= 6 && project.menu.includes('home') && project.menu.every(m => menus.includes(m)), '메뉴를 확인해 주세요.');
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const validDate=value=>date.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  requireValue(validDate(project.exhibition.startDate) && validDate(project.exhibition.endDate) && project.exhibition.startDate <= project.exhibition.endDate, '전시 기간을 확인해 주세요.');
  for (const url of [project.artist.instagram, project.exhibition.sns]) if (url) {
    try { requireValue(['https:','http:'].includes(new URL(url).protocol), '링크는 http 또는 https 주소여야 합니다.'); } catch { throw new AppError(400, '링크 주소를 확인해 주세요.'); }
  }
  function visit(value, depth = 0) {
    requireValue(depth < 14, '데이터 구조가 너무 깊습니다.');
    if (typeof value === 'string') requireValue(value.length <= 20000, '입력 내용이 너무 깁니다.');
    else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
      requireValue(!['__proto__','prototype','constructor'].includes(key), '지원하지 않는 필드입니다.'); visit(v, depth + 1);
    }
  }
  visit(project);
  return project;
}
export function validateContours(contours) {
  requireValue(Array.isArray(contours) && contours.length > 0 && contours.length <= 80, '선택 영역이 필요합니다.');
  let points = 0;
  for (const polygon of contours) {
    requireValue(Array.isArray(polygon) && polygon.length >= 3, '영역은 최소 3개 점이 필요합니다.'); points += polygon.length;
    for (const pt of polygon) requireValue(Array.isArray(pt) && pt.length === 2 && pt.every(v => Number.isFinite(v) && v >= 0 && v <= 1), '영역 좌표를 확인해 주세요.');
  }
  requireValue(points <= 16000, '선택 영역이 너무 복잡합니다.');
}
export function assetIds(project) {
  return new Set([project.theme.heroImage, ...project.artworks.map(a => a.imageId)]);
}
export function publishCheck(project) {
  validateProject(project);
  for (const lang of project.languages) {
    for (const value of [project.artist.name, project.exhibition.title, project.exhibition.gallery, project.exhibition.address]) requireValue(typeof value?.[lang] === 'string' && value[lang].trim(), `${lang.toUpperCase()} 작가명·전시명·갤러리·주소를 입력해 주세요.`);
    for (const a of project.artworks) requireValue(a.title?.[lang]?.trim(), `${lang.toUpperCase()} 작품명을 입력해 주세요.`);
  }
  function complete(value){if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&typeof value[project.sourceLanguage]==='string'){if(value[project.sourceLanguage].trim())for(const lang of project.languages)requireValue(value[lang]?.trim(),`${lang.toUpperCase()}에 비어 있는 번역이 있습니다. 언어와 번역에서 채워주세요.`);return;}for(const v of Object.values(value))complete(v);}
  complete(project);
  requireValue(project.languages.length === 1 || project.translationReviewed === true, '번역을 확인한 뒤 공개해 주세요.');
}
