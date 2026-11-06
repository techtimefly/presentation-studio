import './build.mjs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../', import.meta.url));
const sandbox = { setImmediate, clearImmediate, setTimeout, clearTimeout, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder };
vm.runInNewContext(await readFile(resolve(root, 'vendor/jszip-3.10.1.min.js'), 'utf8'), sandbox);
const zip = new sandbox.JSZip();
// Fixed timestamps make repeated packages reproducible.
for (const file of ['dist/presentation-studio.html', 'dist/presentation-studio-blank.html', 'README.md', 'LICENSE', 'assets/presentation-studio.svg', 'THIRD_PARTY_NOTICES.md', 'CONTRIBUTING.md', 'docs/architecture.md', 'docs/content-and-branding.md', 'docs/open-source-release.md', 'docs/roadmap.md', 'docs/troubleshooting.md', 'docs/images/studio-demo.png', 'docs/images/theme-gallery.png', 'docs/images/block-editing.png', 'docs/quick-start.md', 'docs/content-and-branding.md', 'examples/layout-sampler.json', 'examples/README.md', 'examples/sample-diagram.svg']) {
  zip.file(file.replace(/^dist\//, ''), new Uint8Array(await readFile(resolve(root, file))), { date: new Date('2026-01-01T00:00:00Z') });
}
for (const name of (await readdir(resolve(root, 'vendor/licenses'))).sort()) zip.file('vendor/licenses/' + name, new Uint8Array(await readFile(resolve(root, 'vendor/licenses', name))), { date: new Date('2026-01-01T00:00:00Z') });
const demo = JSON.parse(await readFile(resolve(root, 'templates/studio/presentation.json'), 'utf8'));
const demoZip = new sandbox.JSZip();
const demoFile = (name,data) => demoZip.file(name,data,{date:new Date("2026-01-01T00:00:00Z")});
demoFile('index.html', new Uint8Array(await readFile(resolve(root, 'dist/presentation-studio.html'))));
demoFile('presentation.json', JSON.stringify(demo,null,2));
demoFile('assets/studio-demo-workflow.svg', new Uint8Array(await readFile(resolve(root, 'examples/sample-diagram.svg'))));
demoFile('README.txt', 'Editable Studio demo. Unzip all files together, then open index.html. Import this ZIP through Presentations to edit it in another copy of the studio.');
const demoBytes = await demoZip.generateAsync({type:'uint8array',compression:'DEFLATE'});
zip.file('studio-demo-editable.zip',demoBytes,{date:new Date('2026-01-01T00:00:00Z')});
await mkdir(resolve(root, 'release'), {recursive:true});
await writeFile(resolve(root,'release/studio-demo-editable.zip'),demoBytes);
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await mkdir(resolve(root, 'release'), { recursive: true });
await writeFile(resolve(root, `release/presentation-studio-v${version}.zip`), await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
console.log(`Packaged release/presentation-studio-v${version}.zip`);
