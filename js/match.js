// Luồng trận: vào trận, hiệp, kết thúc, tạm dừng, màn hình cuối trận
'use strict';
/* ---------------- match flow ---------------- */
function enterArena(){
  $('menu').hidden=true;$('endScr').hidden=true;$('pause').hidden=true;$('trainScr').hidden=true;$('hud').hidden=false;paused=false;
  matchStart=now;fpsFrames=0;fpsTime=0;startRound();requestLock();canvas.focus();
}
// who is in the arena: one bot for a duel, two for a three-way free-for-all
function setRoster(n){
  while(bots.length<n)bots.push(makeFighter(true));bots.length=n;fighters=[player,...bots];
  brains=bots.map(b=>makeBrain(b));ai=brains[0];
  const ffa=n>1;
  bots.forEach((b,i)=>{const meta=ffa?FFA_BOTS[i]:{name:BOT_NAMES[CFG.diff],short:'Bot',tab:TABARD[CFG.diff]};
    b.name=meta.name;b.short=meta.short;b.tab=meta.tab;b.windMul=1;b.wins=0;b.hist=[];b.ghost=null;});
  player.wins=0;player.name='Bạn';player.short='Bạn';
}
const pickW=()=>WEAPONS[CFG.bw==='rand'?(Math.random()<.5?'sword':'axe'):CFG.bw];
function startMatch(){
  initAudio();resetStats();score={p:0,b:0};round=1;mode='match';
  setRoster(CFG.gm==='ffa3'?2:1);
  player.weapon=WEAPONS[CFG.pw];for(const b of bots)b.weapon=pickW();
  setupKnight();setupViewmodel();
  $('botName').textContent=bots.length>1?'Đánh tự do · 3 người':BOT_NAMES[CFG.diff]+' · '+bot.weapon.name;$('botDiff').textContent=BOT_CFG[CFG.diff].name;$('wpnName').textContent=player.weapon.name;
  $('trainHud').hidden=true;$('bBars').hidden=false;$('quitBtn').textContent='Về menu';
  enterArena();
}
function resetF(f,x,z,yaw){f.pos.set(x,0,z);f.vel.set(0,0,0);f.yaw=yaw;f.hp=100;f.st=100;setState(f,'idle');f.buffer=null;f.riposteUntil=0;f.lastParryRelease=-9;f.deadT=0;f.flash=0;Object.assign(f.pose,POSE.idle);}
function startRound(){
  if(fighters.length===2){resetF(player,0,4.5,0);resetF(bot,0,-4.5,Math.PI);}
  else{// spread everyone on a circle, all facing the middle
    fighters.forEach((f,i)=>{const a=Math.PI/2+i*2*Math.PI/fighters.length,r=5;resetF(f,Math.cos(a)*r,Math.sin(a)*r,Math.atan2(Math.cos(a),Math.sin(a)));});}
  camYaw=player.yaw;camPitch=0;for(const b of brains)b.reset();for(const b of bots){b.hist=[];}
  phase='countdown';phaseT=0;lastCd=-1;for(const k of knights)k.g.rotation.set(0,Math.PI,0);}
let lastCd=-1;
function updatePhase(dt){
  phaseT+=dt;
  if(phase==='countdown'){const n=3-Math.floor(phaseT);const cd=$('cd');if(n>0){cd.hidden=false;cd.textContent=n;if(n!==lastCd){SFX.tick();lastCd=n;}}else{cd.hidden=true;phase='fight';phaseT=0;SFX.bell();popup(`Hiệp ${round}`,'');for(const b of brains)b.nextAttackAt=now+rand(.6,1.2);}}
  else if(phase==='roundEnd'&&phaseT>2.6){
    if(fighters.some(f=>(f.wins||0)>=3))endMatch();else{round++;startRound();}}
}
function endMatch(){
  phase='matchEnd';$('hud').hidden=true;if(document.pointerLockElement)document.exitPointerLock();
  const ffa=fighters.length>2,win=(player.wins||0)>=3;
  $('endEyebrow').textContent=ffa?`Kết thúc trận · Đánh tự do 3 người · bot ${BOT_CFG[CFG.diff].name}`:`Kết thúc trận · ${BOT_CFG[CFG.diff].name} · ${player.weapon.name} đấu ${bot.weapon.name}`;
  $('endTitle').textContent=win?'Chiến thắng':'Thất bại';
  if(ffa)$('endSub').textContent='Số hiệp thắng: '+[...fighters].sort((a,b)=>(b.wins||0)-(a.wins||0)).map(f=>`${f.name} ${f.wins||0}`).join(' · ')+'.';
  else $('endSub').textContent=win?`Bạn hạ ${BOT_NAMES[CFG.diff]} với tỉ số ${score.p} – ${score.b}.`:`${BOT_NAMES[CFG.diff]} thắng ${score.b} – ${score.p}. Thử đỡ sớm hơn một chút, hoặc nhử đòn rồi đánh khi bot đang giữ đỡ.`;
  const acc=stats.swings?Math.round(stats.hits/stats.swings*100):0;
  const rows=[[stats.hits+'/'+stats.swings,'Đòn trúng / vung'],[acc+'%','Tỉ lệ trúng'],[Math.round(stats.dmg),'Sát thương gây ra'],[stats.counters,'Phản đòn khớp loại'],[stats.perfect,'Đỡ chuẩn'],[stats.blocks,'Đỡ thường'],[stats.broken,'Bị vỡ thế'],[stats.feintBaits,'Nhử trúng'],[stats.taken,'Lần dính đòn'],[stats.kills,'Hạ gục'],[stats.botCounters+' / '+stats.botPerfect,'Bot phản đòn / đỡ chuẩn']];
  rows.splice(8,0,[stats.morphs+' / '+stats.morphBaits,'Đổi đòn / lừa trúng'],[stats.dodges+' / '+stats.dodgeAvoids,'Lách / lách thoát']);
  $('endStats').innerHTML=rows.map(r=>`<div><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('');
  const entry={id:newId(),kind:'match',gm:ffa?'ffa3':'duel',ping:S.ping,tester:testerName(),at:Date.now(),diff:CFG.diff,pw:player.weapon.id,bw:bot.weapon.id,sp:score.p,sb:score.b,win,
    durS:Math.round(now-matchStart),fps:fpsTime>0?Math.round(fpsFrames/fpsTime):null,again:null,note:''};
  for(const k of['swings','hits','counters','perfect','blocks','broken','feintBaits','morphs','morphBaits','dodges','dodgeAvoids','taken','botCounters','botPerfect','botMorphs','botDodges','botDodgeAvoids','kills'])entry[k]=stats[k];
  showEnd(entry,true);$('againBtn').textContent='Đấu lại';
  persist(entry);
}
let endEntry=null,endIsMatch=true;
function showEnd(entry,isMatch){
  endEntry=entry;endIsMatch=isMatch;$('againQ').hidden=!isMatch;
  $('againYes').setAttribute('aria-pressed','false');$('againNo').setAttribute('aria-pressed','false');
  $('fbNote').value='';$('copyBox').hidden=true;setSave('');$('endScr').hidden=false;
}
function pause(){if(!inMatch())return;paused=true;$('pause').hidden=false;mountTune('tuneHostPause');for(const k in K)K[k]=false;rmb=fkey=false;parryRelease(player);}
function resume(){paused=false;$('pause').hidden=true;if(!lockFailed)requestLock();canvas.focus();}
function toMenu(){paused=false;phase='attract';mode='match';setRoster(1);$('pause').hidden=true;$('endScr').hidden=true;$('trainScr').hidden=true;$('resScr').hidden=true;$('hud').hidden=true;$('menu').hidden=false;mountTune('tuneHostMenu');if(document.pointerLockElement)document.exitPointerLock();resetF(bot,0,0,Math.PI);setupKnight();}
$('startBtn').onclick=startMatch;$('menuBtn').onclick=toMenu;$('resumeBtn').onclick=resume;
$('againBtn').onclick=()=>{if(endIsMatch)startMatch();else startTraining();};
$('quitBtn').onclick=()=>{if(mode==='training')endTraining();else toMenu();};
$('trainBtn').onclick=()=>{$('menu').hidden=true;$('trainScr').hidden=false;};
$('trainBack').onclick=()=>{$('trainScr').hidden=true;$('menu').hidden=false;};
$('trainStart').onclick=startTraining;
$('againYes').onclick=()=>answerAgain(true);$('againNo').onclick=()=>answerAgain(false);
function answerAgain(v){if(!endEntry)return;endEntry.again=v;endEntry.note=$('fbNote').value.trim();$('againYes').setAttribute('aria-pressed',String(v));$('againNo').setAttribute('aria-pressed',String(!v));persist(endEntry);}
$('fbSend').onclick=()=>{if(!endEntry)return;endEntry.note=$('fbNote').value.trim();persist(endEntry);};
$('copyRes').onclick=()=>{
  if(!endEntry)return;endEntry.note=$('fbNote').value.trim();endEntry.tester=testerName();
  const text='DTK|'+JSON.stringify(endEntry);const box=$('copyBox');box.value=text;
  const fallback=()=>{box.hidden=false;box.focus();box.select();setSave('Chưa sao chép tự động được. Chữ đã được chọn sẵn ở ô bên dưới, bấm Ctrl+C để sao chép.','warn');};
  try{navigator.clipboard.writeText(text).then(()=>setSave('Đã sao chép. Dán vào nhóm chat gửi người làm game.','ok'),fallback);}catch(e){fallback();}
};
