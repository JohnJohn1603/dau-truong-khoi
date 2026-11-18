// Lưu kết quả tester và trang tổng hợp cổng Giai đoạn 1
'use strict';
/* ---------------- tester results (db) ---------------- */
// Each viewer writes one document results/<their id> holding their sessions; only the owner/editors can read everyone's.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function testerName(){return($('testerName').value||'').trim().slice(0,32)||'Ẩn danh';}
$('testerName').value=CFG.name||'';$('testerName').addEventListener('change',()=>{CFG.name=$('testerName').value.trim().slice(0,32);save();});
const Data={db:null,user:null,uid:null,writable:true,cache:null,chain:Promise.resolve(),canRead:false};
function setSave(msg,kind){const el=$('saveState');el.textContent=msg;el.className='savest'+(kind?' '+kind:'');}
(async()=>{
  try{
    if(!window.claude||!window.claude.use)return;
    const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    Data.db=db;Data.user=user;
    if(user){Data.uid=await user.id();const ed=await user.canEdit();if(ed){Data.canRead=true;$('resBtn').hidden=false;}const c=await user.can('data.write');if(c===false)Data.writable=false;}
  }catch(e){}
})();
function canSave(){return!!(Data.db&&Data.uid&&Data.writable);}
function persist(entry){
  entry.tester=testerName();
  if(!canSave()){setSave('Không tự lưu được ở tài khoản này. Bấm "Sao chép kết quả" rồi dán vào nhóm chat.','warn');return;}
  setSave('Đang lưu…');
  Data.chain=Data.chain.then(async()=>{
    const ref=Data.db.doc('results/'+Data.uid);
    if(!Data.cache){const s=await ref.get();Data.cache=s.exists?JSON.parse(JSON.stringify(s.data())):{};if(!Array.isArray(Data.cache.sessions))Data.cache.sessions=[];}
    const arr=Data.cache.sessions;const copy=JSON.parse(JSON.stringify(entry));const i=arr.findIndex(x=>x.id===copy.id);if(i>=0)arr[i]=copy;else arr.push(copy);
    while(arr.length>400)arr.shift();
    Data.cache.name=testerName();Data.cache.updatedAt=Date.now();
    await ref.set(Data.cache);setSave('Đã lưu kết quả. Cảm ơn bạn!','ok');
  }).catch(e=>{if(e&&e.code==='invalid_argument')Data.writable=false;setSave('Không lưu được. Bấm "Sao chép kết quả" rồi dán vào nhóm chat.','warn');});
}
let resUnsub=null,resDocs=[];
$('resBtn').onclick=()=>{
  $('menu').hidden=true;$('resScr').hidden=false;
  if(!Data.db){$('resNote').textContent='Không đọc được kho kết quả ở chế độ xem này.';return;}
  if(resUnsub)return renderResults();
  $('resNote').textContent='Đang tải kết quả…';
  const timer=setTimeout(()=>{$('resNote').textContent='Chưa tải được kết quả. Có thể mạng chậm, trang sẽ tự cập nhật khi có dữ liệu.';},10000);
  resUnsub=Data.db.collection('results').onSnapshot(snap=>{if(!snap.metadata.fromCache)clearTimeout(timer);resDocs=snap.docs.map(d=>d.data()).filter(Boolean);renderResults();},
    e=>{clearTimeout(timer);$('resNote').textContent='Không đọc được kho kết quả.';});
};
$('resClose').onclick=()=>{$('resScr').hidden=true;$('menu').hidden=false;};
function allSessions(){const seen=new Set(),out=[];for(const d of resDocs){for(const s of(Array.isArray(d.sessions)?d.sessions:[])){if(!s||typeof s!=='object'||seen.has(s.id))continue;seen.add(s.id);out.push(s);}}return out.sort((a,b)=>(a.at||0)-(b.at||0));}
function renderResults(){
  const ss=allSessions(),matches=ss.filter(s=>s.kind==='match'),trains=ss.filter(s=>s.kind==='train');
  const by={};for(const s of ss){const n=String(s.tester||'Ẩn danh');(by[n]=by[n]||[]).push(s);}
  const names=Object.keys(by);
  $('resNote').textContent=ss.length?`${names.length} tester · ${matches.length} trận · ${trains.length} buổi tập. Cập nhật trực tiếp khi có kết quả mới.`:'Chưa có kết quả nào. Kết quả hiện ở đây khi có người chơi xong một trận hoặc một buổi tập.';
  // gate 1: wants to play again (latest answer per tester)
  let yes=0,ans=0;for(const n of names){const a=by[n].filter(s=>s.kind==='match'&&typeof s.again==='boolean');if(a.length){ans++;if(a[a.length-1].again)yes++;}}
  // gate 2: first easy match won within 5 minutes
  let newOk=0,newN=0;for(const n of names){const e=by[n].find(s=>s.kind==='match'&&s.diff==='easy');if(e){newN++;if(e.win&&e.durS<=300)newOk++;}}
  // gate 3: hard bot needs practice
  const hard=matches.filter(s=>s.diff==='hard');const hardWin=hard.filter(s=>s.win).length;
  // gate 4: fps
  const fpsL=matches.map(s=>s.fps).filter(v=>typeof v==='number');const fpsAvg=fpsL.length?Math.round(fpsL.reduce((a,b)=>a+b,0)/fpsL.length):null;const fpsMin=fpsL.length?Math.min(...fpsL):null;
  const verdict=(ok,n)=>n===0?'<em class="na">Chưa đủ dữ liệu</em>':ok?'<em class="pass">Đạt</em>':'<em class="fail">Chưa đạt</em>';
  $('resGate').innerHTML=[
    `<div>${verdict(ans&&yes/ans>=.7,ans)}<b>${yes}/${ans}</b><span>tester muốn đánh thêm (câu trả lời gần nhất). Cần ít nhất 70%.</span></div>`,
    `<div>${verdict(newN&&newOk===newN,newN)}<b>${newOk}/${newN}</b><span>tester thắng bot Dễ ngay trận Dễ đầu tiên, trong 5 phút.</span></div>`,
    `<div>${verdict(hard.length&&hardWin/hard.length<=.35,hard.length)}<b>${hardWin}/${hard.length}</b><span>trận thắng bot Khó. Tỉ lệ thấp ở buổi đầu nghĩa là phải luyện mới thắng.</span></div>`,
    `<div>${verdict(fpsMin!==null&&fpsMin>=55,fpsL.length)}<b>${fpsAvg===null?'–':fpsAvg+' fps'}</b><span>trung bình, thấp nhất ${fpsMin===null?'–':fpsMin+' fps'}. Cần khoảng 60.</span></div>`
  ].join('');
  const rec=(arr,d)=>{const m=arr.filter(s=>s.kind==='match'&&s.diff===d);return m.length?`${m.filter(s=>s.win).length}/${m.length}`:'–';};
  const head='<tr><th>Tester</th><th>Trận</th><th>Thắng Dễ</th><th>Thắng Vừa</th><th>Thắng Khó</th><th>Phản đòn</th><th>Đỡ chuẩn</th><th>Đổi đòn</th><th>Lách (thoát)</th><th>Muốn chơi tiếp</th><th>Góp ý gần nhất</th></tr>';
  $('resTable').innerHTML=head+(names.length?names.map(n=>{const a=by[n],m=a.filter(s=>s.kind==='match');const sum=k=>m.reduce((x,s)=>x+(Number(s[k])||0),0);
    const lastA=m.filter(s=>typeof s.again==='boolean').pop();const note=a.filter(s=>s.note).pop();
    return `<tr><td>${esc(n)}</td><td>${m.length}</td><td>${rec(a,'easy')}</td><td>${rec(a,'med')}</td><td>${rec(a,'hard')}</td><td>${sum('counters')}</td><td>${sum('perfect')}</td><td>${sum('morphs')}</td><td>${sum('dodges')} (${sum('dodgeAvoids')})</td><td>${lastA?(lastA.again?'Có':'Không'):'–'}</td><td class="note">${esc(note?note.note:'')}</td></tr>`;}).join(''):'<tr><td colspan="11">Chưa có trận nào.</td></tr>');
  const th='<tr><th>Tester</th><th>Buổi tập</th><th>Phản đòn đúng</th><th>Tỉ lệ</th><th>Chém</th><th>Đập</th><th>Đâm</th><th>Bấm trước (TB)</th></tr>';
  const tn=names.filter(n=>by[n].some(s=>s.kind==='train'));
  $('resTrain').innerHTML=th+(tn.length?tn.map(n=>{const t=by[n].filter(s=>s.kind==='train');const at=t.reduce((x,s)=>x+(Number(s.attempts)||0),0),ok=t.reduce((x,s)=>x+(Number(s.ok)||0),0);
    const bt=k=>{let n2=0,o=0;for(const s of t){const b=s.byType&&s.byType[k];if(b){n2+=Number(b.n)||0;o+=Number(b.ok)||0;}}return n2?`${o}/${n2}`:'–';};
    const e=t.filter(s=>typeof s.avgEarly==='number');const avg=e.length?Math.round(e.reduce((x,s)=>x+s.avgEarly,0)/e.length)+' ms':'–';
    return `<tr><td>${esc(n)}</td><td>${t.length}</td><td>${ok}/${at}</td><td>${at?Math.round(ok/at*100)+'%':'–'}</td><td>${bt('slash')}</td><td>${bt('over')}</td><td>${bt('stab')}</td><td>${avg}</td></tr>`;}).join(''):'<tr><td colspan="8">Chưa có buổi tập nào.</td></tr>');
}
$('importBtn').onclick=()=>{
  const lines=$('importBox').value.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.startsWith('DTK|'));let n=0;
  if(!lines.length){$('importState').textContent='Không thấy dòng nào bắt đầu bằng DTK|.';return;}
  if(!canSave()){$('importState').textContent='Tài khoản này không ghi được vào kho kết quả.';return;}
  for(const l of lines){try{const o=JSON.parse(l.slice(4));if(!o||(o.kind!=='match'&&o.kind!=='train')||typeof o.id!=='string')continue;
    const clean={};for(const k in o){const v=o[k];if(typeof v==='number'||typeof v==='boolean'||v===null)clean[k]=v;else if(typeof v==='string')clean[k]=v.slice(0,400);else if(k==='byType'&&v&&typeof v==='object')clean[k]=JSON.parse(JSON.stringify(v));}
    clean.imported=true;const nm=String(o.tester||'Ẩn danh').slice(0,32);
    Data.chain=Data.chain.then(async()=>{const ref=Data.db.doc('results/'+Data.uid);if(!Data.cache){const s=await ref.get();Data.cache=s.exists?JSON.parse(JSON.stringify(s.data())):{};if(!Array.isArray(Data.cache.sessions))Data.cache.sessions=[];}
      const arr=Data.cache.sessions;clean.tester=nm;const i=arr.findIndex(x=>x.id===clean.id);if(i>=0)arr[i]=clean;else arr.push(clean);});n++;}catch(e){}}
  Data.chain=Data.chain.then(async()=>{Data.cache.updatedAt=Date.now();await Data.db.doc('results/'+Data.uid).set(Data.cache);$('importState').textContent=`Đã thêm ${n} kết quả.`;$('importBox').value='';})
    .catch(()=>{$('importState').textContent='Không thêm được kết quả.';});
};
