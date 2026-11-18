// Tiện ích, thông số chỉnh được, bảng vũ khí và cấu hình bot
'use strict';
const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a);
const rr=a=>rand(a[0],a[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const angWrap=d=>{while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
const easeOut=t=>1-(1-t)*(1-t);

/* ---------------- settings ---------------- */
const DEF={parryWindow:200,counterWindow:250,dodgeCost:14,dodgeCD:.75,atkSpeed:1,dmgMul:1,stamRegen:22,botReact:1,hitstop:70,sens:1,volume:.6};
const S=Object.assign({},DEF);
const CFG={diff:'med',pw:'sword',bw:'rand',indicator:true,dblTap:true,tType:'rand',tSpeed:'slow',name:''};
try{const s=JSON.parse(localStorage.getItem('dtk-settings')||'{}');Object.assign(S,s.S||{});Object.assign(CFG,s.CFG||{});}catch(e){}
function save(){try{localStorage.setItem('dtk-settings',JSON.stringify({S,CFG}));}catch(e){}}

/* ---------------- combat data ---------------- */
const WEAPONS={
  sword:{id:'sword',name:'Kiếm',blockCost:1.0,drainMul:1.0,
    slash:{wind:.49,rel:.22,rec:.32,dmg:28,range:2.35,arc:110,cost:12},
    stab:{wind:.50,rel:.14,rec:.38,dmg:33,range:2.75,arc:14,cost:10},
    over:{wind:.63,rel:.20,rec:.45,dmg:40,range:2.3,arc:30,cost:16,stun:.45}},
  axe:{id:'axe',name:'Rìu',blockCost:1.15,drainMul:1.3,
    slash:{wind:.57,rel:.26,rec:.40,dmg:34,range:2.25,arc:100,cost:15},
    stab:{wind:.54,rel:.16,rec:.42,dmg:24,range:2.3,arc:14,cost:11},
    over:{wind:.73,rel:.22,rec:.52,dmg:52,range:2.25,arc:28,cost:20,stun:.6}}
};
const ATK_NAME={slash:'Chém ngang',stab:'Đâm xiên',over:'Đập thẳng'};
const KEY_OF={slash:'chuột trái',stab:'cuộn xuống',over:'cuộn lên'};
const IMPACT_P={slash:.5,stab:.35,over:.6};
const BOT_CFG={
  easy:{name:'Dễ',turn:2.6,speed:3.3,cd:[1.3,2.3],mix:{slash:1},parryP:0,react:[.3,.4],offset:[0,0],counterP:0,cOffset:[0,0],feint:0,ripP:0,readFeint:0,cancelP:0,strafe:.3,morphP:0,morphMix:0,morphCounter:0,dodgeP:0,gapP:0},
  med:{name:'Vừa',turn:4.2,speed:3.8,cd:[.8,1.6],mix:{slash:.5,stab:.25,over:.25},parryP:.62,react:[.22,.34],offset:[0,.42],counterP:.15,cOffset:[0,.36],feint:0,ripP:.4,readFeint:.15,cancelP:.3,strafe:.6,morphP:.1,morphMix:.06,morphCounter:0,dodgeP:.15,gapP:0},
  hard:{name:'Khó',turn:6.5,speed:4.2,cd:[.45,1.1],mix:{slash:.4,stab:.3,over:.3},parryP:.9,react:[.15,.22],offset:[.03,.18],counterP:.5,cOffset:[.04,.2],feint:.28,ripP:.8,readFeint:.6,cancelP:.8,strafe:1,morphP:.6,morphMix:.2,morphCounter:.5,dodgeP:.3,gapP:.35}
};
const BOT_NAMES={easy:'Lính Gác Rơm',med:'Hiệp Sĩ Xám',hard:'Kiếm Sư Đỏ'};
const TABARD={easy:0x8a7a4a,med:0x4b5a78,hard:0x8e2222};
