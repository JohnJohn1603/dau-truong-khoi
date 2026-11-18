// Xưởng giáp: khung xem nhân vật 3D, nhấp chuột để hiệp sĩ ra đòn
import * as THREE from 'three';
import { $, ATK_NAME, BOT_NAMES, CFG, S, TABARD, clamp, lerp } from './config.js';
import { SFX, initAudio } from './effects.js';
import { K_WPN, POSE, buildKnight, buildWeapon, poseFor, updateKnight } from './models.js';
import { MATS } from './world.js';
import { WEAPONS } from '@dtk/shared';
/* ---------------- model viewer ----------------
   Own renderer + scene on a small canvas, so it never touches the arena or the match state.
   The knight here is driven by a tiny local state machine (idle → windup → release → recovery)
   using the real weapon timings, and posed with the same poseFor/updateKnight as in a match. */
export const PV={open:false,ready:false,w:'sword',skin:'med',speed:1,auto:true,yaw:.55,pitch:.12,dist:4.9,swayT:0,
  renderer:null,scene:null,cam:null,k:null,f:null,last:0,raf:0,drag:null,lastWheel:0,idleT:0};
export const PV_STATE={idle:'Thủ thế',windup:'Gồng đòn',release:'Vung',recovery:'Thu đòn',parry:'Đỡ',stun:'Choáng',dead:'Gục ngã'};
export const PV_DEATH={slash:'chém',stab:'đâm',over:'đập'};
export const PV_TARGET=new THREE.Vector3(0,1.0,0);

export function pvInit(){
  if(PV.ready)return;PV.ready=true;
  const cv=$('vCanvas');
  const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});
  r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;
  const sc=new THREE.Scene();sc.background=new THREE.Color(0x15181e);sc.fog=new THREE.Fog(0x15181e,7,14);
  sc.add(new THREE.HemisphereLight(0xb8c4dc,0x4a3a2a,.55));
  const key=new THREE.DirectionalLight(0xffd2aa,.9);key.position.set(-3,5,-4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:1,far:15});key.shadow.bias=-.0008;sc.add(key);
  const rim=new THREE.DirectionalLight(0x8fb0ff,.35);rim.position.set(3,3,4);sc.add(rim);
  // small voxel plinth: sand top, cobble rim
  const box=new THREE.BoxGeometry(1,1,1),m=new THREE.Matrix4(),R=3;const sand=[],rimB=[];
  for(let x=-R;x<R;x++)for(let z=-R;z<R;z++){const d=Math.hypot(x+.5,z+.5);if(d>R+.2)continue;(d>R-1?rimB:sand).push([x,z]);}
  for(const[L,mat,y]of[[sand,MATS.sand,-.5],[rimB,MATS.cobble,-.42]]){const im=new THREE.InstancedMesh(box,mat,L.length);
    L.forEach((p,i)=>{m.makeTranslation(p[0]+.5,y,p[1]+.5);im.setMatrixAt(i,m);});im.receiveShadow=true;sc.add(im);}
  const cam=new THREE.PerspectiveCamera(34,1,.1,40);
  Object.assign(PV,{renderer:r,scene:sc,cam});
  new ResizeObserver(pvResize).observe($('vStage'));pvResize();
  pvBindInput(cv);
}
export function pvResize(){if(!PV.renderer)return;const st=$('vStage'),w=st.clientWidth,h=st.clientHeight;if(!w||!h)return;
  PV.renderer.setSize(w,h,false);PV.cam.aspect=w/h;PV.cam.updateProjectionMatrix();}

export function pvBuild(){
  if(PV.k){PV.scene.remove(PV.k.g);PV.k.g.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  const k=buildKnight(TABARD[PV.skin]);const wp=buildWeapon(PV.w);wp.w.scale.setScalar(K_WPN);k.pivot.add(wp.w);k.weapon=wp;
  PV.scene.add(k.g);PV.k=k;
  PV.f={weapon:WEAPONS[PV.w],state:'idle',t:0,dur:0,atkType:null,atk:null,riposte:false,buffer:null,
    pose:Object.assign({},POSE.idle),walk:0,vel:new THREE.Vector3(),flash:0};
  // settle into the idle stance before the first frame is shown
  for(let i=0;i<30;i++)updateKnight(k,PV.f,poseFor(PV.f,.033),.033);
  $('vName').textContent=BOT_NAMES[PV.skin];$('vWpn').textContent=WEAPONS[PV.w].name;pvLabel();
}

/* ---- tiny combat state machine (no opponent, no stamina) ---- */
export function pvSet(s,dur){const f=PV.f;f.state=s;f.t=0;f.dur=dur||0;pvLabel();}
export function pvAttack(type){const f=PV.f;initAudio();PV.idleT=0;if(f.state==='dead')return;
  if(f.state!=='idle'&&f.state!=='parry'){f.buffer=type;return;}
  const a=f.weapon[type];f.atkType=type;f.atk=a;pvSet('windup',a.wind/S.atkSpeed);SFX.tell(type,true);}
export function pvParry(on){const f=PV.f;initAudio();PV.idleT=0;
  if(on&&(f.state==='idle'||f.state==='recovery'))pvSet('parry');
  else if(!on&&f.state==='parry')pvSet('idle');}
export function pvStun(){initAudio();PV.idleT=0;PV.f.buffer=null;PV.f.flash=1;SFX.hit();pvSet('stun',.6);}
export function pvHit(){initAudio();PV.idleT=0;PV.f.flash=1;SFX.hit();}
// knight goes down, lies there a moment, then gets back up (viewer only)
export function pvDie(type){initAudio();PV.idleT=0;PV.f.buffer=null;PV.f.flash=1;PV.f.deadT=0;PV.f.killType=type;SFX.boom();pvSet('dead',2.6);}
export function pvStep(dt){const f=PV.f;f.t+=dt;f.flash=Math.max(0,f.flash-dt*4);
  if(f.state==='dead'){f.deadT+=dt;if(f.t>=f.dur){f.deadT=0;pvSet('idle');}return;}
  if(f.state==='windup'&&f.t>=f.dur){pvSet('release',f.atk.rel/S.atkSpeed);SFX.whoosh(f.atkType==='over'||f.weapon.id==='axe',false);}
  else if(f.state==='release'&&f.t>=f.dur)pvSet('recovery',f.atk.rec/S.atkSpeed);
  else if((f.state==='recovery'||f.state==='stun')&&f.t>=f.dur){pvSet('idle');if(f.buffer){const b=f.buffer;f.buffer=null;pvAttack(b);}}
  if(f.state!=='idle'&&f.state!=='parry'&&f.dur>0)$('vBar').style.transform=`scaleX(${clamp(f.t/f.dur,0,1)})`;
}
export function pvLabel(){const f=PV.f;if(!f)return;const el=$('vState');
  const what=(f.state==='windup'||f.state==='release'||f.state==='recovery')?' · '+ATK_NAME[f.atkType]:f.state==='dead'?' do '+PV_DEATH[f.killType]:'';
  const t=f.dur>0?` · ${Math.round(f.dur*1000)} ms`:'';
  el.textContent=PV_STATE[f.state]+what+t;el.dataset.s=f.state;
  if(f.state==='idle'||f.state==='parry')$('vBar').style.transform='scaleX(0)';}

/* ---- render loop (only while the viewer is open) ---- */
export function pvFrame(t){
  if(!PV.open)return;PV.raf=requestAnimationFrame(pvFrame);
  const rdt=Math.min(.05,(t-PV.last)/1000);PV.last=t;const dt=rdt*PV.speed;
  pvStep(dt);
  const k=PV.k,f=PV.f;k.g.position.set(0,0,0);k.g.rotation.y=0;updateKnight(k,f,poseFor(f,dt),dt);
  for(const m of k.mats)m.emissive.setRGB(f.flash*.6,f.flash*.08,f.flash*.05);
  // idle drift: sway gently around the front three-quarter view instead of spinning to the back
  if(PV.auto&&!PV.drag){PV.idleT+=rdt;if(PV.idleT>2.5){PV.swayT+=rdt;PV.yaw=lerp(PV.yaw,.35+Math.sin(PV.swayT*.45)*.75,1-Math.exp(-1.5*rdt));}}
  const c=Math.cos(PV.pitch);PV.cam.position.set(Math.sin(PV.yaw)*c*PV.dist,PV_TARGET.y+Math.sin(PV.pitch)*PV.dist,-Math.cos(PV.yaw)*c*PV.dist);
  PV.cam.lookAt(PV_TARGET);
  PV.renderer.render(PV.scene,PV.cam);
}

/* ---- input: click = chém, cuộn lên/xuống = đập/đâm, giữ chuột phải = đỡ, kéo = xoay ---- */
export function pvBindInput(cv){
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{
    if(e.button===2){pvParry(true);e.preventDefault();return;}
    if(e.button!==0)return;
    PV.drag={x:e.clientX,y:e.clientY,moved:false,id:e.pointerId};cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove',e=>{const d=PV.drag;if(!d||d.id!==e.pointerId)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<6)return;
    d.moved=true;d.x=e.clientX;d.y=e.clientY;PV.idleT=0;
    PV.yaw-=dx*.008;PV.pitch=clamp(PV.pitch+dy*.005,-.15,.75);cv.classList.add('dragging');});
  const up=e=>{if(e.button===2){pvParry(false);return;}const d=PV.drag;if(!d||d.id!==e.pointerId)return;
    PV.drag=null;cv.classList.remove('dragging');if(!d.moved&&e.type==='pointerup')pvAttack('slash');};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();const t=performance.now();if(t-PV.lastWheel<180)return;PV.lastWheel=t;pvAttack(e.deltaY<0?'over':'stab');},{passive:false});
  addEventListener('keydown',e=>{if(!PV.open||e.repeat)return;
    if(e.code==='Escape'){pvClose();return;}
    if(e.code==='KeyE')pvAttack('stab');if(e.code==='KeyR')pvAttack('over');if(e.code==='KeyF')pvParry(true);});
  addEventListener('keyup',e=>{if(PV.open&&e.code==='KeyF')pvParry(false);});
  // buttons for touch / discoverability
  document.querySelectorAll('[data-pv-act]').forEach(b=>{const a=b.dataset.pvAct;
    if(a==='parry'){b.addEventListener('pointerdown',e=>{e.preventDefault();pvParry(true);});
      for(const ev of['pointerup','pointerleave','pointercancel'])b.addEventListener(ev,()=>pvParry(false));
      b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)pvParry(true);});b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')pvParry(false);});}
    else if(a==='stun')b.onclick=pvStun;else if(a==='hit')b.onclick=pvHit;else if(a.startsWith('die-'))b.onclick=()=>pvDie(a.slice(4));else b.onclick=()=>pvAttack(a);});
  // option groups (local to the viewer, they don't change match settings)
  document.querySelectorAll('[data-pv-opt]').forEach(seg=>{const key=seg.dataset.pvOpt;
    const sync=()=>seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(PV[key])===b.dataset.v)));
    seg.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
      PV[key]=key==='speed'?parseFloat(b.dataset.v):b.dataset.v;sync();if(key!=='speed')pvBuild();});
    seg._sync=sync;});
  $('vAuto').onchange=e=>{PV.auto=e.target.checked;PV.idleT=0;};
}
export function pvSyncOpts(){document.querySelectorAll('[data-pv-opt]').forEach(s=>s._sync&&s._sync());$('vAuto').checked=PV.auto;}

export function pvOpen(){
  PV.w=CFG.bw==='axe'?'axe':'sword';PV.skin=CFG.diff;
  $('menu').hidden=true;$('viewScr').hidden=false;
  pvInit();pvResize();pvBuild();pvSyncOpts();
  PV.open=true;PV.last=performance.now();PV.idleT=0;cancelAnimationFrame(PV.raf);PV.raf=requestAnimationFrame(pvFrame);
  $('vCanvas').focus({preventScroll:true});
}
export function pvClose(){PV.open=false;cancelAnimationFrame(PV.raf);if(PV.f)pvParry(false);$('viewScr').hidden=true;$('menu').hidden=false;}
$('viewBtn').onclick=pvOpen;$('viewClose').onclick=pvClose;
