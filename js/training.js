// Phòng tập phản đòn khớp loại
'use strict';
/* ---------------- training room (phản đòn khớp loại) ---------------- */
let tstats=null;
const trainBot={next:0,
  update(dt){const f=bot,pl=player;const dx=pl.pos.x-f.pos.x,dz=pl.pos.z-f.pos.z,dist=Math.hypot(dx,dz);
    f.yaw+=clamp(angWrap(Math.atan2(-dx,-dz)-f.yaw),-6*dt,6*dt);
    if(phase!=='fight')return{mx:0,mz:0};
    if(f.state==='idle'&&now>=this.next&&dist<f.weapon.slash.range+.15){
      const t=CFG.tType==='rand'?['slash','stab','over'][Math.random()*3|0]:CFG.tType;f.st=100;
      if(startAttack(f,t)){this.pending={type:t};this.next=now+f.dur+f.atk.rel+f.atk.rec+rand(1.1,1.7);}
    }
    // an attack that ended without reaching the player
    if(this.pending&&f.state==='recovery'&&!f.hitDone&&!((player.lastDodge||-9)>=f.atkStart-.05)){trainResult(null,'Đòn hụt','Đứng gần bot hơn (khoảng 2 bước).','info',this.pending.type,null);}
    if(f.state==='recovery'||f.state==='recoil')this.pending=null;
    const fwd=clamp((dist-1.9)*1.6,-1,1);const s=Math.sin(f.yaw),co=Math.cos(f.yaw);return{mx:-s*fwd,mz:-co*fwd};}
};
function trainResult(ok,title,sub,kind,type,early){
  trainBot.pending=null;
  if(ok!==null){tstats.attempts++;const b=tstats.byType[type];b.n++;if(ok){tstats.ok++;b.ok++;tstats.earlySum+=early;}}
  $('thLast').textContent=title;$('thLast').className='big '+kind;$('thSub').textContent=sub;
  const pct=tstats.attempts?Math.round(tstats.ok/tstats.attempts*100):0;
  const per=['slash','over','stab'].map(k=>{const b=tstats.byType[k];return b.n?`${ATK_NAME[k]} ${b.ok}/${b.n}`:null;}).filter(Boolean).join(' · ');
  $('thTally').textContent=`Phản đòn đúng ${tstats.ok}/${tstats.attempts} (${pct}%)`+(tstats.ok?` · bấm trước trung bình ${Math.round(tstats.earlySum/tstats.ok)} ms`:'')+(per?` — ${per}`:'');
}
function startTraining(){
  initAudio();resetStats();score={p:0,b:0};round=1;mode='training';
  tstats={attempts:0,ok:0,earlySum:0,byType:{slash:{n:0,ok:0},over:{n:0,ok:0},stab:{n:0,ok:0}}};
  setRoster(1);player.weapon=WEAPONS[CFG.pw];bot.weapon=WEAPONS.sword;bot.windMul=CFG.tSpeed==='slow'?1.5:1;
  setupKnight();setupViewmodel();
  $('wpnName').textContent=player.weapon.name;$('bBars').hidden=true;$('trainHud').hidden=false;$('quitBtn').textContent='Kết thúc buổi tập';
  $('thLast').textContent='Chờ bot ra đòn…';$('thLast').className='big info';
  $('thSub').textContent=`Bấm đúng nút của đòn bot đang ra, trong ${S.counterWindow} ms trước khi chạm. Esc để kết thúc.`;$('thTally').textContent='';
  trainBot.next=0;trainBot.pending=null;
  enterArena();
}
function endTraining(){
  phase='matchEnd';paused=false;$('pause').hidden=true;$('hud').hidden=true;if(document.pointerLockElement)document.exitPointerLock();
  const pct=tstats.attempts?Math.round(tstats.ok/tstats.attempts*100):0;
  const entry={id:newId(),kind:'train',tester:testerName(),at:Date.now(),tType:CFG.tType,tSpeed:CFG.tSpeed,durS:Math.round(now-matchStart),attempts:tstats.attempts,ok:tstats.ok,
    avgEarly:tstats.ok?Math.round(tstats.earlySum/tstats.ok):null,byType:JSON.parse(JSON.stringify(tstats.byType)),counterWindow:S.counterWindow,note:''};
  $('endEyebrow').textContent='Phòng tập phản đòn';$('endTitle').textContent='Buổi tập xong';
  $('endSub').textContent=tstats.attempts?`Phản đòn đúng ${tstats.ok}/${tstats.attempts} lần (${pct}%) trong ${Math.max(1,Math.round(entry.durS/60))} phút.`:'Bạn chưa thử lần nào.';
  const rows=[[`${tstats.ok}/${tstats.attempts}`,'Phản đòn đúng'],[pct+'%','Tỉ lệ đúng'],[entry.avgEarly===null?'–':entry.avgEarly+' ms','Bấm trước khi chạm (trung bình)']]
    .concat(['slash','over','stab'].map(k=>[`${tstats.byType[k].ok}/${tstats.byType[k].n}`,ATK_NAME[k]]));
  $('endStats').innerHTML=rows.map(r=>`<div><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('');
  showEnd(entry,false);
  $('againBtn').textContent='Tập tiếp';
  if(tstats.attempts>0)persist(entry);
}
