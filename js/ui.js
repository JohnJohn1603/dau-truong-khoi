// Menu và bảng chỉnh thông số
'use strict';
/* ---------------- menu UI ---------------- */
document.querySelectorAll('.seg').forEach(seg=>{const key=seg.dataset.key;const sync=()=>seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===CFG[key])));
  seg.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;CFG[key]=b.dataset.v;sync();save();if(key==='diff'||key==='bw'){if(phase==='attract'){bot.weapon=WEAPONS[CFG.bw==='axe'?'axe':'sword'];setupKnight();}}});sync();});
$('optInd').checked=CFG.indicator;$('optInd').onchange=e=>{CFG.indicator=e.target.checked;save();};
if(matchMedia('(pointer: coarse)').matches&&!matchMedia('(any-pointer: fine)').matches)$('touchWarn').hidden=false;
const TUNE=[
  ['parryWindow','Khoảng đỡ chuẩn',80,350,10,v=>v+' ms'],['counterWindow','Khoảng phản đòn khớp loại',120,400,10,v=>v+' ms'],['atkSpeed','Tốc độ đòn',.6,1.6,.05,v=>v.toFixed(2)+'×'],
  ['dmgMul','Sát thương',.5,2,.05,v=>v.toFixed(2)+'×'],['stamRegen','Hồi thể lực',8,45,1,v=>v+' /giây'],
  ['botReact','Thời gian phản xạ của bot',.5,2,.05,v=>v.toFixed(2)+'×'],['hitstop','Khựng hình khi trúng',0,150,5,v=>v+' ms'],
  ['sens','Độ nhạy chuột',.3,2.5,.05,v=>v.toFixed(2)+'×'],['volume','Âm lượng',0,1,.05,v=>Math.round(v*100)+'%']];
const tuneEl=document.createElement('div');tuneEl.className='tune';
function buildTune(){tuneEl.innerHTML='';for(const[k,l,mn,mx,st,fmt]of TUNE){const lab=document.createElement('label');const id='t_'+k;lab.htmlFor=id;
  lab.innerHTML=`<span class="tv"><span>${l}</span><span id="${id}_v">${fmt(S[k])}</span></span><input type="range" id="${id}" min="${mn}" max="${mx}" step="${st}" value="${S[k]}">`;
  lab.querySelector('input').addEventListener('input',e=>{S[k]=parseFloat(e.target.value);lab.querySelector('#'+id+'_v').textContent=fmt(S[k]);if(k==='volume'&&master&&!muted)master.gain.value=S.volume;if(k==='parryWindow')$('pwTxt').textContent=S[k];if(k==='counterWindow')$('cwTxt').textContent=S[k];save();});tuneEl.appendChild(lab);}
  const r=document.createElement('button');r.type='button';r.className='ghost';r.textContent='Về mặc định';r.onclick=()=>{Object.assign(S,DEF);buildTune();$('pwTxt').textContent=S.parryWindow;$('cwTxt').textContent=S.counterWindow;if(master&&!muted)master.gain.value=S.volume;save();};tuneEl.appendChild(r);}
buildTune();$('pwTxt').textContent=S.parryWindow;$('cwTxt').textContent=S.counterWindow;
function mountTune(host){$(host).appendChild(tuneEl);}
mountTune('tuneHostMenu');
