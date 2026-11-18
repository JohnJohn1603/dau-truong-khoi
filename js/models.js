// Mô hình vũ khí, hiệp sĩ, tư thế vung đòn và dữ liệu người đấu
'use strict';
/* ---------------- weapons & knights ---------------- */
function buildWeapon(kind){
  const w=new THREE.Group();const spin=new THREE.Group();w.add(spin);
  const M=c=>new THREE.MeshLambertMaterial({color:c});
  const steel=M(0xcdd4dc),wood=M(0x5b3f25),gold=M(0xb8913a),darkSteel=M(0x8e979f);
  const b=(sx,sy,sz,m,x,y,z)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);me.position.set(x,y,z);me.castShadow=true;spin.add(me);return me;};
  if(kind==='sword'){b(.05,.4,.05,wood,0,-.06,0);b(.085,.07,.085,gold,0,-.29,0); // long grip: room for both hands
    b(.32,.05,.07,gold,0,.16,0);b(.075,.9,.025,steel,0,.64,0);b(.012,.86,.03,darkSteel,0,.62,0);b(.045,.08,.022,steel,0,1.12,0);}
  else{b(.055,1.08,.055,wood,0,.36,0);b(.05,.2,.09,darkSteel,0,.8,-.06);b(.04,.34,.16,steel,0,.8,-.18);b(.03,.42,.05,steel,0,.8,-.28);b(.04,.08,.12,darkSteel,0,.82,.08);b(.07,.06,.07,darkSteel,0,-.17,0);}
  return {w,spin};
}
/* ---- knight: adult proportions, armour sculpted from many small voxel plates ---- */
// g (feet at y=0, front = -z) → legL/legR (hip pivots), torso (twists at the waist) → faulds/breastplate/pauldrons,
// head (neck pivot, follows torso a little) → eyes; arms are 2-bone IK chains from the torso's shoulders to the hand target.
// Every bone's plates are merged into one mesh per material, so the detail costs about the same draw calls as plain blocks.
const K_WPN=.95; // knight's weapon scale (adult-sized longsword / axe)
const K_DIM={hipY:.95,thigh:.44,shin:.51,torsoY:.98,shX:.27,shY:.48,neckY:1.56,armA:.32,armB:.3};
// the player is the same knight: eyes sit at the helmet's visor slit
const EYE_H=K_DIM.neckY+.19,EYE_Z=-.17;
const shade=(h,k)=>{const c=hex2rgb(h).map(v=>clamp(Math.round(v*k),0,255));return(c[0]<<16)|(c[1]<<8)|c[2];};
const KTEX={};
const kTex=(key,fn)=>KTEX[key]||(KTEX[key]=mkTex(fn));
// plate: soft dark rim + bright bevel on top/left + a few scratches → each small block reads as a hammered steel plate
const plateFn=base=>g=>{const edge=shade(base,.7),hi=shade(base,1.18);for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const rim=x===0||y===0||x===15||y===15,bev=(y===1||x===1)&&!rim,low=(y===14||x===14)&&!rim,scr=srand()<.035;
  px(g,x,y,rim?edge:bev?hi:low?shade(base,.88):scr?shade(base,1.3):base,.06);}};
const mailFn=base=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){px(g,x,y,(x+(y>>1))%2?shade(base,1.2):shade(base,.78),.07);}};
const clothFn=base=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const rim=x===0||x===15,trim=y>=14;
  px(g,x,y,trim?(y===14?0x7a5c22:0xc9a046):rim?shade(base,.72):(y%4===0)?shade(base,.9):base,.08);}};
const leatherFn=base=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const rim=y===0||y===15,st=(x===2||x===13)&&y%3===1;
  px(g,x,y,st?shade(base,1.35):rim?shade(base,.62):base,.12);}};
// merge many boxes [sx,sy,sz,x,y,z] into one BufferGeometry (each box keeps its own 0..1 UVs)
function mergeBoxes(list){
  const pos=[],nor=[],uv=[],idx=[];let base=0;
  for(const b of list){const bg=new THREE.BoxGeometry(b[0],b[1],b[2]);bg.translate(b[3],b[4],b[5]);
    const P=bg.attributes.position.array;pos.push(...P);nor.push(...bg.attributes.normal.array);uv.push(...bg.attributes.uv.array);
    for(const i of bg.index.array)idx.push(i+base);base+=P.length/3;bg.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  g.computeBoundingBox();g.computeBoundingSphere();return g;}
// spec = {materialKey:[boxes…]} → one mesh per material under parent
function sculpt(parent,spec,M){for(const k in spec){if(!spec[k].length)continue;const me=new THREE.Mesh(mergeBoxes(spec[k]),M[k]);me.castShadow=true;parent.add(me);}}
// per-skin palette: straw guard wears dull iron and leather, grey knight bright plate, red swordmaster dark steel with red
const SKIN={0x8a7a4a:{steel:0x7c7b73,dark:0x4e4a42,trim:0x7a6a48,crest:0},0x4b5a78:{steel:0x7d8690,dark:0x4a5058,trim:0xb8913a,crest:1},0x8e2222:{steel:0x5d6168,dark:0x2c2e33,trim:0xb8913a,crest:2}};
function knightMats(tab){
  const sk=SKIN[tab]||SKIN[0x4b5a78];
  const Ph=t=>new THREE.MeshPhongMaterial({map:t,specular:0x2c3036,shininess:22}),L=t=>new THREE.MeshLambertMaterial({map:t});
  const M={steel:Ph(kTex('st'+sk.steel,plateFn(sk.steel))),dark:Ph(kTex('dk'+sk.dark,plateFn(sk.dark))),mail:L(kTex('mail',mailFn(0x5d636b))),
    cloth:L(kTex('cloth'+tab,clothFn(tab))),leather:L(kTex('leather',leatherFn(0x5a3e2a))),trim:Ph(kTex('tr'+sk.trim,plateFn(sk.trim))),
    plume:L(kTex('plume'+tab,fill(shade(tab,1.15),.14))),slit:new THREE.MeshLambertMaterial({color:0x0c0d10})};
  return {M,sk,mats:Object.values(M)};
}
// arm: upper (mail sleeve + rerebrace), lower (couter with wing + vambrace), gauntlet with flared cuff and knuckle plate.
// Shared by the knight and by the player's first-person view, so both wear the same armour.
function buildArm(M,parent,s){
  const A=K_DIM.armA,B=K_DIM.armB;
  const seg=(len,spec)=>{const p=new THREE.Group();parent.add(p);sculpt(p,spec,M);p.userData.len=len;return p;};
  const up=seg(A,{mail:[[.11,.11,A,0,0,A/2]],steel:[[.13,.13,A*.55,0,0,A*.62]]});
  const lo=seg(B,{steel:[[.14,.14,.09,0,0,.01],[.115,.115,B*.75,0,0,B*.55]],dark:[[.03,.12,.09,s*.08,0,.01]]});
  const hand=new THREE.Group();parent.add(hand);sculpt(hand,{dark:[[.1,.11,.12,0,0,.02],[.135,.135,.045,0,0,-.05]],steel:[[.105,.035,.09,0,.055,.025]]},M);
  return{up,lo,hand,pa:0};
}
function buildKnight(tab){
  const {M,sk,mats}=knightMats(tab);
  const g=new THREE.Group();g.rotation.order='YXZ'; // yaw first, then lean / fall in the knight's own frame
  // legs: thigh (hip pivot: mail + plate cuisse) → shin (knee pivot: knee cop with wings, greave with ridge, stepped sabaton)
  const leg=x=>{const p=new THREE.Group();p.position.set(x,K_DIM.hipY,0);g.add(p);
    sculpt(p,{mail:[[.19,.42,.21,0,-.2,0]],steel:[[.2,.28,.06,0,-.17,-.095]]},M);
    const sh=new THREE.Group();sh.position.y=-K_DIM.thigh;p.add(sh);
    sculpt(sh,{steel:[[.18,.1,.06,0,0,-.115],[.17,.34,.19,0,-.2,0],[.13,.3,.04,0,-.19,-.105]],
      dark:[[.23,.05,.05,0,0,-.11],[.19,.1,.27,0,-.46,-.03],[.17,.05,.07,0,-.48,-.18],[.18,.03,.2,0,-.38,0]]},M);
    p.userData.shin=sh;return p;};
  const legL=leg(-.12),legR=leg(.12);
  // torso (pivot at the waist)
  const torso=new THREE.Group();torso.position.set(0,K_DIM.torsoY,0);g.add(torso);
  const side=(f)=>[-1,1].flatMap(f);
  sculpt(torso,{
    leather:[[.4,.07,.27,0,0,0]],
    trim:[[.06,.06,.02,0,0,-.14],[.34,.025,.02,0,.46,-.165]],
    mail:[[.35,.18,.24,0,.11,0],[.2,.06,.18,0,.58,0]],
    cloth:[[.26,.38,.02,0,-.06,-.162],[.26,.34,.02,0,-.06,.16],[.24,.3,.02,0,.28,-.181]],
    steel:[
      [.4,.27,.27,0,.33,0],[.34,.21,.05,0,.34,-.15],[.36,.26,.03,0,.33,.145],         // breastplate core, bulge, back plate
      [.36,.05,.04,0,.18,-.135],[.34,.05,.04,0,.13,-.13],                              // stomach lames
      [.37,.07,.05,0,-.07,-.12],[.35,.07,.05,0,-.13,-.125],[.37,.07,.05,0,-.07,.12],   // faulds front/back
      [.23,.06,.21,0,.53,0],                                                           // gorget
      ...side(s=>[[.06,.15,.22,s*.2,-.08,0],[.2,.08,.26,s*.3,.5,0],[.19,.07,.24,s*.32,.44,0],[.17,.06,.22,s*.335,.385,0]])], // tassets + pauldron lames
    dark:[[.04,.2,.02,0,.34,-.176],[.24,.03,.22,0,.565,0],...side(s=>[[.21,.025,.27,s*.3,.545,0]])]},M);
  // head (neck pivot): rounded great helm from stepped blocks, face plate with breaths, visor slit with glowing eyes, crest
  const head=new THREE.Group();head.position.set(0,K_DIM.neckY,0);g.add(head);
  const crest=sk.crest===0?[]:sk.crest===1?[[.04,.08,.24,0,.38,.02],[.04,.06,.12,0,.43,.08],[.04,.05,.06,0,.36,.15]]:[[.05,.12,.2,0,.4,0],[.03,.08,.08,0,.47,.06]];
  sculpt(head,{mail:[[.11,.07,.11,0,.02,0]],
    steel:[[.26,.27,.29,0,.165,0],[.28,.2,.24,0,.15,0],[.22,.04,.25,0,.32,0],[.15,.03,.18,0,.35,0],[.24,.22,.03,0,.14,-.15],
      ...(sk.crest===0?[[.32,.02,.34,0,.27,0]]:[])],                                    // straw guard: kettle-hat brim
    dark:[[.27,.03,.03,0,.235,-.152],[.28,.04,.28,0,.03,0]],
    slit:[[.19,.03,.02,0,.19,-.166],...[-.04,0,.04].map(x=>[.02,.05,.01,x,.08,-.166])],
    plume:crest},M);
  const eyeM=new THREE.MeshBasicMaterial({color:tab===0x8e2222?0xff5a3c:0xffd56a});
  const bx=(sx,sy,sz,m,x,y,z,p)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);me.position.set(x,y,z);p.add(me);return me;};
  const eyes=[-1,1].map(s=>bx(.045,.016,.01,eyeM,s*.047,.19,-.168,head));
  const xMarks=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.047,.19,-.17);head.add(p);
    for(const r of[.785,-.785]){const m=new THREE.Mesh(new THREE.BoxGeometry(.05,.012,.01),eyeM);m.rotation.z=r;p.add(m);}p.visible=false;return p;});
  const armR=buildArm(M,g,1),armL=buildArm(M,g,-1);
  const pivot=new THREE.Group();pivot.rotation.order='YXZ';g.add(pivot);
  // collision volumes (local to head / torso) used by the arm IK and by the clipping tests
  const colBoxes=[{obj:head,min:new THREE.Vector3(-.14,-.01,-.165),max:new THREE.Vector3(.14,.34,.15)},
    {obj:torso,min:new THREE.Vector3(-.2,-.17,-.15),max:new THREE.Vector3(.2,.47,.15)}];
  return {g,legL,legR,torso,head,armR,armL,pivot,mats,eyes,xMarks,colBoxes,weapon:null,twist:0,dodge:0,nod:0,bt:rand(0,6),hit:0,hitSide:1,lastFlash:0,fallSide:1,blinkAt:rand(2,4),blinkT:0,reachErr:0};
}
const Z=new THREE.Vector3(0,0,1),tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();
const _S=new THREE.Vector3(),_D=new THREE.Vector3(),_N=new THREE.Vector3(),_E=new THREE.Vector3(),_W=new THREE.Vector3(),_hR=new THREE.Vector3(),_hL=new THREE.Vector3(),_eul=new THREE.Euler(0,0,0,'YXZ'),Y_UP=new THREE.Vector3(0,1,0);
// shoulders sit rolled forward: both weapons are held two-handed in front of the chest
const SH_FWD=.05;
function shoulderAt(side,yaw,out){const x=side*K_DIM.shX,z=-SH_FWD,c=Math.cos(yaw),s=Math.sin(yaw);return out.set(x*c+z*s,K_DIM.torsoY+K_DIM.shY,-x*s+z*c);}
function overReach(side,yaw,h){const d=shoulderAt(side,yaw,_S).distanceTo(h)-(K_DIM.armA+K_DIM.armB)*.95;return d>0?d:0;}
// plain two-bone IK toward a pole direction (first-person arms: no body to avoid, the camera is the head)
function ikPlace(arm,S,H,pole){
  _D.copy(H).sub(S);const dist=_D.length();_D.divideScalar(Math.max(dist,1e-4));
  const A=K_DIM.armA,B=K_DIM.armB,st=clamp(dist/((A+B)*.995),1,1.15),a=A*st,b=B*st,d=clamp(dist,Math.abs(a-b)+.05,(a+b)*.995);
  const ca=clamp((a*a+d*d-b*b)/(2*a*d),-1,1),sa=Math.sqrt(1-ca*ca);
  _N.copy(pole).addScaledVector(_D,-pole.dot(_D));if(_N.lengthSq()<1e-6)_N.set(0,-1,0);_N.normalize();
  _E.copy(S).addScaledVector(_D,a*ca).addScaledVector(_N,a*sa);_W.copy(S).addScaledVector(_D,d);
  const w=arm.w||1;placeSeg(arm.up,S,_E,A,w);placeSeg(arm.lo,_E,_W,B,w);arm.hand.position.copy(_W);arm.hand.quaternion.copy(arm.lo.quaternion);arm.hand.scale.setScalar(arm.hw||1);
  return Math.max(0,dist-d);}
function placeSeg(p,a,b,len,w=1){_D.copy(b).sub(a);const l=Math.max(.01,_D.length());p.position.copy(a);p.quaternion.setFromUnitVectors(Z,_D.divideScalar(l));p.scale.set(w,w,l/len);}
// --- body avoidance: arms are kept outside the helmet and the chest/faulds block.
// Both are boxes tested in their own local space (head follows a third of the torso twist).
const HEAD_BOX={hx:.14,y0:-.01,y1:.34,hz:.16},TORSO_BOX={hx:.2,y0:-.17,y1:.47,hz:.15};
const _hq=new THREE.Quaternion(),_hqi=new THREE.Quaternion(),_tqi=new THREE.Quaternion(),_hp=new THREE.Vector3(),_C=new THREE.Vector3(),_X=new THREE.Vector3(),_T=new THREE.Vector3(),_hpos=new THREE.Vector3(),_tpos=new THREE.Vector3();
function boxPen(v,r,pos,qi,B){_hp.copy(v).sub(pos).applyQuaternion(qi);const m=Math.min(B.hx+r-Math.abs(_hp.x),_hp.y-B.y0+r,B.y1+r-_hp.y,B.hz+r-Math.abs(_hp.z));return m>0?m:0;}
const headPen=(v,r)=>boxPen(v,r,_hpos,_hqi,HEAD_BOX);
const bodyPen=(v,r)=>Math.max(headPen(v,r),boxPen(v,r*1.1,_tpos,_tqi,TORSO_BOX));
// collision frame for a given torso twist (un-dodged head, so the head lean can't feed back into itself)
function setBodyFrame(nod,tw){_hpos.set(0,K_DIM.neckY,0);_hq.setFromEuler(_eul.set(nod,tw*.3,0,'XYZ'));_hqi.copy(_hq).invert();
  _tpos.set(0,K_DIM.torsoY,0);_tqi.setFromAxisAngle(Y_UP,-tw);}
function segPen(a,b,r,headOnly){let m=0;for(let i=2;i<=8;i++){_C.copy(a).lerp(b,i/8);const p=headOnly?headPen(_C,r):bodyPen(_C,r);if(p>m)m=p;}return m;}
// analytic two-bone IK; elbows bend out/down/back, then the bend plane is rotated around the shoulder→hand axis
// to whichever nearby angle keeps both segments out of the helmet and chest. Arms may stretch up to 15% before the hand lets go.
const _poleOrd=[];for(let a=-2.7;a<=2.7001;a+=.3)_poleOrd.push({a:+a.toFixed(2),b:0});
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
const armPen=()=>Math.max(segPen(_S,_E,.1),segPen(_E,_W,.09),bodyPen(_W,.09));
// best bend-plane angle for this hand target → {ang, pen}
const _best={ang:0,pen:0};
function bestPole(arm,side,yaw,h){armFrame(side,yaw,h);let bc=1e9;
  // candidates in order of their collision-free cost; once that alone can't win, the rest can't either
  for(const o of _poleOrd){o.b=Math.abs(o.a)*.02+Math.abs(o.a-arm.pa)*.06;}_poleOrd.sort((x,y)=>x.b-y.b);
  let n=0;for(const o of _poleOrd){if(o.b>=bc||++n>10)break;elbowAt(o.a,side,_E);const p=armPen(),c=p*30+o.b;if(c<bc){bc=c;_best.ang=o.a;_best.pen=p;}}
  return _best;}
function solveArm(arm,side,yaw,h,dt){
  const ang=bestPole(arm,side,yaw,h).ang;
  // no blending of the bend angle (halfway between two clear angles can be inside the chest); continuity comes from the cost
  arm.pa=ang;armFrame(side,yaw,h);elbowAt(ang,side,_E);
  placeSeg(arm.up,_S,_E,K_DIM.armA);placeSeg(arm.lo,_E,_W,K_DIM.armB);
  arm.hand.position.copy(_W);arm.hand.quaternion.copy(arm.lo.quaternion);
  return Math.max(0,_arm.dist-_arm.d);
}
const _twOrd=[];for(let y=-.6;y<=.9001;y+=.1)_twOrd.push({a:+y.toFixed(2),b:0});
function updateKnight(k,f,pz,dt){
  const dead=f.state==='dead',spd=Math.hypot(f.vel.x,f.vel.z),walkA=dead?0:Math.min(1,spd/2);
  // breathing: slow chest rise, deeper when out of stamina, damped while walking
  k.bt+=dt*1.9;const br=dead?0:Math.sin(k.bt)*(1+(1-(f.st??100)/100)*1.4)*(1-walkA*.7);
  // hit flinch: a new red flash means a fresh hit → short kick that decays
  if(f.flash>k.lastFlash+.3){k.hit=1;k.hitSide=Math.random()<.5?-1:1;}k.lastFlash=f.flash;k.hit=Math.max(0,k.hit-dt*4.5);
  const hk=k.hit*k.hit*(3-2*k.hit); // smooth kick shape
  const pv=k.pivot;pv.rotation.set(pz.bpitch,pz.byaw,pz.roll);k.weapon.spin.rotation.y=pz.spin;
  _hR.set(pz.bx,pz.by+br*.008-hk*.05,pz.bz+hk*.06);pv.position.copy(_hR);
  // both weapons are held in two hands: weapon hand at the pivot, off hand further down the grip/haft
  _hL.set(0,-.18*K_WPN,0).applyEuler(_eul.set(pz.bpitch,pz.byaw,pz.roll,'YXZ')).add(_hR);
  // torso twist: pick the yaw that lets both hands reach their targets clear of the body, with a mild pull back to neutral
  // (collision is part of the cost: twisting the chest out of the way is how short chibi arms sweep across it)
  for(const o of _twOrd){const y=o.a;o.b=overReach(1,y,_hR)**2*30+overReach(-1,y,_hL)**2*20+y*y*.04+Math.abs(y-k.twist)*.01;}
  _twOrd.sort((x,y)=>x.b-y.b);let tgt=0,bc=1e9,n=0;
  for(const o of _twOrd){if(o.b>=bc||++n>6)break;setBodyFrame(k.nod,o.a);const c=o.b+bestPole(k.armR,1,o.a,_hR).pen**2*200+bestPole(k.armL,-1,o.a,_hL).pen**2*200;if(c<bc){bc=c;tgt=o.a;}}
  k.nod=lerp(k.nod,f.state==='stun'?-.22:0,1-Math.exp(-12*dt));
  k.twist=lerp(k.twist,tgt,1-Math.exp(-20*dt));const tw=k.twist+k.hitSide*hk*.12; // hit kick twists the chest without feeding back into k.twist
  k.torso.rotation.y=tw;k.torso.position.y=K_DIM.torsoY+br*.006;k.torso.scale.set(1+br*.012,1,1+br*.018);
  setBodyFrame(k.nod,tw);
  k.reachErr=Math.max(solveArm(k.armR,1,tw,_hR,dt),solveArm(k.armL,-1,tw,_hL,dt));
  // last resort: the head leans back from any arm clipping that is left
  let left=0;for(const a of[k.armR,k.armL])for(const sg of[a.up,a.lo]){_S.copy(sg.position);_E.set(0,0,sg.userData.len*sg.scale.z).applyQuaternion(sg.quaternion).add(_S);left=Math.max(left,segPen(_S,_E,.09,true));}
  k.dodge=lerp(k.dodge,Math.min(.14,left*1.6),1-Math.exp(-25*dt));
  // head: dodge lean, breathing, snaps back on a hit
  k.head.position.set(0,K_DIM.neckY-k.dodge*.3+br*.008,k.dodge*.9);k.head.rotation.set(k.nod+k.dodge*1.6+hk*.35,tw*.3+k.hitSide*hk*.25,k.hitSide*hk*.12);
  // legs: walk cycle with knee bend (swing leg folds, stance leg nearly straight); gait runs backwards when backing off
  const fwd=-(f.vel.x*Math.sin(f.yaw??0)+f.vel.z*Math.cos(f.yaw??0)),ph=f.walk*4.2*(fwd<-.2?-1:1);
  const sp=Math.sin(ph),cp=Math.cos(ph);
  let thL=sp*.5*walkA,thR=-sp*.5*walkA,knL=-(Math.max(0,cp)*.95+.08)*walkA,knR=-(Math.max(0,-cp)*.95+.08)*walkA;
  let lean=hk*.1,roll=0,y=-Math.abs(sp)*.025*walkA-hk*.02;
  if(dead){
    // death: knees buckle and the hips drop, then the body topples forward with a slight twist and a small bounce
    const t=f.deadT??0,kn=easeOut(clamp(t/.32,0,1)),fl=clamp((t-.22)/.5,0,1),fall=fl*fl;
    const bt=(t-.72)/.25,bounce=bt>0&&bt<1?Math.sin(bt*Math.PI)*.06*(1-bt):0;
    if(t<.05)k.fallSide=Math.random()<.5?-1:1;
    thL=thR=.95*kn*(1-fall*.8);knL=knR=-1.75*kn*(1-fall*.75); // legs straighten out as the body hits the ground
    const hip=K_DIM.thigh*Math.cos(.95*kn)+K_DIM.shin*Math.cos(.8*kn); // hip height while kneeling
    lean=-(1.38-bounce)*fall;roll=k.fallSide*.22*fall;y=(hip-K_DIM.hipY)*(1-fall)+.08*fall;
    k.head.rotation.x-=.45*kn;k.head.rotation.z+=k.fallSide*.3*fall;
  }
  k.legL.rotation.x=thL;k.legR.rotation.x=thR;k.legL.userData.shin.rotation.x=knL;k.legR.userData.shin.rotation.x=knR;
  k.g.rotation.x=lean;k.g.rotation.z=roll;k.g.position.y=y;
  // eyes: blink every few seconds, squint when stunned, ✕ when dead
  k.blinkAt-=dt;if(k.blinkAt<=0){k.blinkT=.13;k.blinkAt=rand(2.2,4.5);}k.blinkT=Math.max(0,k.blinkT-dt);
  const ey=f.state==='stun'?.3:k.blinkT>0?.15:1;
  for(const e of k.eyes){e.visible=!dead;e.scale.y=ey;}for(const x of k.xMarks)x.visible=dead;
}
/* ---------------- poses (camera-space hand + rotation for the first-person view; b* = bot-space hand) ----------------
   Both are two-handed: camera-space hands are placed so the knight's real arms (from shoulders below the visor) reach the grip. */
const P=(x,y,z,yaw,pitch,roll,spin,bx,by,bz,byaw,bpitch)=>({x,y,z,yaw,pitch,roll,spin,bx,by,bz,byaw:byaw??yaw,bpitch:bpitch??pitch});
const POSE={
  idle:  P(.12,-.24,-.42, .15,-.35,-.25,0,   .42,1.0,-.38),
  slashW:P(.24,-.12,-.45, -1.0,-1.25,-.25,1.57, .7,1.3,-.05),
  slashE:P(-.27,-.32,-.35, 1.35,-1.5,.2,1.57, -.4,1.15,-.45),
  stabW: P(.24,-.27,-.36, .06,-1.5,0,0,     .5,.92,.25, .45,-1.2),
  stabE: P(.1,-.24,-.55, 0,-1.57,0,0,        .12,1.23,-.8),
  overW: P(.05,.3,-.3, .1,.55,-.1,0,          .45,1.75,-.05),
  overE: P(.13,-.45,-.55, 0,-2.1,0,0,          .1,.95,-.62),
  parry: P(-.06,-.15,-.5, 1.5,-1.25,0,1.57,     .15,1.42,-.62),
  recoil:P(.17,-.25,-.4, -.6,.25,-.6,0,       .5,1.55,-.05),
  stun:  P(.15,-.6,-.35, .3,-.1,-.6,0,         .4,.8,-.3),
};
// two-handed grips: bot-space hands sit in front of the chest so both arms reach without crossing the body
const TWO_B={idle:[0,1.23,-.43],slashW:[.32,1.42,-.27],slashE:[-.22,1.25,-.35],stabW:[.12,1.18,-.4],stabE:[.04,1.32,-.62],
  overW:[.1,1.75,-.22],overE:[.04,1.15,-.51],parry:[.04,1.5,-.38],recoil:[.26,1.6,-.2],stun:[.05,1.15,-.4]};
for(const k in TWO_B)[POSE[k].bx,POSE[k].by,POSE[k].bz]=TWO_B[k];
const POSE_KEYS=['x','y','z','yaw','pitch','roll','spin','bx','by','bz','byaw','bpitch'];
const W_OF={slash:'slashW',stab:'stabW',over:'overW'},E_OF={slash:'slashE',stab:'stabE',over:'overE'};
// bot-space hand travels around the body's vertical axis (angle, distance and height interpolated separately).
// The angle never wraps through the back, so swings and pose changes always pass in front of the knight,
// and the distance is kept outside the helmet / chest / legs blocks so the hand can't cut through the body.
const _h0={bx:0,by:0,bz:0};
function bodyClear(th,y){const s=Math.abs(Math.sin(th))+1e-3,c=Math.abs(Math.cos(th))+1e-3;let r=0;
  const box=(hx,hz)=>{r=Math.max(r,Math.min(hx/s,hz/c));};
  if(y>1.48)box(.15,.17);if(y>.75&&y<1.55)box(.21,.16);if(y<=.98)box(.17,.14);return r+.08;}
function arcHand(cur,a,b,t){
  const ta=Math.atan2(a.bx,-a.bz),tb=Math.atan2(b.bx,-b.bz),ra=Math.hypot(a.bx,a.bz),rb=Math.hypot(b.bx,b.bz);
  const th=lerp(ta,tb,t),y=lerp(a.by,b.by,t),r=Math.max(lerp(ra,rb,t),bodyClear(th,y));
  cur.bx=Math.sin(th)*r;cur.bz=-Math.cos(th)*r;cur.by=y;}
function poseFor(f,dt){
  const cur=f.pose,T=POSE;let tgt,k;
  switch(f.state){
    case'windup':tgt=T[W_OF[f.atkType]];k=f.riposte?30:26;break; // fast pose change so the attack type reads in the first ~100ms
    case'release':{const p=easeOut(clamp(f.t/f.dur,0,1));const a=T[W_OF[f.atkType]],b=T[E_OF[f.atkType]];for(const key of POSE_KEYS)cur[key]=lerp(a[key],b[key],p);arcHand(cur,a,b,p);return cur;}
    case'recovery':tgt=T.idle;k=9;break;
    case'parry':tgt=T.parry;k=32;break;
    case'recoil':tgt=T.recoil;k=22;break;
    case'stun':case'dead':tgt=T.stun;k=12;break;
    case'feint':tgt=T.idle;k=22;break;
    default:tgt=T.idle;k=12;
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
  const wp=buildWeapon(bot.weapon.id);wp.w.scale.setScalar(K_WPN);knight.pivot.add(wp.w);knight.weapon=wp;
  scene.add(knight.g);
}
let vm=null;const vmRoot=new THREE.Group();vmScene.add(vmRoot);
const VM_WPN=.7,PLAYER_TAB=0x4b5a78;
// shoulders in camera space: the camera sits at the visor, shoulders are lower and a little behind it
const VM_SH=[new THREE.Vector3(K_DIM.shX,K_DIM.torsoY+K_DIM.shY-EYE_H,-SH_FWD-EYE_Z),new THREE.Vector3(-K_DIM.shX,K_DIM.torsoY+K_DIM.shY-EYE_H,-SH_FWD-EYE_Z)];
const VM_POLE=[new THREE.Vector3(.7,-.7,.1),new THREE.Vector3(-.7,-.7,.1)],_vg=new THREE.Vector3(),_ve=new THREE.Euler(0,0,0,'YXZ');
function setupViewmodel(){
  if(vm)for(const o of vm.parts)vmRoot.remove(o);
  const pivot=new THREE.Group();pivot.rotation.order='YXZ';const wp=buildWeapon(player.weapon.id);wp.w.scale.setScalar(VM_WPN);pivot.add(wp.w);
  const {M}=knightMats(PLAYER_TAB);const arms=[buildArm(M,vmRoot,1),buildArm(M,vmRoot,-1)];
  // upper arms sit right at the camera: only forearms and gauntlets are drawn, slimmed so they don't wall off the view
  for(const a of arms){a.up.visible=false;a.w=.6;a.hw=.8;}
  vmRoot.add(pivot);vm={pivot,wp,arms,parts:[pivot,...arms.flatMap(a=>[a.up,a.lo,a.hand])],reachErr:0};
}
// call after vm.pivot is posed: right hand on the pivot, left hand further down the grip/haft
function updateViewArms(){
  const pv=vm.pivot;_vg.set(0,-.18*VM_WPN,0).applyEuler(_ve.set(pv.rotation.x,pv.rotation.y,pv.rotation.z,'YXZ')).add(pv.position);
  vm.reachErr=Math.max(ikPlace(vm.arms[0],VM_SH[0],pv.position,VM_POLE[0]),ikPlace(vm.arms[1],VM_SH[1],_vg,VM_POLE[1]));
}
