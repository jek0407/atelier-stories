// Optional real-browser regression suite. See README for Playwright setup.
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'atelier-browser-'));
const app=await createApp({dataDir:dir,pythonBin:process.env.PYTHON_BIN||process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3'});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const base=`http://127.0.0.1:${app.server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.locator('.exhibition-hero').waitFor();assert.ok(await page.getByRole('heading',{name:/작은 마음/}).count());
  await mkdir(resolve('test-results'),{recursive:true});await page.screenshot({path:resolve('test-results/visitor-desktop.png'),fullPage:true});
  await page.goto(base+'/app');await page.getByLabel('이메일',{exact:true}).fill('browser@example.com');await page.getByLabel('비밀번호',{exact:true}).fill('browser-pass-1234');await page.getByRole('button',{name:'내 아틀리에 만들기 ↗',exact:true}).click();await page.locator('.editor-sidebar').waitFor();
  await page.getByRole('button',{name:'작품과 이야기',exact:true}).click();await page.locator('[data-upload-art]').setInputFiles(new URL('../public/assets/still-life.png',import.meta.url).pathname);
  await page.locator('dialog [data-key="title"]').fill('내 첫 작품');await page.locator('dialog [data-key="medium"]').fill('캔버스에 아크릴');await page.locator('dialog [data-done]').click();
  // Waiting for an autosave before opening a dialog verifies editor references remain valid.
  await page.locator('.save-status').filter({hasText:'모든 변경 사항 저장됨'}).waitFor();
  const work=page.locator('.editor-work').filter({hasText:'내 첫 작품'});await work.locator('[data-region]').click();await page.locator('[data-mode="polygon"]').click();const bounds=await page.locator('.selection-canvas').boundingBox();for(const[x,y]of [[.25,.55],[.47,.55],[.47,.8],[.25,.8]])await page.mouse.click(bounds.x+x*bounds.width,bounds.y+y*bounds.height);await page.locator('[data-finish]').click();await page.locator('[data-name]').fill('나의 실');await page.locator('[data-story]').fill('함께한 기억을 이어주는 실입니다.');await page.locator('[data-confirm]').click();await work.getByRole('button',{name:'나의 실 ↗',exact:true}).waitFor();
  await page.getByRole('button',{name:'언어와 번역',exact:true}).click();await page.locator('[data-bilingual]').uncheck();await page.getByRole('button',{name:'전시 공개',exact:true}).click();await page.locator('[data-publish]').click();await page.locator('[data-qr]').waitFor();const href=await page.getByRole('link',{name:'관람객 사이트 ↗'}).getAttribute('href');
  const visitor=await browser.newContext({viewport:{width:390,height:844}});const publicPage=await visitor.newPage();await publicPage.goto(base+href);await publicPage.getByRole('button',{name:'작품',exact:true}).click();await publicPage.locator('[data-work]').filter({hasText:'내 첫 작품'}).click();await publicPage.locator('.region-chips').getByRole('button',{name:'나의 실',exact:true}).click();await publicPage.locator('.story-panel').filter({hasText:'함께한 기억을 이어주는 실입니다.'}).waitFor();await publicPage.locator('[data-close]').click();assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile horizontal overflow');await publicPage.screenshot({path:resolve('test-results/visitor-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'나의 아틀리에',exact:true}).click();await page.screenshot({path:resolve('test-results/editor-desktop.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('Browser workflow passed: create → upload → region → publish → public story; desktop/mobile screenshots saved.');
}finally{if(browser)await browser.close();app.close();await rm(dir,{recursive:true,force:true});}
