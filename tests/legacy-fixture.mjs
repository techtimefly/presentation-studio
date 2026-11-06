// Synthetic compatibility fixture: original identifiers, entirely neutral content.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function legacyHTML(root) {
  const pack=JSON.parse(await readFile(resolve(root,'templates/studio/presentation.json'),'utf8'));
  const adapter=await readFile(resolve(root,'src/runtime/compat.js'),'utf8');
  pack.kind=adapter.match(/studioLegacyKind = '([^']+)'/)[1];
  pack.meta.id='synthetic-legacy-project';pack.meta.name='Example Company workshop';
  pack.state.origin='legacy';pack.state.brand.family='legacy';
  pack.state.brand.headerTitle='EXAMPLE COMPANY';pack.state.brand.headerSubtitle='Independent workshop';
  delete pack.state.startingState;
  const question=pack.state.slides.find(s=>s.template==='qa');
  const section=pack.state.sections.find(s=>s.id===question.group);
  const old=section.id;section.id='qa';
  pack.state.slides.filter(s=>s.group===old).forEach(s=>s.group='qa');
  const second=structuredClone(question);second.id='synthetic-second-question';second.group='remqa';second.title='How do I prepare for a workshop?';
  pack.state.slides.push(second);pack.state.sections.push({id:'remqa',name:'Workshop questions',kind:'qa',product:'generic',hidden:false,headerLabel:'WORKSHOP'});
  const html=(await readFile(resolve(root,'dist/presentation-studio.html'),'utf8')).replace(/(<script id="project-config" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(pack).replace(/</g,'\\u003c')+b);
  const file=resolve(root,'test-results/synthetic-legacy.html');await mkdir(resolve(root,'test-results'),{recursive:true});await writeFile(file,html);return file;
}
