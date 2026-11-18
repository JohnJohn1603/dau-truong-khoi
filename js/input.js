// Di chuyển, va chạm và điều khiển chuột/bàn phím
'use strict';
/* ---------------- movement / collision ---------------- */
function speedMul(f){return{windup:.5,release:.4,parry:.7,stun:.35,recoil:.5,dead:0}[f.state]??1;}
function moveFighter(f,wx,wz,speed,dt){
  const len=Math.hypot(wx,wz);if(len>1){wx/=len;wz/=len;}
  if(f.state==='dodge'){const d=Math.exp(-3*dt);f.vel.x*=d;f.vel.z*=d;} // keep the dash impulse, ignore steering
  else{const a=1-Math.exp(-12*dt);
  f.vel.x=lerp(f.vel.x,wx*speed,a);f.vel.z=lerp(f.vel.z,wz*speed,a);}
  f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;
  const lim=HALF-f.radius-.05;f.pos.x=clamp(f.pos.x,-lim,lim);f.pos.z=clamp(f.pos.z,-lim,lim);
  for(const[x,z]of PILLARS){const nx=clamp(f.pos.x,x,x+1),nz=clamp(f.pos.z,z,z+1);const dx=f.pos.x-nx,dz=f.pos.z-nz,d=Math.hypot(dx,dz);
    if(d<f.radius){if(d<1e-4){f.pos.x+=f.radius;continue;}f.pos.x=nx+dx/d*f.radius;f.pos.z=nz+dz/d*f.radius;}}
  f.walk+=Math.hypot(f.vel.x,f.vel.z)*dt;
}
function separate(){const dx=bot.pos.x-player.pos.x,dz=bot.pos.z-player.pos.z,d=Math.hypot(dx,dz),m=.9;
  if(d<m&&d>1e-4&&bot.state!=='dead'&&player.state!=='dead'){const p=(m-d)/2;bot.pos.x+=dx/d*p;bot.pos.z+=dz/d*p;player.pos.x-=dx/d*p;player.pos.z-=dz/d*p;}}

/* ---------------- input ---------------- */
const K={};let mdx=0,mdy=0,camYaw=0,camPitch=0,locked=false,lockEverWorked=false,lockFailed=false,lastWheel=0,rmb=false,fkey=false,muted=false;
const inMatch=()=>phase==='countdown'||phase==='fight'||phase==='roundEnd';
addEventListener('keydown',e=>{
  if(e.repeat&&!['KeyW','KeyA','KeyS','KeyD'].includes(e.code))return;
  K[e.code]=true;
  if(!inMatch()||paused){if(e.code==='Escape'&&paused&&lockFailed)resume();return;}
  if(e.code==='Escape'&&!locked){pause();return;}
  if(e.code==='KeyQ')feint(player);
  if(e.code==='Space'){const f=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0),s=(K.KeyD?1:0)-(K.KeyA?1:0);dodge(player,s,f);}
  if(e.code==='KeyE')startAttack(player,'stab');
  if(e.code==='KeyR')startAttack(player,'over');
  if(e.code==='KeyF'&&!fkey){fkey=true;parryPress(player);}
  if(e.code==='KeyM'){muted=!muted;if(master)master.gain.value=muted?0:S.volume;popup(muted?'Đã tắt tiếng':'Đã bật tiếng','info');}
  if(['Space','ArrowUp','ArrowDown','Tab'].includes(e.code))e.preventDefault();
});
addEventListener('keyup',e=>{K[e.code]=false;if(e.code==='KeyF'){fkey=false;if(!rmb)parryRelease(player);}});
addEventListener('blur',()=>{for(const k in K)K[k]=false;if(inMatch()&&!paused)pause();});
document.addEventListener('mousemove',e=>{if(!inMatch()||paused)return;if(locked||lockFailed){mdx+=e.movementX||0;mdy+=e.movementY||0;}});
canvas.addEventListener('mousedown',e=>{
  if(!inMatch()||paused)return;
  if(!locked&&!lockFailed){requestLock();return;}
  if(e.button===0)startAttack(player,'slash');
  if(e.button===2){rmb=true;parryPress(player);}
  e.preventDefault();
});
addEventListener('mouseup',e=>{if(e.button===2){rmb=false;if(!fkey)parryRelease(player);}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!inMatch()||paused)return;const t=performance.now();if(t-lastWheel<180)return;lastWheel=t;startAttack(player,e.deltaY<0?'over':'stab');},{passive:false});
function requestLock(){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>onLockError());}catch(e){onLockError();}}
function onLockError(){if(!lockEverWorked){lockFailed=true;showHint('Không khoá được chuột ở đây. Di chuột để quay, Esc để tạm dừng.',6);}else showHint('Bấm vào màn hình để khoá chuột lại.',3);}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){lockEverWorked=true;lockFailed=false;}else if(inMatch()&&!paused)pause();});
document.addEventListener('pointerlockerror',onLockError);
