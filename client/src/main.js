// Vòng lặp khung hình: chạy lõi chiến đấu theo bước cố định, rồi vẽ đấu trường, hiệp sĩ, góc nhìn thứ nhất và HUD.
import { $, CFG, S, angWrap, clamp, easeOut, lerp, rand } from './config.js';
import { INTERP, netNow, netTick } from './net.js';
import { bot, bots, brains, committed, dodge, feint, fighters, inMatch, now, parryPress, parryRelease, phase, player, sim, startAttack, syncCore } from './core.js';
import { handleEvents, updateHUD, updateParts } from './effects.js';
import { readMove, turnKeys } from './input.js';
import { setRoster } from './match.js';
import { EYE_H, knights, poseFor, setupKnight, setupViewmodel, updateKnight, updateViewArms, vm, vmRoot } from './models.js';
import { setResDocs } from './results.js';
import { G } from './state.js';
import { camera, renderer, scene, sky, torches, vmScene } from './world.js';
import { TICK, TURN_CAP, WEAPONS } from '@dtk/shared';
/* ---------------- render loop ---------------- */
export let last=performance.now(),fpsAcc=0,fpsN=0,fpsT=0;
// The sim runs in fixed steps of 1/60 s (the same rule the game server will run); rendering uses whatever time passed.
export let acc=0;
// Simulated ping: you see other fighters as they were (ping/2 + 50 ms interpolation) ago, while your own actions count when you press them,
// which is how the planned netcode with lag compensation will feel. A history of every bot's state is kept per tick for this.
export const GHOST_KEYS=['state','t','dur','atkType','riposte','morphed','yaw','st','hp','walk','flash','deadT','killType','dodgeSide'];
export function recordHistory(){if(S.ping<=0)return;for(const b of bots){const h=b.hist||(b.hist=[]);const s={at:now,x:b.pos.x,z:b.pos.z,vx:b.vel.x,vz:b.vel.z};for(const k of GHOST_KEYS)s[k]=b[k];h.push(s);if(h.length>90)h.shift();}}
export function viewOf(b){
  const online=G.mode==='net';
  if((!online&&S.ping<=0)||!inMatch()||!b.hist||!b.hist.length)return b;
  // online: show others INTERP behind the server clock; offline: simulated ping
  const tgt=online?netNow()-INTERP:now-(S.ping/2+50)/1000;
  let i=0;while(i<b.hist.length-1&&b.hist[i+1].at<=tgt)i++;
  const s=b.hist[i],n=b.hist[i+1];
  const g=b.ghost||(b.ghost={pos:{x:0,y:0,z:0},vel:{x:0,y:0,z:0},pose:null,weapon:b.weapon,isBot:true});
  for(const k of GHOST_KEYS)g[k]=s[k];g.pos.x=s.x;g.pos.z=s.z;g.vel.x=s.vx;g.vel.z=s.vz;g.weapon=b.weapon;
  // between two snapshots: blend position and facing, and let the state timer run on
  if(n&&tgt>s.at){const k=clamp((tgt-s.at)/(n.at-s.at),0,1);g.pos.x=lerp(s.x,n.x,k);g.pos.z=lerp(s.z,n.z,k);g.yaw=s.yaw+angWrap(n.yaw-s.yaw)*k;if(n.state===s.state)g.t=s.t+(tgt-s.at);}
  return g;}
export function simTick(){
  if(G.mode==='net'){netTick(TICK);updateParts(TICK);return;}
  if(inMatch()&&player.state!=='dead')player.yaw=G.camYaw;
  player.input=readMove();
  if(phase==='attract')bot.yaw+=TICK*.25;
  sim.step(TICK);syncCore();handleEvents(sim.drain());
  if(inMatch())recordHistory();
  updateParts(TICK);
}
export function frame(t){requestAnimationFrame(frame);step(t);}
export function step(t){
  const rdt=Math.min(.05,(t-last)/1000);last=t;
  fpsAcc+=rdt;fpsN++;fpsT+=rdt;if(fpsT>.5){$('fps').textContent=Math.round(fpsN/fpsAcc)+' fps';fpsAcc=0;fpsN=0;fpsT=0;}
  let dt=rdt;
  if(G.paused||phase==='matchEnd')dt=0;
  if(G.hitstop>0&&dt>0){G.hitstop-=dt;dt=0;}
  if(inMatch()&&!G.paused){
    const sens=.0022*S.sens;let dy=-G.mdx*sens;if(committed(player)){const cap=TURN_CAP*rdt;dy=clamp(dy,-cap,cap);}G.camYaw+=dy;G.camPitch=clamp(G.camPitch-G.mdy*sens,-1.35,1.35);
    G.camYaw+=turnKeys()*2.4*rdt;
  }
  G.mdx=G.mdy=0;
  if(dt>0){
    if(inMatch()&&G.mode==='match'){G.fpsFrames++;G.fpsTime+=rdt;}
    acc+=dt;let n=0;while(acc>=TICK&&n<5){simTick();acc-=TICK;n++;}if(n>=5)acc=0;
  }
  // torches
  for(const tc of torches){tc.ph+=rdt*9;const fl=1+Math.sin(tc.ph)*.08+Math.sin(tc.ph*2.3)*.06;tc.l.intensity=1.1*fl;tc.f.scale.setScalar(fl);}
  // knights (other fighters, as this player sees them)
  knights.forEach((k,i)=>{const b=bots[i];if(!b)return;const v=phase==='attract'?b:viewOf(b);const g=k.g;g.position.set(v.pos.x,0,v.pos.z);g.rotation.y=v.yaw;
    updateKnight(k,v,poseFor(v,dt),dt);
    const fl=v.flash;for(const m of k.mats)m.emissive.setRGB(fl*.6,fl*.08,fl*.05);});
  // camera
  if(inMatch()||phase==='matchEnd'){
    G.shake=Math.max(0,G.shake-rdt*2.5);const sh=G.shake*G.shake*.35;
    const sp=Math.hypot(player.vel.x,player.vel.z);const bob=Math.sin(player.walk*2.6)*.04*Math.min(1,sp/4);
    let eye=EYE_H+bob,roll=0;
    let pitchAdd=0,back=0;
    // first-person death follows the finishing blow: overhead → slump and look down, slash → keel over sideways, stab → fall back and stare at the sky
    if(player.state==='dead'){const k=easeOut(Math.min(1,player.deadT/.8)),ty=player.killType||'over';eye=lerp(EYE_H,.35,k);
      if(ty==='stab'){pitchAdd=1.1*k;back=.45*k;roll=.15*k;}else if(ty==='slash'){roll=1.25*k;pitchAdd=-.15*k;}else{pitchAdd=-.55*k;roll=.35*k;}}
    if(player.state==='stun')roll=Math.sin(now*14)*.03;
    if(player.state==='dodge'){const k=1-player.t/player.dur;roll-=(player.dodgeSide||0)*.07*k;eye-=.07*k;}
    camera.position.set(player.pos.x+Math.sin(G.camYaw)*back+rand(-sh,sh),eye+rand(-sh,sh),player.pos.z+Math.cos(G.camYaw)*back+rand(-sh,sh));
    camera.rotation.set(clamp(G.camPitch+pitchAdd,-1.5,1.5)+rand(-sh,sh)*.4,G.camYaw,roll);
  }else{const a=performance.now()/1000*.12;camera.position.set(Math.sin(a)*9,3.2,Math.cos(a)*9);camera.lookAt(0,1.4,0);}
  sky.position.copy(camera.position);
  // first-person weapon and arms
  const showVm=inMatch()&&player.state!=='dead';vmRoot.visible=showVm;
  if(showVm&&vm){vmRoot.position.copy(camera.position);vmRoot.quaternion.copy(camera.quaternion);
    const pz=poseFor(player,dt);const sp=Math.hypot(player.vel.x,player.vel.z);const bx=Math.sin(player.walk*2.6)*.012*Math.min(1,sp/4),by=Math.abs(Math.cos(player.walk*2.6))*.012*Math.min(1,sp/4);
    vm.pivot.position.set(pz.x+bx,pz.y+by,pz.z);vm.pivot.rotation.set(pz.pitch,pz.yaw,pz.roll);vm.wp.spin.rotation.y=pz.spin;updateViewArms();}
  if(inMatch())updateHUD(rdt);
  renderer.clear();renderer.render(scene,camera);renderer.clearDepth();if(showVm)renderer.render(vmScene,camera);
}

// start on the menu with one knight turning slowly in the middle of the arena
setRoster(1);bot.weapon=WEAPONS[CFG.bw==='axe'?'axe':'sword'];sim.resetFighter(bot,0,0,Math.PI);setupKnight();setupViewmodel();
requestAnimationFrame(frame);

// debug hook for automated checks: advance the simulation by n fixed steps
window.__dtk={sim,player,bot,get ai(){return sim.brains[0];},get bots(){return bots;},get fighters(){return fighters;},get brains(){return brains;},get phase(){return phase;},
  get stats(){return G.stats;},get score(){return G.score;},startAttack,parryPress,parryRelease,feint,dodge,S,CFG,G,viewOf,
  renderRes(docs){setResDocs(docs);},
  aim(){G.camYaw=Math.atan2(-(bot.pos.x-player.pos.x),-(bot.pos.z-player.pos.z));},
  run(n){for(let i=0;i<n;i++){const t=performance.now();last=t-1000/60-.01;step(t);}}};
