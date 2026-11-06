// Canvas-local media focus. The same media element moves in and out, preserving
// video position, controls, and loaded resources. No camera permission is needed.
let mfState = null;
function mfDefaults(raw = {}) {
  return { enabled: raw.enabled !== false, animation: ['expand','fade','none'].includes(raw.animation) ? raw.animation : 'expand', captions: raw.captions !== false, zoom: raw.zoom !== false };
}
const mfNxSettings = nxSettings;
nxSettings = function(raw = {}) { return { ...mfNxSettings(raw), mediaFocus: mfDefaults(raw.mediaFocus) }; };
function mfSettings() { return mfDefaults(projectState?.presentation?.mediaFocus); }
function mfHost(figure) {
  const preview = figure.closest('#fe-preview .me-preview-stage');
  if (preview) return vbMode === 'preview' ? preview : null;
  return figure.closest('#stage');
}
function mfAllowed(figure) {
  const host = mfHost(figure),slide = figure.closest('.slide');
  return !!host && !!slide && slide.classList.contains('active') && mfSettings().enabled && !figure.classList.contains('is-missing') && !host.inert;
}
function mfDecorate(slide) {
  const figure = slide.querySelector(':scope > .media-box'); if (!figure) return;
  figure.querySelector('.mf-expand')?.remove();
  if (!mfSettings().enabled) { figure.classList.remove('mf-can-focus'); return; }
  const button = document.createElement('button'); button.className = 'mf-expand'; button.type = 'button'; button.textContent = 'Expand'; button.title = 'Expand media to focus'; button.setAttribute('aria-label','Expand media to focus');
  figure.append(button); figure.classList.add('mf-can-focus');
}
const mfApply = mediaApply;
mediaApply = function(slide) { if (mfState?.slide === slide) mfAbort(); mfApply(slide); mfDecorate(slide); };
const mfMediaPlay = mediaPlayCurrent;
mediaPlayCurrent = function() { if (mfState) return; mfMediaPlay(); };
const mfHold = mediaHoldSlide;
mediaHoldSlide = function() { return !!mfState || mfHold(); };
function mfMove(parent,node,before=null) {
  if (typeof parent.moveBefore === 'function') { try { parent.moveBefore(node,before); return; } catch {} }
  parent.insertBefore(node,before);
}
function mfRect(element,host) {
  const r = element.getBoundingClientRect(),h = host.getBoundingClientRect();
  return {left:(r.left-h.left)*host.clientWidth/h.width,top:(r.top-h.top)*host.clientHeight/h.height,width:r.width*host.clientWidth/h.width,height:r.height*host.clientHeight/h.height};
}
function mfFrame(rect) { return Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,value+'px'])); }
function mfPlace(state,rect) { Object.assign(state.figure.style,mfFrame(rect)); }
function mfCancelAnimations(state) { for (const a of state.animations) a.cancel(); state.animations=[]; }
function mfAnimate(state,from,to,opening) {
  const settings = state.settings,disabled = nxMotionDisabled() || settings.animation === 'none';
  const opacity = Number(getComputedStyle(state.backdrop).opacity) || 0;
  mfPlace(state,to);
  if (disabled) { state.backdrop.style.opacity = opening ? '1' : '0'; return Promise.resolve(); }
  const duration = nxSpeeds[nxSettings(projectState.presentation).speed],options = {duration,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'};
  if (settings.animation === 'expand') state.animations.push(state.figure.animate([mfFrame(from),mfFrame(to)],options));
  else state.animations.push(state.figure.animate([{opacity:opening?0:1},{opacity:opening?1:0}],options));
  state.animations.push(state.backdrop.animate([{opacity},{opacity:opening?1:0}],options));
  return Promise.all(state.animations.map(a=>a.finished.catch(()=>{})));
}
function mfInert(state) {
  const record = element => { state.inert.push([element,element.inert]); element.inert = true; };
  for (const child of state.host.children) if (child !== state.layer) record(child);
  let current = state.host;
  const stop = state.preview ? $('full-editor') : document.body;
  while (current && current !== stop) {
    const parent = current.parentElement; if (!parent) break;
    for (const sibling of parent.children) if (sibling !== current && !['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) record(sibling);
    current = parent;
  }
}
function mfSeekIfReset(asset,time) {
  if (asset.tagName === 'VIDEO' && time > 0 && asset.currentTime + .05 < time) { try { asset.currentTime = time; } catch {} }
}
function mfPlay(asset) { const play = asset.play(); if (play) play.catch(()=>{}); }
function mfZoomReady(state) { return state.asset.tagName === 'IMG' && state.settings.zoom && state.asset.naturalWidth > 0 && state.phase === 'open'; }
function mfBound(state) {
  const viewport=state.asset.parentElement,w=viewport.clientWidth,h=viewport.clientHeight;
  const fit=Math.min(w/state.asset.naturalWidth,h/state.asset.naturalHeight);
  const maxX=Math.max(0,(state.asset.naturalWidth*fit*state.zoom-w)/2),maxY=Math.max(0,(state.asset.naturalHeight*fit*state.zoom-h)/2);
  state.x=Math.max(-maxX,Math.min(maxX,state.x));state.y=Math.max(-maxY,Math.min(maxY,state.y));
}
function mfZoomPaint(state) {
  if (state.asset.tagName !== 'IMG') return;
  mfBound(state);state.asset.style.transform='translate('+state.x+'px,'+state.y+'px) scale('+state.zoom+')';
  state.asset.style.cursor=state.zoom>1?'grab':'zoom-in';state.layer.querySelector('#mf-zoom-readout').textContent=Math.round(state.zoom*100)+'%';
  state.layer.querySelector('#mf-zoom-out').disabled=!mfZoomReady(state)||state.zoom<=1;state.layer.querySelector('#mf-zoom-in').disabled=!mfZoomReady(state)||state.zoom>=6;state.layer.querySelector('#mf-fit').disabled=!mfZoomReady(state);
}
function mfZoom(state,value,point=null) {
  if (!mfZoomReady(state)) return;
  const next=Math.max(1,Math.min(6,value)),ratio=next/state.zoom;
  if (point) { const r=state.asset.parentElement.getBoundingClientRect(),w=state.asset.parentElement.clientWidth,h=state.asset.parentElement.clientHeight;const px=(point.x-r.left)*w/r.width-w/2,py=(point.y-r.top)*h/r.height-h/2;state.x=px-(px-state.x)*ratio;state.y=py-(py-state.y)*ratio; }
  else {state.x*=ratio;state.y*=ratio;}
  state.zoom=next;if(next===1){state.x=0;state.y=0;}mfZoomPaint(state);
}
function mfRefreshSize() {
  const state=mfState;if(!state)return;
  if(state.phase==='open'){mfPlace(state,mfRect(state.target,state.host));mfZoomPaint(state);}
}
function mfBuild(state) {
  const layer=document.createElement('div');layer.id='media-focus';layer.className='mf-layer';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','Media focus');layer.setAttribute('aria-describedby','mf-focus-status');
  const backdrop=document.createElement('div');backdrop.className='mf-backdrop';backdrop.style.opacity='0';backdrop.setAttribute('aria-hidden','true');
  const toolbar=document.createElement('div');toolbar.className='mf-topbar';const title=document.createElement('div');title.className='mf-title';const strong=document.createElement('strong');strong.textContent=projectModel(state.slide.dataset.mediaId)?.title||state.slide.dataset.title||'Media focus';const note=document.createElement('span');note.id='mf-focus-status';note.textContent='Media focus · slide advancement paused';title.append(strong,note);
  const controls=document.createElement('div');controls.className='mf-controls';controls.setAttribute('role','toolbar');controls.setAttribute('aria-label','Media focus controls');
  const zoom=document.createElement('div');zoom.className='mf-zoom-controls';
  const button=(id,text,label)=>{const b=document.createElement('button');b.type='button';b.id=id;b.textContent=text;b.setAttribute('aria-label',label||text);return b;};
  const out=button('mf-zoom-out','−','Zoom out'),readout=document.createElement('output'),inside=button('mf-zoom-in','+','Zoom in'),fit=button('mf-fit','Fit','Fit image');readout.id='mf-zoom-readout';readout.textContent='100%';zoom.append(out,readout,inside,fit);
  zoom.hidden=state.asset.tagName!=='IMG'||!state.settings.zoom;out.disabled=inside.disabled=fit.disabled=true;
  const captions=button('mf-captions','Caption','Show caption');captions.setAttribute('aria-pressed',state.settings.captions);captions.hidden=!state.figure.querySelector('figcaption');
  const close=button('mf-close','Return to slide (Esc)','Return to slide');controls.append(zoom,captions,close);toolbar.append(title,controls);
  const target=document.createElement('div');target.className='mf-target';target.setAttribute('aria-hidden','true');layer.append(backdrop,toolbar,target);state.host.append(layer);
  Object.assign(state,{layer,backdrop,target});
  close.onclick=()=>mfClose();backdrop.onclick=()=>mfClose();captions.onclick=()=>{const show=state.figure.classList.contains('mf-hide-caption');state.figure.classList.toggle('mf-hide-caption',!show);captions.setAttribute('aria-pressed',show);mfZoomPaint(state);};
  inside.onclick=()=>mfZoom(state,state.zoom*1.25);out.onclick=()=>mfZoom(state,state.zoom/1.25);fit.onclick=()=>mfZoom(state,1);
  const viewport=state.asset.parentElement;
  viewport.addEventListener('wheel',state.wheel=e=>{if(!mfZoomReady(state))return;e.preventDefault();mfZoom(state,state.zoom*(e.deltaY<0?1.15:1/1.15),{x:e.clientX,y:e.clientY});},{passive:false});
  viewport.addEventListener('dblclick',state.double=e=>{if(!mfZoomReady(state))return;e.preventDefault();mfZoom(state,state.zoom===1?2:1,{x:e.clientX,y:e.clientY});});
  viewport.addEventListener('pointerdown',state.down=e=>{if(!mfZoomReady(state)||state.zoom<=1||e.button!==0)return;e.preventDefault();state.drag={id:e.pointerId,x:e.clientX,y:e.clientY,oldX:state.x,oldY:state.y};try{viewport.setPointerCapture(e.pointerId);}catch{}state.asset.style.cursor='grabbing';});
  viewport.addEventListener('pointermove',state.move=e=>{if(!state.drag||state.drag.id!==e.pointerId)return;const r=viewport.getBoundingClientRect();state.x=state.drag.oldX+(e.clientX-state.drag.x)*viewport.clientWidth/r.width;state.y=state.drag.oldY+(e.clientY-state.drag.y)*viewport.clientHeight/r.height;mfZoomPaint(state);state.asset.style.cursor='grabbing';});
  viewport.addEventListener('pointerup',state.up=e=>{if(!state.drag||state.drag.id!==e.pointerId)return;state.drag=null;try{viewport.releasePointerCapture(e.pointerId);}catch{}mfZoomPaint(state);});
  viewport.addEventListener('pointercancel',state.up);
  state.asset.addEventListener('load',state.loaded=()=>{if(mfState===state)mfZoomPaint(state);});
  return layer;
}
function mfOpen(figure,trigger) {
  if(mfState||!mfAllowed(figure))return;
  const host=mfHost(figure),asset=figure.querySelector('video.media-asset,img.media-asset');if(!asset)return;
  nxCancelTransition();hubMenusClose();
  const placeholder=document.createElement('div');placeholder.className=figure.className+' mf-placeholder';placeholder.style.cssText=figure.style.cssText;placeholder.setAttribute('aria-hidden','true');placeholder.inert=true;figure.before(placeholder);
  const state={figure,asset,slide:figure.closest('.slide'),host,preview:host.matches('.me-preview-stage'),placeholder,settings:mfSettings(),playing,elapsed,phase:'opening',animations:[],inert:[],zoom:1,x:0,y:0,returnFocus:trigger||figure.querySelector('.mf-expand'),figureClass:figure.className,figureStyle:figure.getAttribute('style'),assetStyle:asset.getAttribute('style'),controls:asset.controls,loading:asset.getAttribute('loading'),time:asset.currentTime||0,wasVideoPlaying:asset.tagName==='VIDEO'&&!asset.paused&&!asset.ended};
  for(const key of ['--media-fit','--media-pos','--media-overlay'])state[key]=getComputedStyle(figure).getPropertyValue(key);
  const origin=mfRect(figure,host);mfState=state;document.body.classList.add('mf-active');setPlaying(false);
  mfBuild(state);mfInert(state);
  mfMove(state.layer,figure);figure.classList.add('mf-focused');figure.classList.toggle('mf-hide-caption',!state.settings.captions);
  for(const key of ['--media-fit','--media-pos','--media-overlay'])figure.style.setProperty(key,state[key]);
  mfPlace(state,origin);if(asset.tagName==='VIDEO'){asset.controls=true;mfSeekIfReset(asset,state.time);if(state.wasVideoPlaying)mfPlay(asset);}else asset.loading='eager';
  const target=mfRect(state.target,host);state.layer.querySelector('#mf-close').focus({preventScroll:true});
  mfAnimate(state,origin,target,true).then(()=>{if(mfState!==state||state.phase!=='opening')return;mfCancelAnimations(state);mfPlace(state,target);state.backdrop.style.opacity='1';state.phase='open';mfZoomPaint(state);});
}
function mfRestore(state,{resumeVideo=true,advance=true}={}) {
  if(mfState!==state)return;
  const video=state.asset.tagName==='VIDEO',time=video?state.asset.currentTime:0,continueVideo=video&&!state.asset.paused&&!state.asset.ended,ended=video&&state.asset.ended;
  mfCancelAnimations(state);
  const viewport=state.asset.parentElement;for(const[type,handler]of [['wheel',state.wheel],['dblclick',state.double],['pointerdown',state.down],['pointermove',state.move],['pointerup',state.up],['pointercancel',state.up]])viewport.removeEventListener(type,handler);state.asset.removeEventListener('load',state.loaded);
  if(state.placeholder.isConnected){mfMove(state.placeholder.parentElement,state.figure,state.placeholder);state.placeholder.remove();}
  state.figure.className=state.figureClass;if(state.figureStyle===null)state.figure.removeAttribute('style');else state.figure.setAttribute('style',state.figureStyle);
  if(state.assetStyle===null)state.asset.removeAttribute('style');else state.asset.setAttribute('style',state.assetStyle);
  if(state.loading===null)state.asset.removeAttribute('loading');else state.asset.setAttribute('loading',state.loading);
  if(video){state.asset.controls=state.controls;mfSeekIfReset(state.asset,time);}
  state.layer.remove();for(const[element,inert]of state.inert)if(element.isConnected)element.inert=inert;
  document.body.classList.remove('mf-active');elapsed=state.elapsed;last=performance.now();setPlaying(state.playing);mfState=null;
  if(video){if(resumeVideo&&continueVideo)mfPlay(state.asset);else state.asset.pause();}
  if(state.returnFocus?.isConnected&&!state.returnFocus.closest('[inert]'))state.returnFocus.focus({preventScroll:true});
  activity();
  if(advance&&!state.preview&&ended&&state.playing&&mediaGetAssignment(state.slide.dataset.mediaId)?.advance==='ended')requestAnimationFrame(()=>{if(!mfState&&slides[index]===state.slide&&playing)show(index+1);});
}
function mfClose() {
  const state=mfState;if(!state)return Promise.resolve();if(state.phase==='closing')return state.closing;
  const current=mfRect(state.figure,state.host),opacity=getComputedStyle(state.backdrop).opacity;mfCancelAnimations(state);state.backdrop.style.opacity=opacity;mfPlace(state,current);state.phase='closing';
  const target=state.placeholder.isConnected?mfRect(state.placeholder,state.host):current;
  if(state.asset.tagName==='IMG'&&!nxMotionDisabled()&&state.settings.animation!=='none')state.animations.push(state.asset.animate([{transform:state.asset.style.transform||'none'},{transform:'translate(0px,0px) scale(1)'}],{duration:nxSpeeds[nxSettings(projectState.presentation).speed],easing:'ease-out',fill:'both'}));
  state.closing=mfAnimate(state,current,target,false).then(()=>{if(mfState===state)mfRestore(state);});return state.closing;
}
function mfAbort() { const state=mfState;if(state)mfRestore(state,{resumeVideo:false,advance:false}); }
const mfShow=show;show=function(...args){if(mfState)mfAbort();return mfShow(...args);};
const mfSwitch=switchDeck;switchDeck=function(...args){if(mfState)mfAbort();return mfSwitch(...args);};
const mfRender=projectRender;projectRender=function(...args){if(mfState)mfAbort();return mfRender(...args);};
const mfPreview=projectPreview;projectPreview=function(...args){if(mfState?.preview){if(mfState.host.isConnected&&projectSelected===mfState.slide.dataset.mediaId)return;mfAbort();}return mfPreview(...args);};
// Keep direct and shortcut entry points safe.
const mfOpenEditor=projectOpen;projectOpen=function(...args){if(mfState)mfAbort();return mfOpenEditor(...args);};
const mfCloseEditor=projectClose;projectClose=function(...args){if(mfState)mfAbort();return mfCloseEditor(...args);};
const mfOpenMedia=mediaOpen;mediaOpen=function(...args){if(mfState)mfAbort();return mfOpenMedia(...args);};
const mfOpenPicker=hubOpenPicker;hubOpenPicker=function(...args){if(mfState)mfAbort();return mfOpenPicker(...args);};
function mfForm() {
  if(!$('mf-setting-enabled')||!projectReady)return;const p=mfSettings();$('mf-setting-enabled').checked=p.enabled;$('mf-setting-animation').value=p.animation;$('mf-setting-captions').checked=p.captions;$('mf-setting-zoom').checked=p.zoom;
}
const mfOldForm=projectForm;projectForm=function(...args){mfOldForm(...args);mfForm();};
function mfBind() {
  const group=document.createElement('details');group.className='hub-brand-group';group.id='mf-settings';group.innerHTML='<summary>Media Focus</summary><label class="fe-check"><input id="mf-setting-enabled" type="checkbox"> Enable click-to-focus media</label><label for="mf-setting-animation">Focus animation</label><select id="mf-setting-animation"><option value="expand">Expand and return</option><option value="fade">Fade</option><option value="none">None</option></select><label class="fe-check"><input id="mf-setting-captions" type="checkbox"> Show captions while focused</label><label class="fe-check"><input id="mf-setting-zoom" type="checkbox"> Allow image zoom and pan</label><p class="fe-hint">Focus fills this presentation canvas, pauses slide advancement, and restores its previous play/pause state. Videos keep their playback position. Use Return or Escape to close. In OBS, use Browser Source Interact.</p>';$('fe-settings-panel').append(group);
  for(const[id,key]of [['mf-setting-enabled','enabled'],['mf-setting-animation','animation'],['mf-setting-captions','captions'],['mf-setting-zoom','zoom']])$(id).onchange=e=>projectChange(()=>{const p=nxSettings(projectState.presentation);p.mediaFocus={...p.mediaFocus,[key]:e.target.type==='checkbox'?e.target.checked:e.target.value};projectState.presentation=p;});
  document.addEventListener('click',e=>{
    if(mfState)return;const figure=e.target.closest?.('.media-box');if(!figure||!mfAllowed(figure))return;
    const explicit=e.target.closest('.mf-expand'),asset=e.target.closest('.media-asset');if(!explicit&&!asset)return;
    if(asset?.tagName==='VIDEO'&&!explicit){const r=asset.getBoundingClientRect(),host=mfHost(figure),scale=host.getBoundingClientRect().width/host.clientWidth;if(e.clientY>=r.bottom-70*scale)return;}
    e.preventDefault();e.stopImmediatePropagation();mfOpen(figure,explicit||figure.querySelector('.mf-expand'));
  },true);
  document.addEventListener('keydown',e=>{
    const state=mfState;if(!state)return;
    if(e.key==='Escape'){if(document.fullscreenElement===state.asset)return;e.preventDefault();e.stopImmediatePropagation();mfClose();return;}
    if(e.key==='Tab'){const list=[...state.layer.querySelectorAll('button:not(:disabled),video[controls]')].filter(el=>!el.hidden&&!el.closest('[hidden]'));const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}e.stopPropagation();return;}
    if(e.ctrlKey||e.metaKey)return;
    if(e.target.closest('button,input,select')){e.stopPropagation();return;}
    if(['+','=','-','_','0'].includes(e.key)&&state.asset.tagName==='IMG'){e.preventDefault();e.stopImmediatePropagation();mfZoom(state,e.key==='0'?1:['-','_'].includes(e.key)?state.zoom/1.25:state.zoom*1.25);return;}
    if(e.key===' '){e.preventDefault();e.stopImmediatePropagation();if(state.asset.tagName==='VIDEO'){if(state.asset.paused)mfPlay(state.asset);else state.asset.pause();}return;}
    if(e.key.startsWith('Arrow')){e.preventDefault();e.stopImmediatePropagation();if(mfZoomReady(state)&&state.zoom>1){if(e.key==='ArrowLeft')state.x+=40;if(e.key==='ArrowRight')state.x-=40;if(e.key==='ArrowUp')state.y+=40;if(e.key==='ArrowDown')state.y-=40;mfZoomPaint(state);}return;}
    e.stopPropagation();
  },true);
  nxReduced.addEventListener('change',()=>{if(mfState)mfCancelAnimations(mfState);});window.addEventListener('resize',mfRefreshSize);
  $('open-full-editor').onclick=projectOpen;$('edit-media').onclick=mediaOpen;$('fe-close').onclick=projectClose;$('hub-presentations').onclick=hubOpenPicker;$('hub-editor-projects').onclick=hubOpenPicker;
  mfForm();
}
const mfInit=projectInit;projectInit=function(){mfInit();mfBind();};
