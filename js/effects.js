// Âm thanh tự tạo, hạt (máu, tia lửa) và HUD
'use strict';
/* ---------------- audio ---------------- */
let AC=null,master=null,noiseBuf=null;
function initAudio(){if(AC){if(AC.state==='suspended')AC.resume();return;}try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:S.volume;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}catch(e){AC=null;}}
function nz(dur,type,f0,f1,q,gain,pan=0){if(!AC)return;const t=AC.currentTime;const s=AC.createBufferSource();s.buffer=noiseBuf;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);fl.Q.value=q;
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);let node=s.connect(fl).connect(g);
  if(AC.createStereoPanner&&pan){const p=AC.createStereoPanner();p.pan.value=pan;node=node.connect(p);}node.connect(master);s.start(t);s.stop(t+dur+.05);}
function tone(freq,dur,type,gain,f1){if(!AC)return;const t=AC.currentTime;const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(master);o.start(t);o.stop(t+dur+.05);}
const SFX={
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
const parts=[];const pGeo=new THREE.BoxGeometry(.06,.06,.06);
const pMat={blood:new THREE.MeshLambertMaterial({color:0x9c1a12}),spark:new THREE.MeshBasicMaterial({color:0xffd27a})};
for(let i=0;i<90;i++){const m=new THREE.Mesh(pGeo,pMat.blood);m.visible=false;scene.add(m);parts.push({m,v:new THREE.Vector3(),life:0});}
function emit(pos,n,kind){let c=0;for(const p of parts){if(p.life>0)continue;p.m.material=pMat[kind];p.m.position.copy(pos);p.v.set(rand(-1,1),rand(.3,1.5),rand(-1,1)).multiplyScalar(kind==='spark'?4:2.4);p.life=kind==='spark'?rand(.2,.45):rand(.4,.8);p.m.visible=true;p.m.scale.setScalar(kind==='spark'?.7:rand(.8,1.6));if(++c>=n)break;}}
const blood=(p,n)=>emit(p,n,'blood'),sparks=(p,n)=>emit(p,n,'spark');
function updateParts(dt){for(const p of parts){if(p.life<=0)continue;p.life-=dt;p.v.y-=9.8*dt;p.m.position.addScaledVector(p.v,dt);if(p.m.position.y<.03){p.m.position.y=.03;p.v.set(0,0,0);}if(p.life<=0)p.m.visible=false;}}

/* ---------------- HUD helpers ---------------- */
const popEl=$('popups');let hurt=0,hintT=0;
function popup(text,kind=''){const d=document.createElement('div');d.className='pop '+kind;d.textContent=text;popEl.appendChild(d);while(popEl.children.length>3)popEl.firstChild.remove();setTimeout(()=>d.remove(),950);}
function dmgNum(f,v){const p=f.pos.clone();p.y=2.1;p.project(camera);if(p.z>1)return;const d=document.createElement('div');d.className='dmg';d.textContent=typeof v==='number'?'−'+v:v;d.style.left=((p.x+1)/2*innerWidth+rand(-20,20))+'px';d.style.top=((1-p.y)/2*innerHeight)+'px';$('hud').appendChild(d);setTimeout(()=>d.remove(),820);}
function showHint(t,sec){const h=$('hint');h.textContent=t;h.hidden=false;hintT=sec;}
const IND={slash:['→','Chém ngang · phản: chuột trái'],stab:['●','Đâm xiên · phản: cuộn xuống'],over:['↓','Đập thẳng · phản: cuộn lên']};
function updateHUD(dt){
  $('hpP').style.transform=`scaleX(${player.hp/100})`;$('stP').style.transform=`scaleX(${player.st/100})`;$('hpPt').textContent=Math.ceil(player.hp);
  $('hpB').style.transform=`scaleX(${bot.hp/100})`;$('stB').style.transform=`scaleX(${bot.st/100})`;
  $('stPw').classList.toggle('low',player.st<20);$('stBw').classList.toggle('low',bot.st<20);
  $('score').textContent=`${score.p} – ${score.b}`;
  const ind=$('ind');
  if(CFG.indicator&&bot.state==='windup'&&phase==='fight'){ind.hidden=false;const[g,l]=IND[bot.atkType];$('indG').textContent=g;$('indL').textContent=(bot.morphed?'Đổi sang · ':'')+l+(bot.riposte?' · phản đòn':'');$('indP').style.transform=`scaleX(${1-bot.t/bot.dur})`;}else ind.hidden=true;
  hurt=Math.max(0,hurt-dt*2.2);$('vign').style.opacity=player.state==='dead'?.85:hurt*.9+(player.hp<30?.25:0);
  if(hintT>0){hintT-=dt;if(hintT<=0)$('hint').hidden=true;}
  $('cross').style.opacity=player.state==='parry'?.25:.75;
}
