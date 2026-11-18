// Phòng tập phản đòn khớp loại: bot đứng trước mặt ra đòn đều, không gây sát thương.
import { $, ATK_NAME, CFG, S, clamp, rand } from './config.js';
import { bot, player, setPhase, sim } from './core.js';
import { initAudio } from './effects.js';
import { enterArena, resetStats, setRoster, showEnd } from './match.js';
import { setupKnight, setupViewmodel } from './models.js';
import { esc, newId, persist, testerName } from './results.js';
import { G } from './state.js';
import { WEAPONS } from '@dtk/shared';
// Bot được điều khiển bằng một Controller thay cho bộ não; kết quả từng lần thử đến từ sự kiện của lõi (xem effects.js).
/* ---------------- training room (phản đòn khớp loại) ---------------- */
export const trainBot={next:0,
  update(dt){const f=bot,pl=player,t=sim.now;const dx=pl.pos.x-f.pos.x,dz=pl.pos.z-f.pos.z,dist=Math.hypot(dx,dz);
    sim.turnToward(f,pl.pos.x,pl.pos.z,6,dt);
    if(sim.phase!=='fight')return{mx:0,mz:0,speed:3.4};
    if(f.state==='idle'&&t>=this.next&&dist<f.weapon.slash.range+.15){
      const ty=CFG.tType==='rand'?['slash','stab','over'][Math.random()*3|0]:CFG.tType;f.st=100;
      if(sim.startAttack(f,ty))this.next=t+f.dur+f.atk.rel+f.atk.rec+rand(1.1,1.7);
    }
    const fwd=clamp((dist-1.9)*1.6,-1,1);const s=Math.sin(f.yaw),co=Math.cos(f.yaw);return{mx:-s*fwd,mz:-co*fwd,speed:3.4};}
};
export function trainResult(ok,title,sub,kind,type,early){
  const ts=G.tstats;if(!ts)return;
  if(ok!==null){ts.attempts++;const b=ts.byType[type];b.n++;if(ok){ts.ok++;b.ok++;ts.earlySum+=early;}}
  $('thLast').textContent=title;$('thLast').className='big '+kind;$('thSub').textContent=sub;
  const pct=ts.attempts?Math.round(ts.ok/ts.attempts*100):0;
  const per=['slash','over','stab'].map(k=>{const b=ts.byType[k];return b.n?`${ATK_NAME[k]} ${b.ok}/${b.n}`:null;}).filter(Boolean).join(' · ');
  $('thTally').textContent=`Phản đòn đúng ${ts.ok}/${ts.attempts} (${pct}%)`+(ts.ok?` · bấm trước trung bình ${Math.round(ts.earlySum/ts.ok)} ms`:'')+(per?` — ${per}`:'');
}
export function startTraining(){
  initAudio();resetStats();G.score={p:0,b:0};G.mode='training';
  G.tstats={attempts:0,ok:0,earlySum:0,byType:{slash:{n:0,ok:0},over:{n:0,ok:0},stab:{n:0,ok:0}}};
  setRoster(1);player.weapon=WEAPONS[CFG.pw];bot.weapon=WEAPONS.sword;bot.windMul=CFG.tSpeed==='slow'?1.5:1;
  sim.noDamage=true;trainBot.next=0;sim.controllers.set(bot,trainBot);
  setupKnight();setupViewmodel();
  $('wpnName').textContent=player.weapon.name;$('bBars').hidden=true;$('trainHud').hidden=false;$('quitBtn').textContent='Kết thúc buổi tập';
  $('thLast').textContent='Chờ bot ra đòn…';$('thLast').className='big info';
  $('thSub').textContent=`Bấm đúng nút của đòn bot đang ra, trong ${S.counterWindow} ms trước khi chạm. Esc để kết thúc.`;$('thTally').textContent='';
  enterArena();
}
export function endTraining(){
  const ts=G.tstats;
  setPhase('matchEnd');G.paused=false;$('pause').hidden=true;$('hud').hidden=true;if(document.pointerLockElement)document.exitPointerLock();
  const pct=ts.attempts?Math.round(ts.ok/ts.attempts*100):0;
  const entry={id:newId(),kind:'train',tester:testerName(),at:Date.now(),tType:CFG.tType,tSpeed:CFG.tSpeed,durS:Math.round(sim.now-G.matchStart),attempts:ts.attempts,ok:ts.ok,
    avgEarly:ts.ok?Math.round(ts.earlySum/ts.ok):null,byType:JSON.parse(JSON.stringify(ts.byType)),counterWindow:S.counterWindow,note:''};
  $('endEyebrow').textContent='Phòng tập phản đòn';$('endTitle').textContent='Buổi tập xong';
  $('endSub').textContent=ts.attempts?`Phản đòn đúng ${ts.ok}/${ts.attempts} lần (${pct}%) trong ${Math.max(1,Math.round(entry.durS/60))} phút.`:'Bạn chưa thử lần nào.';
  const rows=[[`${ts.ok}/${ts.attempts}`,'Phản đòn đúng'],[pct+'%','Tỉ lệ đúng'],[entry.avgEarly===null?'–':entry.avgEarly+' ms','Bấm trước khi chạm (trung bình)']]
    .concat(['slash','over','stab'].map(k=>[`${ts.byType[k].ok}/${ts.byType[k].n}`,ATK_NAME[k]]));
  $('endStats').innerHTML=rows.map(r=>`<div><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('');
  showEnd(entry,false);
  $('againBtn').textContent='Tập tiếp';
  if(ts.attempts>0)persist(entry);
}
