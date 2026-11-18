// Âm thanh tự tạo, hạt (máu, tia lửa) và HUD
import * as THREE from 'three';
import { $, ATK_NAME, CFG, KEY_OF, S, lerp, rand } from './config.js';
import { bot, bots, brainOf, byId, fighters, phase, player, relAngle } from './core.js';
import { viewOf } from './main.js';
import { endMatch, onRoundStart, syncScore } from './match.js';
import { G } from './state.js';
import { trainResult } from './training.js';
import { camera, scene } from './world.js';
/* ---------------- audio ---------------- */
export let AC=null,master=null,noiseBuf=null;
export function initAudio(){if(AC){if(AC.state==='suspended')AC.resume();return;}try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=G.muted?0:S.volume;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}catch(e){AC=null;}}
export function nz(dur,type,f0,f1,q,gain,pan=0){if(!AC)return;const t=AC.currentTime;const s=AC.createBufferSource();s.buffer=noiseBuf;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);fl.Q.value=q;
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);let node=s.connect(fl).connect(g);
  if(AC.createStereoPanner&&pan){const p=AC.createStereoPanner();p.pan.value=pan;node=node.connect(p);}node.connect(master);s.start(t);s.stop(t+dur+.05);}
export function tone(freq,dur,type,gain,f1){if(!AC)return;const t=AC.currentTime;const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(master);o.start(t);o.stop(t+dur+.05);}
export const SFX={
  whoosh(h,far){nz(h?.3:.2,'bandpass',h?280:480,h?1300:2300,1.3,far?.22:.32);},
  clang(p){[1180,1790,2630].concat(p?[3520]:[]).forEach(f=>tone(f*rand(.98,1.02),p?.65:.35,'sine',p?.16:.09));nz(.06,'highpass',3000,6500,.7,.35);if(p)tone(880,.55,'triangle',.08);},
  block(){tone(420,.12,'square',.05);nz(.12,'bandpass',900,500,2,.45);},
  hit(){tone(150,.18,'sine',.45,45);nz(.15,'lowpass',1800,250,1,.55);},
  breakG(){nz(.4,'lowpass',2600,180,1,.6);tone(95,.3,'sawtooth',.12,40);},
  boom(){nz(1.5,'lowpass',700,50,1,.9);tone(58,1.1,'sine',.55,28);},
  bell(){tone(660,1.3,'sine',.14);tone(990,.8,'sine',.05);},
  tick(){tone(520,.08,'square',.04);},
  feint(){nz(.08,'bandpass',800,400,2,.15);},
  dodge(far){const v=far?.6:1;nz(.16,'bandpass',600,1500,1.4,.2*v);nz(.07,'lowpass',400,120,1,.25*v);},
  // distinct wind-up cue per attack type so it can be read by ear early
  tell(type,loud){const v=loud?1:.45;
    if(type==='slash'){nz(.16,'bandpass',900,2600,3,.22*v);}
    else if(type==='over'){tone(170,.2,'triangle',.22*v,105);nz(.18,'lowpass',500,200,1,.18*v);}
    else{tone(1250,.05,'square',.06*v);tone(1650,.05,'square',.05*v);}}
};

/* ---------------- particles ---------------- */
export const parts=[];export const pGeo=new THREE.BoxGeometry(.06,.06,.06);
export const pMat={blood:new THREE.MeshLambertMaterial({color:0x9c1a12}),spark:new THREE.MeshBasicMaterial({color:0xffd27a})};
for(let i=0;i<90;i++){const m=new THREE.Mesh(pGeo,pMat.blood);m.visible=false;scene.add(m);parts.push({m,v:new THREE.Vector3(),life:0});}
export function emit(pos,n,kind){let c=0;for(const p of parts){if(p.life>0)continue;p.m.material=pMat[kind];p.m.position.copy(pos);p.v.set(rand(-1,1),rand(.3,1.5),rand(-1,1)).multiplyScalar(kind==='spark'?4:2.4);p.life=kind==='spark'?rand(.2,.45):rand(.4,.8);p.m.visible=true;p.m.scale.setScalar(kind==='spark'?.7:rand(.8,1.6));if(++c>=n)break;}}
export const blood=(p,n)=>emit(p,n,'blood'),sparks=(p,n)=>emit(p,n,'spark');
export function updateParts(dt){for(const p of parts){if(p.life<=0)continue;p.life-=dt;p.v.y-=9.8*dt;p.m.position.addScaledVector(p.v,dt);if(p.m.position.y<.03){p.m.position.y=.03;p.v.set(0,0,0);}if(p.life<=0)p.m.visible=false;}}

/* ---------------- HUD helpers ---------------- */
export const popEl=$('popups');export let hintT=0;
export function popup(text,kind=''){const d=document.createElement('div');d.className='pop '+kind;d.textContent=text;popEl.appendChild(d);while(popEl.children.length>3)popEl.firstChild.remove();setTimeout(()=>d.remove(),950);}
// world point between attacker and defender at chest height, for sparks and blood
export function midpoint(a,b){return new THREE.Vector3(lerp(a.pos.x,b.pos.x,.55),1.45,lerp(a.pos.z,b.pos.z,.55));}
export function dmgNum(f,v){const p=new THREE.Vector3(f.pos.x,2.1,f.pos.z);p.project(camera);if(p.z>1)return;const d=document.createElement('div');d.className='dmg';d.textContent=typeof v==='number'?'−'+v:v;d.style.left=((p.x+1)/2*innerWidth+rand(-20,20))+'px';d.style.top=((1-p.y)/2*innerHeight)+'px';$('hud').appendChild(d);setTimeout(()=>d.remove(),820);}
export function showHint(t,sec){const h=$('hint');h.textContent=t;h.hidden=false;hintT=sec;}
export const IND={slash:['→','Chém ngang · phản: chuột trái'],stab:['●','Đâm xiên · phản: cuộn xuống'],over:['↓','Đập thẳng · phản: cuộn lên']};
// the enemy whose bars are shown: the one in front of you, else the nearest one still standing
export function focusEnemy(){if(bots.length===1)return bot;let best=null,bs=1e9;
  for(const b of bots){if(b.state==='dead')continue;const {ang,dist}=relAngle(player,b.pos);const s=dist+(Math.abs(ang)<.6?0:6);if(s<bs){bs=s;best=b;}}
  return best||bots[0];}
export let shownFocus=null;
export function updateHUD(dt){
  $('hpP').style.transform=`scaleX(${player.hp/100})`;$('stP').style.transform=`scaleX(${player.st/100})`;$('hpPt').textContent=Math.ceil(player.hp);
  const fe=focusEnemy();
  if(bots.length>1&&fe!==shownFocus){shownFocus=fe;$('botName').textContent=fe.name+' · '+fe.weapon.name;}
  $('hpB').style.transform=`scaleX(${fe.hp/100})`;$('stB').style.transform=`scaleX(${fe.st/100})`;
  $('stPw').classList.toggle('low',player.st<20);$('stBw').classList.toggle('low',fe.st<20);
  $('score').textContent=fighters.length>2?fighters.map(f=>`${f.short} ${f.wins||0}`).join(' · '):`${G.score.p} – ${G.score.b}`;
  // incoming swings aimed at you (as you see them, i.e. with the simulated ping): the nearest one drives the indicator,
  // and one from outside your view shows a side warning
  let inc=null,id=1e9,side=null;
  for(const b of bots){const v=viewOf(b);if(v.state!=='windup'||v.state==='dead')continue;const br=brainOf(b);if(br&&br.tg!==player&&bots.length>1)continue;
    const {ang,dist}=relAngle(player,v.pos);if(dist>4)continue;
    if(Math.abs(ang)>.9&&(!side||dist<side.dist))side={ang,dist};
    if(dist<id){id=dist;inc=v;}}
  const ind=$('ind');
  if(CFG.indicator&&inc&&phase==='fight'){ind.hidden=false;const[g,l]=IND[inc.atkType];$('indG').textContent=g;$('indL').textContent=(inc.morphed?'Đổi sang · ':'')+l+(inc.riposte?' · phản đòn':'');$('indP').style.transform=`scaleX(${1-inc.t/inc.dur})`;}else ind.hidden=true;
  const sw=$('sideWarn');
  if(side&&phase==='fight'){sw.hidden=false;sw.textContent=Math.abs(side.ang)>2.3?'⬇ Đòn từ phía sau':(side.ang>0?'Đòn từ bên phải ➡':'⬅ Đòn từ bên trái');sw.dataset.dir=Math.abs(side.ang)>2.3?'back':(side.ang>0?'right':'left');}else sw.hidden=true;
  G.hurt=Math.max(0,G.hurt-dt*2.2);$('vign').style.opacity=player.state==='dead'?.85:G.hurt*.9+(player.hp<30?.25:0);
  if(hintT>0){hintT-=dt;if(hintT<=0)$('hint').hidden=true;}
  $('cross').style.opacity=player.state==='parry'?.25:.75;
}

/* ---------------- sim events → sound, particles, popups, stats, training feedback ---------------- */
// The shared core only reports what happened; everything the player sees or hears about it is decided here.
export function handleEvents(evts){
  const st=G.stats,tr=G.mode==='training';
  for(const e of evts){
    const att=e.att!=null?byId(e.att):null,def=e.def!=null?byId(e.def):null,f=e.f!=null?byId(e.f):null;
    const pInv=att===player||def===player;
    switch(e.k){
      case'swing':SFX.tell(e.type,f.isBot);if(f===player&&st)st.swings++;break;
      case'morph':SFX.tell(e.type,f.isBot);if(st){if(f===player)st.morphs++;else st.botMorphs++;}break;
      case'release':SFX.whoosh(e.heavy,f.isBot);break;
      case'feint':SFX.feint();if(f===player&&e.baited){if(st)st.feintBaits++;popup('Nhử trúng','good');}break;
      case'dodge':SFX.dodge(f.isBot);if(st){if(f===player)st.dodges++;else st.botDodges++;}break;
      case'noStamina':if(f===player)popup('Hết thể lực','warn');break;
      case'dodgeNotReady':if(f===player)popup('Chưa lách được','warn');break;
      case'dodgeOut':
        if(def===player){if(st)st.dodgeAvoids++;if(!tr)popup('Lách thoát','good');}else if(att===player){if(st)st.botDodgeAvoids++;popup('Bot lách thoát','info');}
        if(tr&&att===bot)trainResult(null,'Lách thoát','Lách tránh được đòn. Bài này tập phản đòn nên không tính.','info',e.type,null);break;
      case'whiff':if(tr&&att===bot)trainResult(null,'Đòn hụt','Đứng gần bot hơn (khoảng 2 bước).','info',e.type,null);break;
      case'counter':
        SFX.clang(true);sparks(midpoint(att,def),22);G.hitstop=S.hitstop*1.4/1000;G.shake=Math.max(G.shake,.3);
        if(def===player){if(st)st.counters++;popup('Phản đòn','good');}else if(att===player){if(st)st.botCounters++;popup('Bot phản đòn','bad');}
        if(tr&&att===bot)trainResult(true,'Phản đòn đúng',`Bấm trước khi chạm ${e.early} ms`,'good',e.type,e.early);break;
      case'perfect':
        SFX.clang(false);sparks(midpoint(att,def),12);G.hitstop=S.hitstop/1000;G.shake=Math.max(G.shake,.15);
        if(def===player){if(st)st.perfect++;popup('Đỡ chuẩn','good');}else if(att===player){if(st)st.botPerfect++;popup('Bot đỡ chuẩn','info');}
        if(tr&&att===bot)trainResult(false,'Đỡ chuẩn bằng chuột phải',`Trước khi chạm ${e.early} ms. Thử bấm nút ${KEY_OF[e.type]} để phản đòn.`,'info',e.type,null);break;
      case'block':
        SFX.block();sparks(midpoint(att,def),6);
        if(tr&&att===bot)trainResult(false,'Đỡ thường',`Bấm đỡ sớm ${e.early} ms, quá khoảng chuẩn. Bài này tập bấm nút ${KEY_OF[e.type]}.`,'info',e.type,null);
        if(def===player){if(st)st.blocks++;if(!tr)popup(e.type==='over'?'Đỡ được · mất nhiều sức':'Đã đỡ','info');G.shake=Math.max(G.shake,.12);}break;
      case'guardBreak':
        SFX.breakG();bleed(att,def,e.dmg,tr);
        if(def===player){if(st)st.broken++;popup('Vỡ thế','bad');}else if(att===player)popup('Phá thế đỡ','good');break;
      case'hit':
        if(tr&&att===bot){
          if(e.defState==='windup'&&e.defAtkType!==e.type)trainResult(false,'Sai loại đòn',`Bạn ra ${ATK_NAME[e.defAtkType]}, bot ra ${ATK_NAME[e.type]} (nút ${KEY_OF[e.type]}).`,'bad',e.type,null);
          else if(e.defState==='windup')trainResult(false,'Sớm quá',`Bấm trước khi chạm ${e.early} ms, khoảng phản đòn là ${S.counterWindow} ms.`,'bad',e.type,e.early);
          else if(e.defState==='recovery'||e.defState==='release')trainResult(false,'Đang hồi đòn','Bạn vừa vung đòn khác nên không kịp phản.','bad',e.type,null);
          else trainResult(false,'Chưa bấm kịp',`Bot ra ${ATK_NAME[e.type]}: bấm ${KEY_OF[e.type]} ngay trước khi chạm.`,'bad',e.type,null);
        }
        if(e.morphBait){if(def===player)popup('Bot đổi đòn lừa bạn','bad');else if(att===player){if(st)st.morphBaits++;popup('Đổi đòn lừa trúng','good');}}
        bleed(att,def,e.dmg,tr);break;
      case'interrupt':if(att===player)popup('Ngắt đòn','good');break;
      case'stun':if(pInv)popup(def===player?'Bạn bị choáng':'Choáng',def===player?'bad':'good');break;
      case'kill':{SFX.boom();if(att===player&&st)st.kills++;const ffa=fighters.length>2;
        popup(def===player?'Bạn đã ngã':(ffa?`${def.name} đã ngã`:'Hạ gục'),def===player?'bad':(ffa?'info':'good'));break;}
      case'roundEnd':syncScore();if(fighters.length>2){const w=e.winner!=null?byId(e.winner):null;
        setTimeout(()=>popup(w===player?'Bạn thắng hiệp':(w?`${w.name} thắng hiệp`:'Hoà'),w===player?'good':'bad'),350);}break;
      case'roundStart':onRoundStart();break;
      case'countdown':{const cd=$('cd');cd.hidden=false;cd.textContent=e.n;SFX.tick();break;}
      case'fight':$('cd').hidden=true;SFX.bell();popup(`Hiệp ${e.round}`,'');break;
      case'matchEnd':if(G.mode==='match')endMatch();break;
    }
  }
}
// blood, hit stop, shake, damage numbers and the player's hit / taken counts for one landed blow
export function bleed(att,def,dmg,tr){
  const st=G.stats;SFX.hit();blood(midpoint(att,def),tr?8:14);G.hitstop=S.hitstop/1000;
  if(tr){if(def===player){G.hurt=.5;G.shake=Math.max(G.shake,.2);}else dmgNum(def,'trúng');return;}
  if(att===player){if(st){st.hits++;st.dmg+=dmg;}dmgNum(def,Math.round(dmg));G.shake=Math.max(G.shake,.1);}
  if(def===player){if(st)st.taken++;G.shake=Math.max(G.shake,.4);G.hurt=1;}
}
