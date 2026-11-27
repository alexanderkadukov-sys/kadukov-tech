(() => {
  'use strict';
  const section = document.getElementById('tech3d');
  if (!section) return;
  const model = document.getElementById('tech3dModel');
  const viewport = document.getElementById('tech3dViewport');
  const slider = document.getElementById('tech3dExplode');
  const output = document.getElementById('tech3dValue');
  const rotate = document.getElementById('tech3dRotate');
  const reset = document.getElementById('tech3dReset');
  if (![model, viewport, slider, output, rotate, reset].every(Boolean)) return;
  if (!window.CSS || !CSS.supports('transform-style','preserve-3d')) return;
  let rx=-13, ry=-40, depth=.65, drag=null, spinning=false, visible=false, frame=0, last=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const render=()=>{model.style.setProperty('--rx',rx+'deg');model.style.setProperty('--ry',ry+'deg');model.style.setProperty('--depth',String(depth));};
  function setDepth(value){depth=Math.max(0,Math.min(100,Number(value)))/100;slider.value=String(Math.round(depth*100));output.value=slider.value+'%';render();}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function tick(t){frame=0;if(!spinning||!visible||document.hidden||reduced.matches){last=0;return;}if(last){ry=(ry+Math.min(t-last,50)*.018)%360;render();}last=t;frame=requestAnimationFrame(tick);}
  function schedule(){stop();if(spinning&&visible&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
  function setSpin(on){spinning=on&&!reduced.matches;rotate.setAttribute('aria-pressed',String(spinning));rotate.textContent=spinning?'Остановить':'Вращать';schedule();}
  slider.addEventListener('input',()=>setDepth(slider.value));
  rotate.addEventListener('click',()=>setSpin(!spinning));
  reset.addEventListener('click',()=>{setSpin(false);rx=-13;ry=-40;setDepth(65);});
  viewport.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;setSpin(false);drag={id:e.pointerId,x:e.clientX,y:e.clientY,rx,ry,active:false};});
  viewport.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.active){if(Math.abs(dx)<7)return;if(Math.abs(dy)>Math.abs(dx)&&e.pointerType==='touch'){drag=null;return;}drag.active=true;try{viewport.setPointerCapture(e.pointerId);}catch{}}ry=(drag.ry+dx*.65)%360;rx=Math.max(-55,Math.min(55,drag.rx-dy*.3));render();});
  function end(e){if(drag&&drag.id===e.pointerId)drag=null;}
  ['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(event=>viewport.addEventListener(event,e=>{if(event==='pointerleave'&&drag?.active)return;end(e);}));
  viewport.tabIndex=0;viewport.setAttribute('aria-label','Модель смартфона: стрелки влево и вправо поворачивают, вверх и вниз наклоняют');
  viewport.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();setSpin(false);if(e.key==='ArrowLeft')ry-=10;if(e.key==='ArrowRight')ry+=10;if(e.key==='ArrowUp')rx=Math.min(55,rx+8);if(e.key==='ArrowDown')rx=Math.max(-55,rx-8);render();});
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.05}).observe(viewport);}else{visible=true;}
  document.addEventListener('visibilitychange',schedule);
  function motionPreference(){rotate.disabled=reduced.matches;if(reduced.matches)setSpin(false);}
  if(reduced.addEventListener)reduced.addEventListener('change',motionPreference);
  motionPreference();setDepth(65);section.querySelector('.tech3d-controls').hidden=false;
})();