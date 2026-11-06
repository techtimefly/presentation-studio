import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
test('Earlier browser recovery projects and assets copy atomically to neutral storage',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await mkdir(resolve('test-results'),{recursive:true});const seed=resolve('test-results/storage-seed.html');await writeFile(seed,'<!doctype html><title>Storage migration fixture</title>');await page.goto('file://'+seed);
  const adapter=await readFile('src/runtime/compat.js','utf8'),oldName=adapter.match(/studioLegacyDatabase = '([^']+)'/)[1],pack=JSON.parse(await readFile('templates/blank/presentation.json','utf8'));
  pack.meta.id='migration-example';pack.meta.name='Migration example';pack.kind=adapter.match(/studioLegacyKind = '([^']+)'/)[1];
  await page.evaluate(async({oldName,pack})=>{await new Promise((resolve,reject)=>{const r=indexedDB.open(oldName,1);r.onupgradeneeded=()=>{r.result.createObjectStore('projects');r.result.createObjectStore('assets');};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['projects','assets'],'readwrite');tx.objectStore('projects').put({pack,savedAt:'2026-01-01T00:00:00Z'},pack.meta.id);tx.objectStore('assets').put(new Blob(['sample image bytes'],{type:'image/png'}),pack.meta.id+'|assets/example.png');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},{oldName,pack});
  await page.goto('file://'+resolve('dist/presentation-studio.html'));
  await page.waitForFunction(()=>document.querySelector('#hub-presentations'));
  await page.waitForTimeout(500);
  const read=async name=>page.evaluate(async name=>{const r=indexedDB.open(name);const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{const tx=db.transaction(['projects','assets']);const request=r=>new Promise(resolve=>r.onsuccess=()=>resolve(r.result));const [project,blob]=await Promise.all([request(tx.objectStore('projects').get('migration-example')),request(tx.objectStore('assets').get('migration-example|assets/example.png'))]);return {name:project?.pack.meta.name,asset:blob?await blob.text():null};}finally{db.close();}},name);
  assert.deepEqual(await read('presentation-studio-editor-v1'),{name:'Migration example',asset:'sample image bytes'});
  assert.deepEqual(await read(oldName),{name:'Migration example',asset:'sample image bytes'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
