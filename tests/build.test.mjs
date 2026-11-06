import { archivePath } from './archive-path.mjs';
import { posix, win32 } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
test('all distributions contain executable inline code, no build tokens or external runtime dependencies', async () => {
  for (const name of ['presentation-studio.html', 'presentation-studio-blank.html']) {
    const html = await read('dist/' + name);
    assert(!/\/\* @(?:STYLES|APPLICATION|ZIP_RUNTIME) \*\/|@PROJECT_CONFIG|<!-- @PRESENTATION_SLIDES -->/.test(html));
    assert(!/<script[^>]+src=|<link[^>]+rel=["']stylesheet/i.test(html));
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (match[1].includes('application/json')) JSON.parse(match[2]);
      else new vm.Script(match[2]);
    }
  }
});
test('build is reproducible', async () => {
  const before = await read('dist/presentation-studio.html');
  execFileSync(process.execPath, ['scripts/build.mjs']);
  assert.equal(await read('dist/presentation-studio.html'), before);
});
test('blank starter is neutral and has isolated identity and recovery baseline', async () => {
  const pack = JSON.parse(await read('templates/blank/presentation.json'));
  assert.equal(pack.schemaVersion, 2);
  assert.equal(pack.state.slides.length, 1);
  assert.equal(pack.state.sections.length, 1);
  assert.equal(pack.state.brand.family, 'generic');
  assert.equal(pack.state.origin, 'blank');
  assert(!JSON.stringify(pack).includes('legacy'));
  assert.equal(pack.state.startingState.slides[0].id, pack.state.slides[0].id);
  assert.notEqual(pack.meta.id, 'legacy-ai-26-4');
});
test('example project identities and references are consistent', async () => {
  for (const name of (await readdir(new URL('../examples', import.meta.url))).filter(x => x.endsWith('.json'))) {
    const pack = JSON.parse(await read('examples/' + name));
    const ids = pack.state.slides.map(s => s.id);
    assert.equal(ids.length, new Set(ids).size);
    for (const slide of pack.state.slides) assert(pack.state.sections.some(s => s.id === slide.group));
    for (const loop of Object.values(pack.state.loops)) for (const id of loop.slideIds) assert(ids.includes(id));
  }
});


test('generic distribution contains the Studio demo and no embedded vendor deck', async () => {
  const html = await read('dist/presentation-studio.html');
  const pack = JSON.parse(html.match(/<script id="project-config" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(pack.state.slides.length, 8);
  assert.equal(pack.state.sections.length, 3);
  assert.equal(pack.state.origin, 'studio');
  assert.equal(pack.state.brand.family, 'generic');
  assert.equal(pack.state.loops['studio-main'].slideIds.length, 7);

  assert(!html.includes('What is legacy Agentic Analyzer?'));
  assert(html.includes('studio-template-assets'));
});


test('built-in paired themes provide readable text contrast', async () => {
  const schemes = JSON.parse(await read('src/themes.json'));
  assert.equal(schemes.length, 6);
  const luminance = color => { const values = color.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4); return values[0]*.2126 + values[1]*.7152 + values[2]*.0722; };
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for (const scheme of schemes) for (const mode of ['light','dark']) {
    const p = scheme[mode];
    for (const value of Object.values(p)) assert(/^#[0-9a-f]{6}$/i.test(value));
    for (const [text,background] of [['ink','background'],['ink','surface'],['muted','background'],['muted','surface'],['accent','background'],['accentInk','accent']]) assert(contrast(p[text],p[background]) >= 4.5, scheme.name+' '+mode+' '+text+' on '+background);
  }
});

test('public distributions have no vendor content and retain only identifier-only import aliases',async()=>{
  const adapter=await read('src/runtime/compat.js');
  const aliases=[...adapter.matchAll(/const studioLegacy(?:Kind|Database) = '([^']+)'/g)].map(m=>m[1]);
  assert.equal(aliases.length,2);
  const terms=/(?:fortify|opentext|microfocus|aviator)/i;
  for(const file of ['presentation-studio.html','presentation-studio-blank.html']) {
    let html=await read('dist/'+file);
    for(const alias of aliases) html=html.replaceAll(alias,'LEGACY_IDENTIFIER');
    assert(!terms.test(html),file+' contains unexpected vendor material');
    assert(html.includes('MIT License'));assert(html.includes('Independent community project'));
    const pack=JSON.parse(html.match(/<script id="project-config" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(pack.kind,'presentation-studio-project');
  }
  assert.deepEqual((await readdir(new URL('../dist',import.meta.url))).filter(x=>x.endsWith('.html')).sort(),['presentation-studio-blank.html','presentation-studio.html']);
});


test('ZIP extraction paths stay inside their destination on Windows and POSIX', () => {
  for (const [paths, destination] of [[posix, '/tmp/project'], [win32, 'C:\\Users\\demo\\project']]) {
    for (const name of ['index.html', 'assets/logo.png', 'assets/deep/video.webm']) {
      assert.equal(archivePath(destination, name, paths), paths.resolve(destination, name));
    }
    for (const name of ['', '.', '..', '../outside.txt', '../project-other/file.txt', 'assets/../../outside.txt']) {
      assert.throws(() => archivePath(destination, name, paths), /escapes extraction/);
    }
  }
  for (const name of ['..\\outside.txt', 'D:\\elsewhere\\file.txt', 'C:\\Users\\demo\\project-other\\file.txt', '\\\\server\\share\\file.txt']) {
    assert.throws(() => archivePath('C:\\Users\\demo\\project', name, win32), /escapes extraction/);
  }
});
