// Tiện ích, thông số chỉnh được, bảng vũ khí và cấu hình bot
import { DEFAULT_TUNING } from '@dtk/shared';
export const $=id=>document.getElementById(id);
export const rand=(a,b)=>a+Math.random()*(b-a);
export const rr=a=>rand(a[0],a[1]);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const angWrap=d=>{while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
export const easeOut=t=>1-(1-t)*(1-t);

/* ---------------- settings ---------------- */
// gameplay tuning from the shared core, plus client-only settings (simulated ping, hit stop, mouse, volume)
export const DEF={...DEFAULT_TUNING,ping:0,hitstop:70,sens:1,volume:.6};
export const S=Object.assign({},DEF);
export const CFG={gm:'duel',diff:'med',pw:'sword',bw:'rand',indicator:true,tType:'rand',tSpeed:'slow',name:''};
try{const s=JSON.parse(localStorage.getItem('dtk-settings')||'{}');Object.assign(S,s.S||{});Object.assign(CFG,s.CFG||{});}catch(e){}
export function save(){try{localStorage.setItem('dtk-settings',JSON.stringify({S,CFG}));}catch(e){}}

/* ---------------- labels ---------------- */
export const ATK_NAME={slash:'Chém ngang',stab:'Đâm xiên',over:'Đập thẳng'};
export const KEY_OF={slash:'chuột trái',stab:'cuộn xuống',over:'cuộn lên'};
export const BOT_NAMES={easy:'Lính Gác Rơm',med:'Hiệp Sĩ Xám',hard:'Kiếm Sư Đỏ'};
export const TABARD={easy:0x8a7a4a,med:0x4b5a78,hard:0x8e2222};
// free-for-all opponents: name, short name for the score line, tabard colour
export const FFA_BOTS=[{name:'Hiệp Sĩ Xám',short:'Xám',tab:0x4b5a78},{name:'Kiếm Sư Đỏ',short:'Đỏ',tab:0x8e2222},{name:'Lính Gác Rơm',short:'Rơm',tab:0x8a7a4a}];
