// Mô hình vũ khí, hiệp sĩ, tư thế vung đòn và dữ liệu người đấu
'use strict';
/* ---------------- weapons & knights ---------------- */
function buildWeapon(kind){
  const w=new THREE.Group();const spin=new THREE.Group();w.add(spin);
  const M=c=>new THREE.MeshLambertMaterial({color:c});
  const steel=M(0xcdd4dc),wood=M(0x5b3f25),gold=M(0xb8913a),darkSteel=M(0x8e979f);
  const b=(sx,sy,sz,m,x,y,z)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);me.position.set(x,y,z);me.castShadow=true;spin.add(me);return me;};
  if(kind==='sword'){b(.05,.24,.05,wood,0,.02,0);b(.085,.07,.085,gold,0,-.12,0);b(.32,.05,.07,gold,0,.16,0);b(.075,.9,.025,steel,0,.64,0);b(.012,.86,.03,darkSteel,0,.62,0);b(.045,.08,.022,steel,0,1.12,0);}
  else{b(.055,1.08,.055,wood,0,.36,0);b(.05,.2,.09,darkSteel,0,.8,-.06);b(.04,.34,.16,steel,0,.8,-.18);b(.03,.42,.05,steel,0,.8,-.28);b(.04,.08,.12,darkSteel,0,.82,.08);b(.07,.06,.07,darkSteel,0,-.17,0);}
  return {w,spin};
}
/* ---- knight: chibi proportions, bone hierarchy, pixel armour textures ---- */
// g (feet at y=0, front = -z) → legL/legR (hip pivots), torso (twists at the belt) → pauldrons/tabard,
// head (neck pivot, follows torso a little) → eyes; arms are 2-bone IK chains from the torso's shoulders to the hand target.
const K_DIM={hipY:.58,torsoY:.62,shX:.42,shY:.48,neckY:1.2,armA:.36,armB:.36};
const shade=(h,k)=>{const c=hex2rgb(h).map(v=>clamp(Math.round(v*k),0,255));return(c[0]<<16)|(c[1]<<8)|c[2];};
const KTEX={};
const kTex=(key,fn)=>KTEX[key]||(KTEX[key]=mkTex(fn));
// plate: dark 1px rim + bright inner bevel on top/left + corner rivets → reads as a chamfered block
const plateFn=base=>g=>{const edge=shade(base,.58),hi=shade(base,1.22);for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const rim=x===0||y===0||x===15||y===15,bev=(y===1||x===1)&&!rim,low=(y===14||x===14)&&!rim,riv=(x===3||x===12)&&(y===3||y===12);
  px(g,x,y,rim?edge:riv?shade(base,.75):bev?hi:low?shade(base,.85):base,.05);}};
const mailFn=base=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const rim=x===0||x===15;px(g,x,y,rim?shade(base,.6):(x+(y>>1))%2?shade(base,1.18):shade(base,.82),.06);}};
const clothFn=base=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const rim=x===0||x===15||y===0,trim=y>=13;
  px(g,x,y,trim?(y===13?0x7a5c22:0xc9a046):rim?shade(base,.68):(x===7||x===8)&&y>3&&y<11?shade(base,1.25):base,.07);}};
const leatherFn=base=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const rim=y===0||y===15,buckle=x>=6&&x<=9&&y>=4&&y<=11,hole=x>=7&&x<=8&&y>=6&&y<=9;
  px(g,x,y,hole?shade(base,.7):buckle?0xc9a046:rim?shade(base,.6):base,.1);}};
function buildKnight(tab){
  const g=new THREE.Group();
  const L=t=>new THREE.MeshLambertMaterial({map:t});
  const steel=L(kTex('steel',plateFn(0x9aa3ac))),dark=L(kTex('dark',plateFn(0x4a5058))),mail=L(kTex('mail',mailFn(0x5d636b))),
    tabM=L(kTex('cloth'+tab,clothFn(tab))),leather=L(kTex('leather',leatherFn(0x6a4a32))),
    plume=L(kTex('plume'+tab,fill(shade(tab,1.15),.12))),slit=new THREE.MeshLambertMaterial({color:0x121418});
  const mats=[steel,dark,mail,tabM,leather,plume,slit];
  const bx=(sx,sy,sz,m,x,y,z,p=g)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);me.position.set(x,y,z);me.castShadow=true;p.add(me);return me;};
  // legs: short and chunky
  const leg=x=>{const p=new THREE.Group();p.position.set(x,K_DIM.hipY,0);g.add(p);
    bx(.25,.36,.27,mail,0,-.18,0,p);bx(.27,.14,.29,steel,0,-.3,-.02,p);bx(.29,.17,.36,dark,0,-.495,-.04,p);return p;};
  const legL=leg(-.15),legR=leg(.15);
  // torso (pivot at the belt)
  const torso=new THREE.Group();torso.position.set(0,K_DIM.torsoY,0);g.add(torso);
  bx(.64,.1,.42,leather,0,.02,0,torso);
  bx(.66,.5,.4,steel,0,.31,0,torso);
  bx(.5,.36,.02,tabM,0,.25,-.21,torso);bx(.5,.36,.02,tabM,0,.25,.21,torso);
  bx(.38,.2,.03,tabM,0,-.1,-.215,torso);bx(.38,.2,.03,tabM,0,-.1,.215,torso);
  bx(.3,.08,.3,mail,0,.58,0,torso);
  for(const s of[-1,1]){bx(.3,.17,.4,steel,s*.42,.53,0,torso);bx(.26,.07,.36,dark,s*.44,.43,0,torso);}
  // head: big chibi helmet with glowing eyes behind the visor slit
  const head=new THREE.Group();head.position.set(0,K_DIM.neckY,0);g.add(head);
  bx(.64,.58,.6,steel,0,.29,0,head);
  bx(.68,.07,.1,dark,0,.42,-.27,head);             // brow ridge
  bx(.5,.11,.02,slit,0,.29,-.301,head);             // visor slit
  bx(.06,.14,.02,slit,0,.14,-.301,head);            // breathing slot
  bx(.66,.08,.62,dark,0,.03,0,head);                // gorget rim
  bx(.1,.12,.38,plume,0,.64,.04,head);bx(.1,.1,.2,plume,0,.74,.16,head);bx(.1,.08,.12,plume,0,.58,.3,head);
  const eyeM=new THREE.MeshBasicMaterial({color:tab===0x8e2222?0xff5a3c:0xffe27a});
  const eyes=[-1,1].map(s=>bx(.1,.07,.02,eyeM,s*.12,.29,-.305,head));
  const xMarks=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.12,.29,-.306);head.add(p);
    for(const r of[.785,-.785]){const m=new THREE.Mesh(new THREE.BoxGeometry(.12,.03,.02),eyeM);m.rotation.z=r;p.add(m);}p.visible=false;return p;});
  // arms: upper (shoulder→elbow), lower (elbow→wrist), gauntlet at the hand target
  const seg=(len,w,m,capM)=>{const p=new THREE.Group();g.add(p);const me=new THREE.Mesh(new THREE.BoxGeometry(w,w,len),m);me.position.z=len/2;me.castShadow=true;p.add(me);
    if(capM){const c=new THREE.Mesh(new THREE.BoxGeometry(w+.05,w+.05,.12),capM);c.castShadow=true;p.add(c);}p.userData.len=len;return p;};
  const arm=()=>{const up=seg(K_DIM.armA,.19,steel),lo=seg(K_DIM.armB,.17,steel,dark);const hand=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.17),dark);hand.castShadow=true;g.add(hand);return{up,lo,hand,pa:0};};
  const armR=arm(),armL=arm();
  const pivot=new THREE.Group();pivot.rotation.order='YXZ';g.add(pivot);
  return {g,legL,legR,torso,head,armR,armL,pivot,mats,eyes,xMarks,weapon:null,twist:0,dodge:0,lh:1,nod:0,blinkAt:rand(2,4),blinkT:0,reachErr:0};
}
const Z=new THREE.Vector3(0,0,1),tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();
const _S=new THREE.Vector3(),_D=new THREE.Vector3(),_N=new THREE.Vector3(),_E=new THREE.Vector3(),_W=new THREE.Vector3(),_hR=new THREE.Vector3(),_hL=new THREE.Vector3(),_eul=new THREE.Euler(0,0,0,'YXZ'),Y_UP=new THREE.Vector3(0,1,0);
function shoulderAt(side,yaw,out){const x=side*K_DIM.shX;return out.set(x*Math.cos(yaw),K_DIM.torsoY+K_DIM.shY,-x*Math.sin(yaw));}
function overReach(side,yaw,h){const d=shoulderAt(side,yaw,_S).distanceTo(h)-(K_DIM.armA+K_DIM.armB)*.95;return d>0?d:0;}
function placeSeg(p,a,b,len){_D.copy(b).sub(a);const l=Math.max(.01,_D.length());p.position.copy(a);p.quaternion.setFromUnitVectors(Z,_D.divideScalar(l));p.scale.set(1,1,l/len);}
// --- head avoidance: the chibi helmet is big, so hands and arms are kept outside its box (head-local space) ---
const HEAD_BOX={hx:.33,y0:-.02,y1:.6,hz:.31},_hq=new THREE.Quaternion(),_hqi=new THREE.Quaternion(),_hp=new THREE.Vector3(),_C=new THREE.Vector3(),_X=new THREE.Vector3(),_T=new THREE.Vector3(),_hpos=new THREE.Vector3();
function toHead(v,out){return out.copy(v).sub(_hpos).applyQuaternion(_hqi);}
function headPen(v,r){toHead(v,_hp);const m=Math.min(HEAD_BOX.hx+r-Math.abs(_hp.x),_hp.y-HEAD_BOX.y0+r,HEAD_BOX.y1+r-_hp.y,HEAD_BOX.hz+r-Math.abs(_hp.z));return m>0?m:0;}
function segPen(a,b,r){let m=0;for(let i=2;i<=8;i++){const p=headPen(_C.copy(a).lerp(b,i/8),r);if(p>m)m=p;}return m;}
// analytic two-bone IK; elbows bend out/down/back, then the bend plane is rotated around the shoulder→hand axis
// to whichever nearby angle keeps both segments out of the helmet. Arms may stretch up to 15% before the hand lets go.
const POLE_TRY=[0,.6,-.6,1.2,-1.2,1.8,-1.8,2.5,-2.5];
const _arm={a:0,b:0,d:0,ca:0,sa:0,dist:0};
function armFrame(side,yaw,h){
  shoulderAt(side,yaw,_S);_D.copy(h).sub(_S);const dist=_D.length();_D.divideScalar(Math.max(dist,1e-4));
  const st=clamp(dist/((K_DIM.armA+K_DIM.armB)*.995),1,1.15),a=K_DIM.armA*st,b=K_DIM.armB*st;
  const d=clamp(dist,Math.abs(a-b)+.05,(a+b)*.995),ca=clamp((a*a+d*d-b*b)/(2*a*d),-1,1);
  Object.assign(_arm,{a,b,d,ca,sa:Math.sqrt(1-ca*ca),dist});
  _N.set(side*.5,-.65,.45);_N.addScaledVector(_D,-_N.dot(_D));if(_N.lengthSq()<1e-5)_N.set(0,0,1);_N.normalize();
  _X.crossVectors(_D,_N);_W.copy(_S).addScaledVector(_D,d);
}
const elbowAt=(ang,side,out)=>out.copy(_S).addScaledVector(_D,_arm.a*_arm.ca).addScaledVector(_N,_arm.a*_arm.sa*Math.cos(ang)).addScaledVector(_X,_arm.a*_arm.sa*Math.sin(ang)*side);
const armPen=()=>Math.max(segPen(_S,_E,.1),segPen(_E,_W,.09));
// best bend-plane angle for this hand target → {ang, pen}
const _best={ang:0,pen:0};
function bestPole(arm,side,yaw,h){armFrame(side,yaw,h);let bc=1e9;
  for(const ang of POLE_TRY){elbowAt(ang,side,_E);const p=armPen(),c=p*20+Math.abs(ang)*.03+Math.abs(ang-arm.pa)*.02;if(c<bc){bc=c;_best.ang=ang;_best.pen=p;}}
  return _best;}
function solveArm(arm,side,yaw,h,dt){
  const ang=bestPole(arm,side,yaw,h).ang;
  arm.pa=lerp(arm.pa,ang,1-Math.exp(-25*dt));armFrame(side,yaw,h);elbowAt(arm.pa,side,_E);
  placeSeg(arm.up,_S,_E,K_DIM.armA);placeSeg(arm.lo,_E,_W,K_DIM.armB);
  arm.hand.position.copy(_W);arm.hand.quaternion.copy(arm.lo.quaternion);
  return Math.max(0,_arm.dist-_arm.d);
}
const _free=new THREE.Vector3();
function updateKnight(k,f,pz,dt){
  const pv=k.pivot;pv.rotation.set(pz.bpitch,pz.byaw,pz.roll);k.weapon.spin.rotation.y=pz.spin;
  _hR.set(pz.bx,pz.by,pz.bz);pv.position.copy(_hR);
  const two=f.weapon.id==='axe'||f.state==='parry';
  const grip=v=>v.set(0,-.18*1.15,0).applyEuler(_eul.set(pz.bpitch,pz.byaw,pz.roll,'YXZ')).add(_hR);
  if(two)grip(_hL);
  // torso twist: pick the yaw that lets the hands reach their targets, with a mild pull back to neutral.
  // Two-handed: try a twist that serves both hands; if the off hand still can't reach (or would cut through
  // the helmet), it lets go of the haft and the twist serves the weapon hand alone.
  const twistFor=both=>{let best=0,bc=1e9;for(let y=-.6;y<=.9001;y+=.1){const c=overReach(1,y,_hR)**2*30+(both?overReach(-1,y,_hL)**2*20:0)+y*y*.04;if(c<bc){bc=c;best=y;}}return best;};
  k.nod=lerp(k.nod,f.state==='stun'?-.22:0,1-Math.exp(-12*dt));
  let tgt=twistFor(false),lhT=0;
  if(two){const t2=twistFor(true);_hq.setFromEuler(_eul.set(k.nod,t2*.3,0,'XYZ'));_hqi.copy(_hq).invert();_hpos.set(0,K_DIM.neckY,0);
    if(overReach(1,t2,_hR)<.04&&overReach(-1,t2,_hL)<.06&&bestPole(k.armR,1,t2,_hR).pen<.02&&bestPole(k.armL,-1,t2,_hL).pen<.02){tgt=t2;lhT=1;}}
  k.twist=lerp(k.twist,tgt,1-Math.exp(-20*dt));const tw=k.twist;
  k.torso.rotation.y=tw;
  // collision maths uses the un-dodged head so the head lean below can't feed back into itself
  _hpos.set(0,K_DIM.neckY,0);_hq.setFromEuler(_eul.set(k.nod,tw*.3,0,'XYZ'));_hqi.copy(_hq).invert();
  // off hand holds the haft only while it can reach it without going through the helmet; otherwise it lets go
  const bob=Math.sin(f.walk*4)*.04;_free.set(-.52,.52+bob,-.1).applyAxisAngle(Y_UP,tw);
  k.lh=lerp(k.lh,lhT,1-Math.exp(-18*dt));
  if(two)_hL.lerpVectors(_free,_hL,k.lh);else _hL.copy(_free);
  k.reachErr=Math.max(solveArm(k.armR,1,tw,_hR,dt),solveArm(k.armL,-1,tw,_hL,dt));
  // last resort: the head leans back from any arm clipping that is left
  let left=0;for(const a of[k.armR,k.armL])for(const sg of[a.up,a.lo]){_S.copy(sg.position);_E.set(0,0,sg.userData.len*sg.scale.z).applyQuaternion(sg.quaternion).add(_S);left=Math.max(left,segPen(_S,_E,.09));}
  k.dodge=lerp(k.dodge,Math.min(.14,left*1.6),1-Math.exp(-25*dt));
  k.head.position.set(0,K_DIM.neckY-k.dodge*.3,k.dodge*.9);k.head.rotation.set(k.nod+k.dodge*1.6,tw*.3,0);
  const sw=Math.sin(f.walk*4.2)*.55*Math.min(1,Math.hypot(f.vel.x,f.vel.z)/2);k.legL.rotation.x=sw;k.legR.rotation.x=-sw;
  // eyes: blink every few seconds, squint when stunned, ✕ when dead
  k.blinkAt-=dt;if(k.blinkAt<=0){k.blinkT=.13;k.blinkAt=rand(2.2,4.5);}k.blinkT=Math.max(0,k.blinkT-dt);
  const dead=f.state==='dead',ey=f.state==='stun'?.3:k.blinkT>0?.15:1;
  for(const e of k.eyes){e.visible=!dead;e.scale.y=ey;}for(const x of k.xMarks)x.visible=dead;
}
/* ---------------- poses (camera-space hand + rotation; b* = bot-space hand) ---------------- */
const P=(x,y,z,yaw,pitch,roll,spin,bx,by,bz,byaw,bpitch)=>({x,y,z,yaw,pitch,roll,spin,bx,by,bz,byaw:byaw??yaw,bpitch:bpitch??pitch});
const POSE={
  idle:  P(.32,-.42,-.55, .15,-.35,-.25,0,   .42,1.0,-.38),
  slashW:P(.24,-.12,-.5, -1.0,-1.25,-.25,1.57, .7,1.3,-.05),
  slashE:P(-.52,-.32,-.55, 1.35,-1.5,.2,1.57, -.4,1.15,-.45),
  stabW: P(.24,-.27,-.36, .06,-1.5,0,0,     .5,.92,.25, .45,-1.2),
  stabE: P(.1,-.24,-.95, 0,-1.57,0,0,        .12,1.23,-.8),
  overW: P(.22,.1,-.3, .1,.55,-.1,0,          .45,1.75,-.05),
  overE: P(.08,-.5,-.65, 0,-2.1,0,0,          .1,.95,-.62),
  parry: P(.04,-.1,-.5, 1.5,-1.25,0,1.57,     .2,1.48,-.55),
  recoil:P(.52,-.05,-.4, -.6,.25,-.6,0,       .5,1.55,-.05),
  stun:  P(.3,-.7,-.45, .3,-.1,-.6,0,         .4,.8,-.3),
};
const POSE_KEYS=['x','y','z','yaw','pitch','roll','spin','bx','by','bz','byaw','bpitch'];
const W_OF={slash:'slashW',stab:'stabW',over:'overW'},E_OF={slash:'slashE',stab:'stabE',over:'overE'};
// bot-space hand moves on an arc around the helmet (radius and direction interpolated separately),
// so swings sweep around the big chibi head instead of cutting straight through the face
const ARC_C=new THREE.Vector3(0,1.45,0),_aA=new THREE.Vector3(),_aB=new THREE.Vector3(),_h0={bx:0,by:0,bz:0};
function arcHand(cur,a,b,t){
  _aA.set(a.bx,a.by,a.bz).sub(ARC_C);_aB.set(b.bx,b.by,b.bz).sub(ARC_C);const ra=_aA.length(),rb=_aB.length();
  _aA.divideScalar(ra||1).lerp(_aB.divideScalar(rb||1),t);if(_aA.lengthSq()<1e-6)_aA.set(0,0,-1);
  _aA.setLength(lerp(ra,rb,t)).add(ARC_C);cur.bx=_aA.x;cur.by=_aA.y;cur.bz=_aA.z;}
function poseFor(f,dt){
  const cur=f.pose;let tgt,k;
  switch(f.state){
    case'windup':tgt=POSE[W_OF[f.atkType]];k=f.riposte?30:26;break; // fast pose change so the attack type reads in the first ~100ms
    case'release':{const p=easeOut(clamp(f.t/f.dur,0,1));const a=POSE[W_OF[f.atkType]],b=POSE[E_OF[f.atkType]];for(const key of POSE_KEYS)cur[key]=lerp(a[key],b[key],p);arcHand(cur,a,b,p);return cur;}
    case'recovery':tgt=POSE.idle;k=9;break;
    case'parry':tgt=POSE.parry;k=32;break;
    case'recoil':tgt=POSE.recoil;k=22;break;
    case'stun':case'dead':tgt=POSE.stun;k=12;break;
    case'feint':tgt=POSE.idle;k=22;break;
    default:tgt=POSE.idle;k=12;
  }
  const a=1-Math.exp(-k*dt);_h0.bx=cur.bx;_h0.by=cur.by;_h0.bz=cur.bz;for(const key of POSE_KEYS)cur[key]=lerp(cur[key],tgt[key],a);arcHand(cur,_h0,tgt,a);return cur;
}

/* ---------------- fighters ---------------- */
function makeFighter(isBot){return{isBot,pos:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:0,hp:100,st:100,state:'idle',t:0,dur:0,atk:null,atkType:null,riposte:false,hitDone:false,
  parryStart:-9,perfectOK:true,lastParryRelease:-9,riposteUntil:0,lastSpend:-9,buffer:null,radius:.42,weapon:WEAPONS.sword,flash:0,deadT:0,walk:0,pose:Object.assign({},POSE.idle),atkStart:0};}
const player=makeFighter(false),bot=makeFighter(true);
let knight=null;
function setupKnight(){
  if(knight)scene.remove(knight.g);
  knight=buildKnight(TABARD[CFG.diff]);
  const wp=buildWeapon(bot.weapon.id);wp.w.scale.setScalar(1.15);knight.pivot.add(wp.w);knight.weapon=wp;
  scene.add(knight.g);
}
let vm=null;const vmRoot=new THREE.Group();vmScene.add(vmRoot);
function setupViewmodel(){
  if(vm)vmRoot.remove(vm.pivot);
  const pivot=new THREE.Group();pivot.rotation.order='YXZ';const wp=buildWeapon(player.weapon.id);wp.w.scale.setScalar(.78);pivot.add(wp.w);
  // gauntlet
  const hand=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.13),new THREE.MeshLambertMaterial({color:0x8a939c}));hand.position.set(0,.02,0);wp.spin.add(hand);
  vmRoot.add(pivot);vm={pivot,wp};
}
