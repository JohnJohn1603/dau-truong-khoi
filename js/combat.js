// Trạng thái trận và luật chiến đấu: vung, đổi đòn, nhử, đỡ, phản đòn, trúng đòn
'use strict';
/* ---------------- time / phase ---------------- */
let now=0,phase='attract',phaseT=0,paused=false,hitstop=0,shake=0,score={p:0,b:0},round=1,mode='match',matchStart=0,fpsFrames=0,fpsTime=0;
let stats=null;
const resetStats=()=>{stats={swings:0,hits:0,dmg:0,perfect:0,counters:0,blocks:0,broken:0,taken:0,feintBaits:0,morphs:0,morphBaits:0,botPerfect:0,botCounters:0,botMorphs:0,dodges:0,dodgeAvoids:0,botDodges:0,botDodgeAvoids:0};};
const other=f=>f===player?bot:player;

function setState(f,s,dur){f.state=s;f.t=0;f.dur=dur||0;}
function spend(f,a){f.st=Math.max(0,f.st-a);f.lastSpend=now;}
function relAngle(att,pos){const dx=pos.x-att.pos.x,dz=pos.z-att.pos.z;const s=Math.sin(att.yaw),c=Math.cos(att.yaw);const x=dx*c-dz*s,z=-dx*s-dz*c;return{ang:Math.atan2(x,z),dist:Math.hypot(dx,dz),z};}

function startAttack(f,type){
  if(phase!=='fight'||f.state==='dead')return false;
  if(f.state==='windup'){if(type!==f.atkType&&!f.morphed)return morph(f,type);return false;}
  if(f.state!=='idle'&&f.state!=='parry'){if(['recovery','recoil','feint','release','stun','dodge'].includes(f.state))f.buffer={type,t:now};return false;}
  const a=f.weapon[type];
  if(f.st<1){if(!f.isBot)popup('Hết thể lực','warn');return false;}
  if(f.state==='parry')f.lastParryRelease=now;
  const rip=now<f.riposteUntil;f.riposteUntil=0;
  spend(f,a.cost);f.atkType=type;f.atk=a;f.riposte=rip;f.hitDone=false;f.atkStart=now;f.morphed=false;
  setState(f,'windup',a.wind/S.atkSpeed*(rip?.7:1)*(f.windMul||1));
  SFX.tell(type,f.isBot);
  if(!f.isBot){stats.swings++;ai.onEnemyAttack({type,windEnd:now+f.dur,rel:a.rel/S.atkSpeed});}
  return true;
}
// Đổi đòn giữa chừng: switch to another attack type during wind-up. Costs stamina, adds ~0.1s, once per swing.
function morph(f,type){
  if(f.state!=='windup'||f.morphed||f.t>f.dur-.06||f.st<1)return false;
  const a=f.weapon[type];spend(f,6);
  const rem=Math.max(.22,a.wind/S.atkSpeed*(f.windMul||1)-f.t)+.1;
  f.atkType=type;f.atk=a;f.morphed=true;f.riposte=false;f.hitDone=false;f.atkStart=now;setState(f,'windup',rem);
  SFX.tell(type,f.isBot);
  if(!f.isBot){stats.morphs++;ai.onEnemyMorph({type,windEnd:now+rem,rel:a.rel/S.atkSpeed});}else stats.botMorphs++;
  return true;
}
function feint(f){
  if(f.state!=='windup'||f.t>f.dur-.06)return false;
  spend(f,8);setState(f,'feint',.15);SFX.feint();
  if(!f.isBot){const baited=(bot.state==='parry'&&bot.parryStart>=f.atkStart)||(bot.state==='windup'&&bot.atkStart>=f.atkStart);if(baited){stats.feintBaits++;popup('Nhử trúng','good');}ai.onEnemyFeint();}
  return true;
}
function parryPress(f){
  if(f.state==='dead'||f.state==='stun'||f.state==='release'||f.state==='dodge'||(f.state==='recoil'&&f.t<.2)||f.state==='parry')return false;
  if(phase!=='fight'&&phase!=='countdown')return false;
  if(f.state==='windup'){if(!feint(f))return false;}
  f.perfectOK=(now-f.lastParryRelease)>.35;
  f.buffer=null;setState(f,'parry',0);f.parryStart=now;return true;
}
function parryRelease(f){if(f.state==='parry'){setState(f,'idle');f.lastParryRelease=now;}}
// Lách: a short dash in a direction relative to facing (side, fwd in -1..1; none = backwards).
// Costs stamina, has a cooldown, gives no invulnerability: it only works by leaving the swing's reach or arc.
const DODGE_T=.24;
// Turn cap once a swing is committed (late wind-up and release), in rad/s: a sidestep at the last moment can beat tracking.
const TURN_CAP=1.2;
const committed=f=>f.state==='release'||(f.state==='windup'&&f.t>f.dur*.6);
function dodge(f,side,fwd){
  if(phase!=='fight'||f.state==='dead')return false;
  const ok=f.state==='idle'||f.state==='parry'||f.state==='feint'||(f.state==='recovery'&&f.t>f.dur*.6);
  if(!ok)return false;
  if(now<(f.dodgeReady||0)){if(!f.isBot)popup('Chưa lách được','warn');return false;}
  if(f.st<S.dodgeCost){if(!f.isBot)popup('Hết thể lực','warn');return false;}
  if(!side&&!fwd)fwd=-1;const l=Math.hypot(side,fwd);side/=l;fwd/=l;
  if(f.state==='parry')parryRelease(f);
  spend(f,S.dodgeCost);f.buffer=null;
  const s=Math.sin(f.yaw),c=Math.cos(f.yaw),sp=fwd>.5?7.5:(Math.abs(side)>.5?9.5:8.5);
  f.vel.set((-s*fwd+c*side)*sp,0,(-c*fwd-s*side)*sp);
  f.dodgeSide=side;f.dodgeFwd=fwd;f.lastDodge=now;f.dodgeReady=now+S.dodgeCD;
  setState(f,'dodge',DODGE_T);SFX.dodge(f.isBot);
  if(!f.isBot)stats.dodges++;else stats.botDodges++;
  return true;
}

function updateFighter(f,dt){
  const o=other(f);f.t+=dt;f.flash=Math.max(0,f.flash-dt*4);
  switch(f.state){
    case'windup':if(f.t>=f.dur){setState(f,'release',f.atk.rel/S.atkSpeed);SFX.whoosh(f.atkType==='over'||f.weapon.id==='axe',f.isBot);}break;
    case'release':{const p0=clamp((f.t-dt)/f.dur,0,1),p1=clamp(f.t/f.dur,0,1);if(!f.hitDone&&o.state!=='dead')hitCheck(f,o,p0,p1);if(f.state==='release'&&f.t>=f.dur){if(!f.hitDone&&(o.lastDodge||-9)>=f.atkStart-.05&&o.state!=='dead')dodgedOut(f,o);setState(f,'recovery',f.atk.rec/S.atkSpeed);}break;}
    case'recovery':case'feint':case'recoil':case'stun':case'dodge':if(f.t>=f.dur)setState(f,'idle');break;
    case'parry':if(now-f.parryStart>S.parryWindow/1000){f.st=Math.max(0,f.st-5*dt);}break;
    case'dead':f.deadT+=dt;break;
  }
  if(f.state==='idle'&&f.buffer){if(now-f.buffer.t<.3){const b=f.buffer;f.buffer=null;startAttack(f,b.type);}else f.buffer=null;}
  if(f.state!=='parry'&&f.state!=='dead'&&now-f.lastSpend>.8)f.st=Math.min(100,f.st+S.stamRegen*dt);
}
// an attack ran out without touching anyone who dodged during it
function dodgedOut(att,def){
  if(!def.isBot){stats.dodgeAvoids++;if(mode!=='training')popup('Lách thoát','good');}else{stats.botDodgeAvoids++;popup('Bot lách thoát','info');}
  if(mode==='training'&&att===bot)trainResult(null,'Lách thoát','Lách tránh được đòn. Bài này tập phản đòn nên không tính.','info',att.atkType,null);
}
// a thrust or chop must meet the body itself, not the whole collision circle (tolerance ×0.7)
function hitCheck(att,def,p0,p1){
  const a=att.atk,{ang,dist,z}=relAngle(att,def.pos);
  if(dist-def.radius>a.range||z<-.2)return;
  const tol=Math.atan2(def.radius*(att.atkType==='slash'?1:.7),Math.max(dist,.3));const half=a.arc*Math.PI/360;let hit=false;
  if(att.atkType==='slash'){const b0=half-2*half*p0,b1=half-2*half*p1;hit=ang<=b0+tol&&ang>=b1-tol;}
  else if(att.atkType==='stab'){hit=p1>=.3&&Math.abs(ang)<=half+tol;}
  else{hit=p1>=.55&&Math.abs(ang)<=half+tol;}
  if(hit)resolveHit(att,def);
}
function resolveHit(att,def){
  att.hitDone=true;const a=att.atk,type=att.atkType;
  const front=Math.abs(relAngle(def,att.pos).ang)<80*Math.PI/180;
  const dmg=a.dmg*S.dmgMul;
  const tr=mode==='training'&&att===bot;
  const early=Math.round((now-def.atkStart)*1000);
  // Phản đòn khớp loại: defender started the SAME attack type just before impact -> deflect for free, attacker recoils, defender's swing turns into a fast riposte
  if(def.state==='windup'&&def.atkType===type&&front&&(now-def.atkStart)*1000<=S.counterWindow){
    setState(att,'recoil',.45);att.buffer=null;
    def.st=Math.min(100,def.st+def.atk.cost);def.riposte=true;def.hitDone=false;setState(def,'windup',def.atk.wind/S.atkSpeed*.45);
    SFX.clang(true);sparks(midpoint(att,def),22);hitstop=S.hitstop*1.4/1000;shake=Math.max(shake,.3);
    if(!def.isBot){stats.counters++;popup('Phản đòn','good');}else{stats.botCounters++;popup('Bot phản đòn','bad');}
    if(tr)trainResult(true,'Phản đòn đúng',`Bấm trước khi chạm ${early} ms`,'good',type,early);
    return;
  }
  if(def.state==='parry'&&front){
    const perfect=def.perfectOK&&(now-def.parryStart)*1000<=S.parryWindow;
    const pEarly=Math.round((now-def.parryStart)*1000);
    if(perfect){
      // reduced reward (option b): free block, no fast riposte
      setState(att,'recovery',a.rec/S.atkSpeed);att.buffer=null;
      SFX.clang(false);sparks(midpoint(att,def),12);hitstop=S.hitstop/1000;shake=Math.max(shake,.15);
      if(!def.isBot){stats.perfect++;popup('Đỡ chuẩn','good');}else{stats.botPerfect++;popup('Bot đỡ chuẩn','info');ai.onPerfectParry();}
      if(tr)trainResult(false,'Đỡ chuẩn bằng chuột phải',`Trước khi chạm ${pEarly} ms. Thử bấm nút ${KEY_OF[type]} để phản đòn.`,'info',type,null);
      return;
    }
    const cost=dmg*.55*(type==='over'?1.6:1)*def.weapon.blockCost*att.weapon.drainMul;
    if(tr)trainResult(false,'Đỡ thường',`Bấm đỡ sớm ${pEarly} ms, quá khoảng chuẩn. Bài này tập bấm nút ${KEY_OF[type]}.`,'info',type,null);
    if(def.st>=cost){
      spend(def,cost);SFX.block();sparks(midpoint(att,def),6);setState(att,'recovery',a.rec/S.atkSpeed*.8);
      def.vel.addScaledVector(dirFrom(att,def),2);
      if(!def.isBot){stats.blocks++;if(!tr)popup(type==='over'?'Đỡ được · mất nhiều sức':'Đã đỡ','info');shake=Math.max(shake,.12);}
      return;
    }
    def.st=0;setState(def,'stun',.8);damage(def,dmg*.5,att);SFX.breakG();
    if(!def.isBot){stats.broken++;popup('Vỡ thế','bad');}else popup('Phá thế đỡ','good');
    return;
  }
  if(tr){
    if(def.state==='windup'&&def.atkType!==type)trainResult(false,'Sai loại đòn',`Bạn ra ${ATK_NAME[def.atkType]}, bot ra ${ATK_NAME[type]} (nút ${KEY_OF[type]}).`,'bad',type,null);
    else if(def.state==='windup')trainResult(false,'Sớm quá',`Bấm trước khi chạm ${early} ms, khoảng phản đòn là ${S.counterWindow} ms.`,'bad',type,early);
    else if(def.state==='recovery'||def.state==='release')trainResult(false,'Đang hồi đòn','Bạn vừa vung đòn khác nên không kịp phản.','bad',type,null);
    else trainResult(false,'Chưa bấm kịp',`Bot ra ${ATK_NAME[type]}: bấm ${KEY_OF[type]} ngay trước khi chạm.`,'bad',type,null);
  }
  if(att.morphed&&def.state==='windup'&&def.atkType!==type){if(att.isBot){popup('Bot đổi đòn lừa bạn','bad');}else{stats.morphBaits++;popup('Đổi đòn lừa trúng','good');}}
  damage(def,dmg,att);
  if(def.state==='dead')return;
  if(def.state==='windup'){setState(def,'stun',.25);if(def.isBot)popup('Ngắt đòn','good');}
  else if(type==='over'&&def.state!=='stun'){setState(def,'stun',a.stun);popup(def.isBot?'Choáng':'Bạn bị choáng',def.isBot?'good':'bad');}
}
function midpoint(a,b){const m=a.pos.clone().lerp(b.pos,.55);m.y=1.45;return m;}
function dirFrom(a,b){return tmpV2.set(b.pos.x-a.pos.x,0,b.pos.z-a.pos.z).normalize();}
function damage(def,dmg,att){
  if(mode==='training'){def.flash=1;SFX.hit();blood(midpoint(att,def),8);hitstop=S.hitstop/1000;if(!def.isBot){hurt=.5;shake=Math.max(shake,.2);}else dmgNum(def,'trúng');return;}
  def.hp=Math.max(0,def.hp-dmg);def.flash=1;def.vel.addScaledVector(dirFrom(att,def),3);
  SFX.hit();blood(midpoint(att,def),14);hitstop=S.hitstop/1000;
  if(def.isBot){stats.hits++;stats.dmg+=dmg;dmgNum(def,Math.round(dmg));shake=Math.max(shake,.1);}
  else{stats.taken++;shake=Math.max(shake,.4);hurt=1;}
  if(def.hp<=0){def.killType=att.atkType;kill(def);} // the finishing blow decides how the body falls
}
function kill(f){setState(f,'dead');f.deadT=0;SFX.boom();
  if(f.isBot){score.p++;popup('Hạ gục','good');}else{score.b++;popup('Bạn đã ngã','bad');}
  phase='roundEnd';phaseT=0;}
