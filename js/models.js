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
function buildKnight(tab){
  const g=new THREE.Group();const M=c=>new THREE.MeshLambertMaterial({color:c});
  const steel=M(0x8a939c),dark=M(0x34383e),tabM=M(tab),leather=M(0x5a4030);
  const mats=[steel,dark,tabM,leather];
  const bx=(sx,sy,sz,m,x,y,z,p=g)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);me.position.set(x,y,z);me.castShadow=true;p.add(me);return me;};
  const leg=x=>{const p=new THREE.Group();p.position.set(x,.8,0);g.add(p);bx(.25,.62,.27,dark,0,-.31,0,p);bx(.27,.2,.32,steel,0,-.72,-.03,p);return p;};
  const legL=leg(-.15),legR=leg(.15);
  bx(.64,.72,.38,steel,0,1.15,0);bx(.54,.66,.02,tabM,0,1.07,-.2);bx(.54,.66,.02,tabM,0,1.07,.2);bx(.66,.1,.4,leather,0,.83,0);
  bx(.3,.18,.4,steel,-.42,1.47,0);bx(.3,.18,.4,steel,.42,1.47,0);
  const head=new THREE.Group();head.position.set(0,1.52,0);g.add(head);
  bx(.46,.48,.46,steel,0,.24,0,head);bx(.36,.05,.02,dark,0,.28,-.235,head);bx(.05,.2,.02,dark,0,.14,-.235,head);bx(.08,.16,.32,tabM,0,.56,.03,head);
  const arm=()=>{const a=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,1),steel);a.castShadow=true;g.add(a);return a;};
  const armR=arm(),armL=arm();
  const pivot=new THREE.Group();pivot.rotation.order='YXZ';g.add(pivot);
  return {g,legL,legR,head,armR,armL,pivot,mats,weapon:null};
}
const Z=new THREE.Vector3(0,0,1),tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();
function placeArm(arm,s,h){tmpV.copy(h).sub(s);const len=Math.max(.05,tmpV.length());arm.position.copy(s).addScaledVector(tmpV,.5);arm.quaternion.setFromUnitVectors(Z,tmpV.normalize());arm.scale.set(1,1,len);}

/* ---------------- poses (camera-space hand + rotation; b* = bot-space hand) ---------------- */
const P=(x,y,z,yaw,pitch,roll,spin,bx,by,bz,byaw,bpitch)=>({x,y,z,yaw,pitch,roll,spin,bx,by,bz,byaw:byaw??yaw,bpitch:bpitch??pitch});
const POSE={
  idle:  P(.32,-.42,-.55, .15,-.35,-.25,0,   .42,1.0,-.38),
  slashW:P(.24,-.12,-.5, -1.0,-1.25,-.25,1.57, .7,1.3,-.05),
  slashE:P(-.52,-.32,-.55, 1.35,-1.5,.2,1.57, -.6,1.15,-.45),
  stabW: P(.24,-.27,-.36, .06,-1.5,0,0,     .5,.92,.25, .45,-1.2),
  stabE: P(.1,-.24,-.95, 0,-1.57,0,0,        .12,1.28,-.8),
  overW: P(.22,.1,-.3, .1,.55,-.1,0,          .3,1.95,-.05),
  overE: P(.08,-.5,-.65, 0,-2.1,0,0,          .1,.95,-.62),
  parry: P(.04,-.1,-.5, 1.5,-1.25,0,1.57,     .1,1.48,-.45),
  recoil:P(.52,-.05,-.4, -.6,.25,-.6,0,       .58,1.6,-.05),
  stun:  P(.3,-.7,-.45, .3,-.1,-.6,0,         .4,.8,-.3),
};
const POSE_KEYS=['x','y','z','yaw','pitch','roll','spin','bx','by','bz','byaw','bpitch'];
const W_OF={slash:'slashW',stab:'stabW',over:'overW'},E_OF={slash:'slashE',stab:'stabE',over:'overE'};
function poseFor(f,dt){
  const cur=f.pose;let tgt,k;
  switch(f.state){
    case'windup':tgt=POSE[W_OF[f.atkType]];k=f.riposte?30:26;break; // fast pose change so the attack type reads in the first ~100ms
    case'release':{const p=easeOut(clamp(f.t/f.dur,0,1));const a=POSE[W_OF[f.atkType]],b=POSE[E_OF[f.atkType]];for(const key of POSE_KEYS)cur[key]=lerp(a[key],b[key],p);return cur;}
    case'recovery':tgt=POSE.idle;k=9;break;
    case'parry':tgt=POSE.parry;k=32;break;
    case'recoil':tgt=POSE.recoil;k=22;break;
    case'stun':case'dead':tgt=POSE.stun;k=12;break;
    case'feint':tgt=POSE.idle;k=22;break;
    default:tgt=POSE.idle;k=12;
  }
  const a=1-Math.exp(-k*dt);for(const key of POSE_KEYS)cur[key]=lerp(cur[key],tgt[key],a);return cur;
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
