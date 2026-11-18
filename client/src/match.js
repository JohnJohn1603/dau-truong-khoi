// Luồng trận phía client: chọn đội hình, vào trận, màn hình cuối trận, tạm dừng.
import { $, BOT_NAMES, CFG, FFA_BOTS, S, TABARD } from './config.js';
import { bot, bots, fighters, inMatch, parryRelease, player, setPhase, sim, syncCore } from './core.js';
import { handleEvents, initAudio } from './effects.js';
import { clearInput, pointerFree, requestLock } from './input.js';
import { knights, setupKnight, setupViewmodel } from './models.js';
import { esc, newId, persist, setSave, testerName } from './results.js';
import { G } from './state.js';
import { openNet, netLeaveMatch, net } from './net.js';
import { endTraining, startTraining } from './training.js';
import { mountTune } from './ui.js';
import { canvas } from './world.js';
import { BOT_CFG, WEAPONS } from '@dtk/shared';
// Đếm ngược, hiệp và thắng thua do lõi chiến đấu quyết định; ở đây chỉ phản ứng với sự kiện của nó.
/* ---------------- match flow ---------------- */
export const resetStats=()=>{G.stats={swings:0,hits:0,dmg:0,perfect:0,counters:0,blocks:0,broken:0,taken:0,feintBaits:0,morphs:0,morphBaits:0,
  botPerfect:0,botCounters:0,botMorphs:0,dodges:0,dodgeAvoids:0,botDodges:0,botDodgeAvoids:0,kills:0};};
export const pickW=()=>WEAPONS[CFG.bw==='rand'?(Math.random()<.5?'sword':'axe'):CFG.bw];
// who is in the arena: one bot for a duel or training, two for a three-way free-for-all
export function setRoster(n){
  const ffa=n>1;
  sim.setRoster(Array.from({length:n},(_,i)=>{const m=ffa?FFA_BOTS[i]:{name:BOT_NAMES[CFG.diff],short:'Bot',tab:TABARD[CFG.diff]};return{...m,weapon:pickW()};}));
  syncCore();
  for(const b of bots){b.hist=[];b.ghost=null;b.pose=null;}
  player.name='Bạn';player.short='Bạn';
}
export function syncScore(){G.score.p=player.wins||0;G.score.b=Math.max(0,...bots.map(b=>b.wins||0));}
export function enterArena(){
  $('menu').hidden=true;$('endScr').hidden=true;$('pause').hidden=true;$('trainScr').hidden=true;$('hud').hidden=false;G.paused=false;
  G.matchStart=sim.now;G.fpsFrames=0;G.fpsTime=0;
  sim.startMatch();syncCore();handleEvents(sim.drain());requestLock();canvas.focus();
}
export function startMatch(){
  initAudio();resetStats();G.score={p:0,b:0};G.mode='match';
  sim.diff=CFG.diff;sim.noDamage=false;setRoster(CFG.gm==='ffa3'?2:1);
  player.weapon=WEAPONS[CFG.pw];
  setupKnight();setupViewmodel();
  $('botName').textContent=bots.length>1?'Đánh tự do · 3 người':BOT_NAMES[CFG.diff]+' · '+bot.weapon.name;$('botDiff').textContent=BOT_CFG[CFG.diff].name;$('wpnName').textContent=player.weapon.name;
  $('trainHud').hidden=true;$('bBars').hidden=false;$('quitBtn').textContent='Về menu';
  enterArena();
}
// a new round has been set up by the sim: point the camera the way the player now faces, forget old interpolation and poses
export function onRoundStart(){
  G.camYaw=player.yaw;G.camPitch=0;
  for(const f of fighters){f.pose=null;if(f.isBot){f.hist=[];f.ghost=null;}}
  for(const k of knights)k.g.rotation.set(0,Math.PI,0);
}
export function endMatch(){
  const st=G.stats;
  $('hud').hidden=true;if(document.pointerLockElement)document.exitPointerLock();
  const ffa=fighters.length>2,win=(player.wins||0)>=3,online=G.mode==='net';syncScore();
  $('endEyebrow').textContent=online?`Kết thúc trận · Phòng ${net.code} · qua mạng`:ffa?`Kết thúc trận · Đánh tự do 3 người · bot ${BOT_CFG[CFG.diff].name}`:`Kết thúc trận · ${BOT_CFG[CFG.diff].name} · ${player.weapon.name} đấu ${bot.weapon.name}`;
  $('endTitle').textContent=win?'Chiến thắng':'Thất bại';
  if(ffa)$('endSub').textContent='Số hiệp thắng: '+[...fighters].sort((a,b)=>(b.wins||0)-(a.wins||0)).map(f=>`${f.name} ${f.wins||0}`).join(' · ')+'.';
  else $('endSub').textContent=win?`Bạn hạ ${BOT_NAMES[CFG.diff]} với tỉ số ${G.score.p} – ${G.score.b}.`:`${BOT_NAMES[CFG.diff]} thắng ${G.score.b} – ${G.score.p}. Thử đỡ sớm hơn một chút, hoặc nhử đòn rồi đánh khi bot đang giữ đỡ.`;
  const acc=st.swings?Math.round(st.hits/st.swings*100):0;
  const rows=[[st.hits+'/'+st.swings,'Đòn trúng / vung'],[acc+'%','Tỉ lệ trúng'],[Math.round(st.dmg),'Sát thương gây ra'],[st.counters,'Phản đòn khớp loại'],[st.perfect,'Đỡ chuẩn'],[st.blocks,'Đỡ thường'],[st.broken,'Bị vỡ thế'],[st.feintBaits,'Nhử trúng'],
    [st.morphs+' / '+st.morphBaits,'Đổi đòn / lừa trúng'],[st.dodges+' / '+st.dodgeAvoids,'Lách / lách thoát'],[st.taken,'Lần dính đòn'],[st.kills,'Hạ gục'],[st.botCounters+' / '+st.botPerfect,'Bot phản đòn / đỡ chuẩn']];
  $('endStats').innerHTML=rows.map(r=>`<div><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join('');
  const entry={id:newId(),kind:'match',gm:online?'net3':ffa?'ffa3':'duel',ping:online?Math.round(net.rtt*1000):S.ping,tester:testerName(),at:Date.now(),diff:CFG.diff,pw:player.weapon.id,bw:bot.weapon.id,sp:G.score.p,sb:G.score.b,win,
    durS:Math.round(sim.now-G.matchStart),fps:G.fpsTime>0?Math.round(G.fpsFrames/G.fpsTime):null,again:null,note:''};
  for(const k of['swings','hits','counters','perfect','blocks','broken','feintBaits','morphs','morphBaits','dodges','dodgeAvoids','taken','botCounters','botPerfect','botMorphs','botDodges','botDodgeAvoids','kills'])entry[k]=st[k];
  showEnd(entry,true);$('againBtn').textContent=online?'Về phòng chờ':'Đấu lại';$('menuBtn').hidden=online;
  if(online)G.mode='match';endIsNet=online;
  persist(entry);
}
export let endEntry=null,endIsMatch=true,endIsNet=false;
export function showEnd(entry,isMatch){
  endEntry=entry;endIsMatch=isMatch;$('againQ').hidden=!isMatch;
  $('againYes').setAttribute('aria-pressed','false');$('againNo').setAttribute('aria-pressed','false');
  $('fbNote').value='';$('copyBox').hidden=true;setSave('');$('endScr').hidden=false;
}
export function pause(){if(!inMatch())return;G.paused=true;$('pause').hidden=false;mountTune('tuneHostPause');clearInput();parryRelease(player);}
export function resume(){G.paused=false;$('pause').hidden=true;if(!pointerFree())requestLock();canvas.focus();}
export function toMenu(){
  G.paused=false;setPhase('attract');G.mode='match';sim.noDamage=false;setRoster(1);bot.weapon=WEAPONS[CFG.bw==='axe'?'axe':'sword'];
  $('pause').hidden=true;$('endScr').hidden=true;$('trainScr').hidden=true;$('resScr').hidden=true;$('hud').hidden=true;$('menu').hidden=false;
  mountTune('tuneHostMenu');if(document.pointerLockElement)document.exitPointerLock();sim.resetFighter(bot,0,0,Math.PI);setupKnight();
}
$('startBtn').onclick=startMatch;$('menuBtn').onclick=toMenu;$('resumeBtn').onclick=resume;
$('againBtn').onclick=()=>{$('menuBtn').hidden=false;if(endIsNet){endIsNet=false;setPhase('attract');setRoster(1);bot.weapon=WEAPONS[CFG.bw==='axe'?'axe':'sword'];sim.resetFighter(bot,0,0,Math.PI);setupKnight();openNet();}else if(endIsMatch)startMatch();else startTraining();};
$('quitBtn').onclick=()=>{if(G.mode==='training')endTraining();else{if(G.mode==='net')netLeaveMatch();toMenu();}};
$('trainBtn').onclick=()=>{$('menu').hidden=true;$('trainScr').hidden=false;};
$('trainBack').onclick=()=>{$('trainScr').hidden=true;$('menu').hidden=false;};
$('trainStart').onclick=startTraining;
$('againYes').onclick=()=>answerAgain(true);$('againNo').onclick=()=>answerAgain(false);
export function answerAgain(v){if(!endEntry)return;endEntry.again=v;endEntry.note=$('fbNote').value.trim();$('againYes').setAttribute('aria-pressed',String(v));$('againNo').setAttribute('aria-pressed',String(!v));persist(endEntry);}
$('fbSend').onclick=()=>{if(!endEntry)return;endEntry.note=$('fbNote').value.trim();persist(endEntry);};
$('copyRes').onclick=()=>{
  if(!endEntry)return;endEntry.note=$('fbNote').value.trim();endEntry.tester=testerName();
  const text='DTK|'+JSON.stringify(endEntry);const box=$('copyBox');box.value=text;
  const fallback=()=>{box.hidden=false;box.focus();box.select();setSave('Chưa sao chép tự động được. Chữ đã được chọn sẵn ở ô bên dưới, bấm Ctrl+C để sao chép.','warn');};
  try{navigator.clipboard.writeText(text).then(()=>setSave('Đã sao chép. Dán vào nhóm chat gửi người làm game.','ok'),fallback);}catch(e){fallback();}
};
