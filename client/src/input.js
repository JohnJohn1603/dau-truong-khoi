// Điều khiển chuột/bàn phím → thao tác gửi vào lõi chiến đấu
import { S } from './config.js';
import { dodge, feint, inMatch, parryPress, parryRelease, player, startAttack } from './core.js';
import { master, popup, showHint } from './effects.js';
import { pause, resume } from './match.js';
import { G } from './state.js';
import { canvas } from './world.js';
/* ---------------- input ---------------- */
export const K={};export let locked=false,lockEverWorked=false,lockFailed=false,lastWheel=0,rmb=false,fkey=false;
// Lách: double-tap A or D (a held key's auto-repeat never counts). Sideways only; Space stays free for a future jump.
export const TAP_DIR={KeyA:-1,KeyD:1},DBL_TAP_MS=260;export let lastTap={code:null,t:0};
addEventListener('keydown',e=>{
  if(e.repeat&&!['KeyW','KeyA','KeyS','KeyD'].includes(e.code))return;
  K[e.code]=true;
  if(!inMatch()||G.paused){if(e.code==='Escape'&&G.paused&&lockFailed)resume();return;}
  if(e.code==='Escape'&&!locked){pause();return;}
  if(e.code==='KeyQ')feint(player);
  if(!e.repeat&&TAP_DIR[e.code]){const t=performance.now();if(lastTap.code===e.code&&t-lastTap.t<DBL_TAP_MS){dodge(player,TAP_DIR[e.code]);lastTap.code=null;}else lastTap={code:e.code,t};}
  if(e.code==='KeyE')startAttack(player,'stab');
  if(e.code==='KeyR')startAttack(player,'over');
  if(e.code==='KeyF'&&!fkey){fkey=true;parryPress(player);}
  if(e.code==='KeyM'){G.muted=!G.muted;if(master)master.gain.value=G.muted?0:S.volume;popup(G.muted?'Đã tắt tiếng':'Đã bật tiếng','info');}
  if(['Space','ArrowUp','ArrowDown','Tab'].includes(e.code))e.preventDefault();
});
addEventListener('keyup',e=>{K[e.code]=false;if(e.code==='KeyF'){fkey=false;if(!rmb)parryRelease(player);}});
addEventListener('blur',()=>{for(const k in K)K[k]=false;if(inMatch()&&!G.paused)pause();});
document.addEventListener('mousemove',e=>{if(!inMatch()||G.paused)return;if(locked||lockFailed){G.mdx+=e.movementX||0;G.mdy+=e.movementY||0;}});
canvas.addEventListener('mousedown',e=>{
  if(!inMatch()||G.paused)return;
  if(!locked&&!lockFailed){requestLock();return;}
  if(e.button===0)startAttack(player,'slash');
  if(e.button===2){rmb=true;parryPress(player);}
  e.preventDefault();
});
addEventListener('mouseup',e=>{if(e.button===2){rmb=false;if(!fkey)parryRelease(player);}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!inMatch()||G.paused)return;const t=performance.now();if(t-lastWheel<180)return;lastWheel=t;startAttack(player,e.deltaY<0?'over':'stab');},{passive:false});
export function requestLock(){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>onLockError());}catch(e){onLockError();}}
export function onLockError(){if(!lockEverWorked){lockFailed=true;showHint('Không khoá được chuột ở đây. Di chuột để quay, Esc để tạm dừng.',6);}else showHint('Bấm vào màn hình để khoá chuột lại.',3);}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){lockEverWorked=true;lockFailed=false;}else if(inMatch()&&!G.paused)pause();});
document.addEventListener('pointerlockerror',onLockError);
// all held keys and buttons released (pause, blur)
export function clearInput(){for(const k in K)K[k]=false;rmb=fkey=false;}
// movement keys → the sim's per-tick input for the player
export function readMove(){
  let f=0,s=0;if(K.KeyW||K.ArrowUp)f++;if(K.KeyS||K.ArrowDown)f--;if(K.KeyD)s++;if(K.KeyA)s--;
  return{fwd:f,side:s,sprint:!!(K.ShiftLeft||K.ShiftRight)};
}
export const turnKeys=()=>(K.ArrowLeft?1:0)-(K.ArrowRight?1:0);
export const pointerFree=()=>lockFailed;
