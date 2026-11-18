// Vòng lặp khung hình, camera và móc kiểm thử
'use strict';
/* ---------------- render loop ---------------- */
let last=performance.now(),fpsAcc=0,fpsN=0,fpsT=0;
bot.weapon=WEAPONS[CFG.bw==='axe'?'axe':'sword'];resetF(bot,0,0,Math.PI);setupKnight();setupViewmodel();
function frame(t){requestAnimationFrame(frame);step(t);}
function step(t){
  const rdt=Math.min(.05,(t-last)/1000);last=t;
  fpsAcc+=rdt;fpsN++;fpsT+=rdt;if(fpsT>.5){$('fps').textContent=Math.round(fpsN/fpsAcc)+' fps';fpsAcc=0;fpsN=0;fpsT=0;}
  let dt=rdt;
  if(paused||phase==='matchEnd')dt=0;
  if(hitstop>0&&dt>0){hitstop-=dt;dt=0;}
  if(inMatch()&&!paused){
    const sens=.0022*S.sens;let dy=-mdx*sens;if(committed(player)){const cap=TURN_CAP*rdt;dy=clamp(dy,-cap,cap);}camYaw+=dy;camPitch=clamp(camPitch-mdy*sens,-1.35,1.35);
    if(K.ArrowLeft)camYaw+=2.4*rdt;if(K.ArrowRight)camYaw-=2.4*rdt;
  }
  mdx=mdy=0;
  if(dt>0){
    now+=dt;
    if(inMatch()){
      updatePhase(dt);
      if(player.state!=='dead')player.yaw=camYaw;
      let mx=0,mz=0;const fz=-Math.sin(player.yaw),fzz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);
      let f=0,s=0;if(K.KeyW||K.ArrowUp)f++;if(K.KeyS||K.ArrowDown)f--;if(K.KeyD)s++;if(K.KeyA)s--;
      if(phase==='countdown')f=s=0;
      mx=fz*f+rx*s;mz=fzz*f+rz*s;
      let sp=4.2*speedMul(player);
      if((K.ShiftLeft||K.ShiftRight)&&f>0&&player.st>1&&player.state==='idle'){sp=6.4;spend(player,16*dt);}
      moveFighter(player,mx,mz,sp,dt);
      const b=mode==='training'?trainBot.update(dt):ai.update(dt);moveFighter(bot,b.mx,b.mz,(mode==='training'?3.4:BOT_CFG[CFG.diff].speed)*speedMul(bot),dt);
      if(mode==='match'){fpsFrames++;fpsTime+=rdt;}
      updateFighter(player,dt);updateFighter(bot,dt);separate();
    }else if(phase==='attract'){bot.yaw+=dt*.25;updateFighter(bot,dt);}
    updateParts(dt);
  }
  // torches
  for(const tc of torches){tc.ph+=rdt*9;const fl=1+Math.sin(tc.ph)*.08+Math.sin(tc.ph*2.3)*.06;tc.l.intensity=1.1*fl;tc.f.scale.setScalar(fl);}
  // knight pose
  if(knight){const g=knight.g;g.position.set(bot.pos.x,0,bot.pos.z);g.rotation.y=bot.yaw;
    updateKnight(knight,bot,poseFor(bot,dt),dt);
    const fl=bot.flash;for(const m of knight.mats)m.emissive.setRGB(fl*.6,fl*.08,fl*.05);
  }
  // camera
  if(inMatch()||phase==='matchEnd'){
    shake=Math.max(0,shake-rdt*2.5);const sh=shake*shake*.35;
    const sp=Math.hypot(player.vel.x,player.vel.z);const bob=Math.sin(player.walk*2.6)*.04*Math.min(1,sp/4);
    let eye=EYE_H+bob,roll=0;
    let pitchAdd=0,back=0;
    // first-person death follows the finishing blow: overhead → slump and look down, slash → keel over sideways, stab → fall back and stare at the sky
    if(player.state==='dead'){const k=easeOut(Math.min(1,player.deadT/.8)),ty=player.killType||'over';eye=lerp(EYE_H,.35,k);
      if(ty==='stab'){pitchAdd=1.1*k;back=.45*k;roll=.15*k;}else if(ty==='slash'){roll=1.25*k;pitchAdd=-.15*k;}else{pitchAdd=-.55*k;roll=.35*k;}}
    if(player.state==='stun')roll=Math.sin(now*14)*.03;
    if(player.state==='dodge'){const k=1-player.t/player.dur;roll-=(player.dodgeSide||0)*.07*k;eye-=.07*k;}
    camera.position.set(player.pos.x+Math.sin(camYaw)*back+rand(-sh,sh),eye+rand(-sh,sh),player.pos.z+Math.cos(camYaw)*back+rand(-sh,sh));
    camera.rotation.set(clamp(camPitch+pitchAdd,-1.5,1.5)+rand(-sh,sh)*.4,camYaw,roll);
  }else{const a=performance.now()/1000*.12;camera.position.set(Math.sin(a)*9,3.2,Math.cos(a)*9);camera.lookAt(0,1.4,0);}
  sky.position.copy(camera.position);
  // viewmodel
  const showVm=inMatch()&&player.state!=='dead';vmRoot.visible=showVm;
  if(showVm&&vm){vmRoot.position.copy(camera.position);vmRoot.quaternion.copy(camera.quaternion);
    const pz=poseFor(player,dt);const sp=Math.hypot(player.vel.x,player.vel.z);const bx=Math.sin(player.walk*2.6)*.012*Math.min(1,sp/4),by=Math.abs(Math.cos(player.walk*2.6))*.012*Math.min(1,sp/4);
    vm.pivot.position.set(pz.x+bx,pz.y+by,pz.z);vm.pivot.rotation.set(pz.pitch,pz.yaw,pz.roll);vm.wp.spin.rotation.y=pz.spin;updateViewArms();}
  if(inMatch())updateHUD(rdt);
  renderer.clear();renderer.render(scene,camera);renderer.clearDepth();if(showVm)renderer.render(vmScene,camera);
}
requestAnimationFrame(frame);
// debug hook for automated checks: advance the simulation by n frames of 16ms
window.__dtk={player,bot,ai,get phase(){return phase;},get stats(){return stats;},get score(){return score;},startAttack,parryPress,parryRelease,feint,dodge,S,CFG,
  renderRes(docs){resDocs=docs;renderResults();},
  aim(){camYaw=Math.atan2(-(bot.pos.x-player.pos.x),-(bot.pos.z-player.pos.z));},
  run(n){for(let i=0;i<n;i++){const t=performance.now();last=t-16;step(t);}}};
