// Bot đấu 3 mức: đỡ, phản đòn, nhử, đổi đòn, di chuyển
'use strict';
/* ---------------- bot AI ---------------- */
const ai={
  reset(){this.nextAttackAt=now+rand(.8,1.4);this.threat=null;this.parryAt=null;this.counterAt=null;this.counterType=null;this.releaseAt=null;this.feintAt=null;this.ripAt=null;this.strafe=Math.random()<.5?1:-1;this.strafeT=now+rand(.8,2);this.forceType=null;this.morphTo=null;this.countering=false;this.morphSeen=null;this.dodgeAt=null;this.dodgeDir=null;this.gapT=0;},
  onEnemyMorph(info){const c=this.cfg();if(c.parryP<=0||bot.state==='dead')return;
    this.parryAt=null;this.counterAt=null;this.dodgeAt=null;
    const impact=info.windEnd+info.rel*IMPACT_P[info.type];
    if(bot.state==='parry'){this.releaseAt=impact+.25;this.threat=null;return;}
    if(bot.state==='windup'&&this.countering&&bot.atkType!==info.type){this.threat=null;if(Math.random()<c.morphCounter)this.morphTo={type:info.type,at:now+rr(c.react)*S.botReact};return;}
    this.threat={perceiveAt:now+rr(c.react)*S.botReact,impact,type:info.type,decided:false};},
  cfg(){return BOT_CFG[CFG.diff];},
  onEnemyAttack(info){const c=this.cfg();if(c.parryP<=0||bot.state==='dead')return;
    this.threat={perceiveAt:now+rr(c.react)*S.botReact,impact:info.windEnd+info.rel*IMPACT_P[info.type],type:info.type,decided:false};},
  onEnemyFeint(){const c=this.cfg();if(!this.threat)return;
    if(this.counterAt!==null&&Math.random()<c.readFeint)this.counterAt=null;
    if(this.dodgeAt!==null&&Math.random()<c.readFeint)this.dodgeAt=null;
    if(bot.state!=='parry'){if(Math.random()<c.readFeint)this.parryAt=null;}
    else if(Math.random()<c.readFeint){this.releaseAt=now+.12;}
    this.threat=null;},
  // perfect parry no longer gives a fast riposte; the bot just attacks straight out of its block
  onPerfectParry(){const c=this.cfg();if(Math.random()<c.ripP){this.ripAt=now+(CFG.diff==='hard'?.02:.12);}},
  update(dt){
    const c=this.cfg(),f=bot,pl=player;
    if(f.state==='dead')return{mx:0,mz:0};
    // face player
    const dx=pl.pos.x-f.pos.x,dz=pl.pos.z-f.pos.z,dist=Math.hypot(dx,dz);
    const want=Math.atan2(-dx,-dz);const turn=Math.min(c.turn*({windup:.6,release:.35,stun:.3}[f.state]??1),committed(f)?TURN_CAP:99);
    f.yaw+=clamp(angWrap(want-f.yaw),-turn*dt,turn*dt);
    if(phase!=='fight')return{mx:0,mz:0};
    // defence
    const th=this.threat;
    if(th&&!th.decided&&now>=th.perceiveAt){th.decided=true;
      if(pl.state==='windup'||pl.state==='release'){
        // lách: back out of a wide slash, sidestep a narrow stab or overhead; more likely when low on stamina
        const wantDodge=c.dodgeP>0&&f.state!=='windup'&&f.st>=S.dodgeCost&&Math.random()<(f.st<35?c.dodgeP*2:c.dodgeP);
        if(wantDodge){this.dodgeAt=Math.max(now,th.impact-rand(.22,.32));
          this.dodgeDir=th.type==='slash'?{side:rand(-.4,.4),fwd:-1}:{side:Math.random()<.5?-1:1,fwd:-.2};}
        else if(Math.random()<c.parryP){
          let ok=true;
          if(f.state==='windup'){const myImpact=now+(f.dur-f.t)+f.atk.rel/S.atkSpeed*IMPACT_P[f.atkType];ok=myImpact>th.impact-.05&&Math.random()<c.cancelP;}
          if(ok&&f.state!=='windup'&&Math.random()<c.counterP){this.counterAt=Math.max(now,th.impact-rr(c.cOffset)*S.counterWindow/250);this.counterType=th.type;}
          else if(ok){const sc=S.parryWindow/200;this.parryAt=Math.max(now,th.impact-rr(c.offset)*sc);this.releaseAt=th.impact+.25+Math.random()*.2;}
        }
      }
    }
    if(this.dodgeAt!==null&&now>=this.dodgeAt){this.dodgeAt=null;const d=this.dodgeDir;dodge(f,d.side,d.fwd);this.threat=null;}
    if(this.counterAt!==null&&now>=this.counterAt){this.counterAt=null;if(f.state==='parry')parryRelease(f);if(startAttack(f,this.counterType))this.countering=true;this.threat=null;}
    if(this.parryAt!==null&&now>=this.parryAt){this.parryAt=null;if(f.state!=='parry')parryPress(f);}
    if(f.state==='parry'&&this.releaseAt!==null&&now>=this.releaseAt){this.releaseAt=null;parryRelease(f);this.threat=null;}
    if(f.state==='parry'&&this.releaseAt===null&&now-f.parryStart>.9)parryRelease(f);
    // riposte
    if(this.ripAt!==null&&now>=this.ripAt){this.ripAt=null;startAttack(f,dist>2.4?'stab':(Math.random()<.6?'slash':'stab'));}
    // feint
    if(this.feintAt!==null&&f.state==='windup'&&now>=this.feintAt){this.feintAt=null;const t=f.atkType;if(feint(f)&&Math.random()<.6){this.forceType=t==='slash'?(Math.random()<.5?'stab':'over'):'slash';this.nextAttackAt=now+.17;}}
    // morph: react to the player winding up a matching counter, or a planned mix-up
    if(c.morphP>0&&f.state==='windup'&&!f.morphed&&!this.countering&&!this.morphTo&&pl.state==='windup'&&pl.atkType===f.atkType&&pl.atkStart>f.atkStart&&this.morphSeen!==pl.atkStart){
      this.morphSeen=pl.atkStart;
      if(Math.random()<c.morphP){const o=['slash','stab','over'].filter(t=>t!==f.atkType);this.morphTo={type:o[Math.random()*2|0],at:now+rr(c.react)*S.botReact};}
    }
    if(this.morphTo&&now>=this.morphTo.at){const m=this.morphTo;this.morphTo=null;if(f.state==='windup')morph(f,m.type);}
    // offence
    const pendingDef=this.parryAt!==null||this.counterAt!==null||this.dodgeAt!==null||(th&&!th.decided);
    // hard bot closes distance with a forward dash
    if(c.gapP>0&&f.state==='idle'&&!pendingDef&&dist>3.4&&dist<6&&f.st>50&&now>this.gapT){this.gapT=now+1.5;if(Math.random()<c.gapP)dodge(f,0,1);}
    const range=f.weapon.slash.range;
    if(f.state==='idle'&&!pendingDef&&now>=this.nextAttackAt&&dist<=range+.3&&f.st>18){
      let type=this.forceType||pick(c.mix);this.forceType=null;
      if(CFG.diff!=='easy'){if(dist>range-.05&&type==='slash')type='stab';if(CFG.diff==='hard'&&pl.state==='parry'&&now-pl.parryStart>.25&&Math.random()<.6)type='over';}
      if(startAttack(f,type)){this.countering=false;this.morphTo=null;
        if(Math.random()<c.feint)this.feintAt=now+f.dur*rand(.45,.7);
        else if(Math.random()<c.morphMix){const o=['slash','stab','over'].filter(t=>t!==type);this.morphTo={type:o[Math.random()*2|0],at:now+f.dur*rand(.35,.55)};}
        this.nextAttackAt=now+f.dur+f.atk.rel+f.atk.rec+rr(c.cd);}
    }
    // movement
    let desired=1.85;if(f.st<25)desired=4;if(pl.state==='dead')desired=2.5;
    if(now>this.strafeT){this.strafe*=-1;this.strafeT=now+rand(.8,2);}
    const fwd=clamp((dist-desired)*1.6,-1,1);const sx=dist<3.5?this.strafe*c.strafe*.7:0;
    // local -> world (bot forward = -sin,-cos)
    const s=Math.sin(f.yaw),co=Math.cos(f.yaw);
    return{mx:-s*fwd+co*sx,mz:-co*fwd-s*sx};
  }
};
function pick(mix){let r=Math.random(),acc=0;for(const k in mix){acc+=mix[k];if(r<=acc)return k;}return Object.keys(mix)[0];}
