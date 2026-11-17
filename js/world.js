// Renderer, bầu trời, ánh sáng, texture voxel và đấu trường
'use strict';
/* ---------------- renderer / scene ---------------- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.autoClear=false;
const scene=new THREE.Scene();
const HORIZON=new THREE.Color(0xc97f5c);
scene.fog=new THREE.Fog(HORIZON,28,120);
const camera=new THREE.PerspectiveCamera(75,1,.05,700);
camera.rotation.order='YXZ';
const vmScene=new THREE.Scene();
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

// sky
const sky=new THREE.Mesh(new THREE.SphereGeometry(500,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(0x1c2846)},mid:{value:HORIZON.clone()},bot:{value:new THREE.Color(0x2b2420)},sun:{value:new THREE.Vector3(-.75,.18,.62).normalize()}},
  vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 top,mid,bot,sun;varying vec3 vP;void main(){vec3 n=normalize(vP);float h=n.y;vec3 c=h>0.0?mix(mid,top,pow(h,0.5)):mix(mid,bot,pow(-h,0.35));float s=max(dot(n,sun),0.0);c+=vec3(1.0,0.7,0.4)*pow(s,60.0)*0.9+vec3(1.0,0.55,0.3)*pow(s,6.0)*0.25;gl_FragColor=vec4(c,1.0);}'}));
scene.add(sky);

// lights
scene.add(new THREE.HemisphereLight(0xa9b8d8,0x5a4430,.62));
const sunL=new THREE.DirectionalLight(0xffc49a,.95);
sunL.position.set(-30,22,25);sunL.castShadow=true;sunL.shadow.mapSize.set(2048,2048);
Object.assign(sunL.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:90});
sunL.shadow.bias=-.0006;
scene.add(sunL);scene.add(sunL.target);
vmScene.add(new THREE.HemisphereLight(0xb8c4dc,0x5a4430,.85));
const vmDir=new THREE.DirectionalLight(0xffd2aa,.8);vmDir.position.set(-1,2,1.5);vmScene.add(vmDir);

/* ---------------- textures ---------------- */
let seed=1337;const srand=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
function hex2rgb(h){return[(h>>16)&255,(h>>8)&255,h&255];}
function px(g,x,y,h,j){const c=hex2rgb(h);const k=1+(srand()*2-1)*j;g.fillStyle=`rgb(${clamp(c[0]*k,0,255)|0},${clamp(c[1]*k,0,255)|0},${clamp(c[2]*k,0,255)|0})`;g.fillRect(x,y,1,1);}
function mkTex(fn,repeat){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');fn(g);const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);}return t;}
const fill=(base,j)=>g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)px(g,x,y,base,j);};
const T={
  grassTop:mkTex(fill(0x5b8a3a,.13)),
  grassSide:mkTex(g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const edge=3+((x*7+3)%3===0?1:0);px(g,x,y,y<edge?0x5b8a3a:0x7a5535,.13);}}),
  dirt:mkTex(fill(0x7a5535,.14)),
  sand:mkTex(g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)px(g,x,y,srand()<.08?0xa38a5a:0xcbb27c,.06);}),
  cobble:mkTex(g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const m=(y%5===0)||((x+(Math.floor(y/5)%2)*3)%6===0);px(g,x,y,m?0x55585c:0x8b8e92,.1);}}),
  brick:mkTex(g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++){const m=(y%4===3)||((x+(Math.floor(y/4)%2)*4)%8===7);px(g,x,y,m?0x5f5d58:0x9a968c,.07);}}),
  stone:mkTex(fill(0x85878a,.09)),
  log:mkTex(g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)px(g,x,y,x%4===0?0x4a3520:0x654a2c,.1);}),
  leaves:mkTex(g=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)px(g,x,y,srand()<.18?0x2b4a1c:0x3f6b2a,.15);}),
  ground:mkTex(fill(0x587f38,.12),240)
};
const lam=m=>new THREE.MeshLambertMaterial({map:m});
const MATS={
  grass:[lam(T.grassSide),lam(T.grassSide),lam(T.grassTop),lam(T.dirt),lam(T.grassSide),lam(T.grassSide)],
  sand:lam(T.sand),dirt:lam(T.dirt),cobble:lam(T.cobble),brick:lam(T.brick),stone:lam(T.stone),log:lam(T.log),
  leaves:new THREE.MeshLambertMaterial({map:T.leaves,color:0xdddddd})
};

/* ---------------- arena ---------------- */
const blocks={};const add=(t,x,y,z)=>(blocks[t]=blocks[t]||[]).push([x,y,z]);
const HALF=15;
for(let x=-HALF-1;x<HALF+1;x++)for(let z=-HALF-1;z<HALF+1;z++){
  const cx=x+.5,cz=z+.5,r=Math.hypot(cx,cz);
  const wall=x===-HALF-1||x===HALF||z===-HALF-1||z===HALF;
  if(wall){add('stone',x,-1,z);for(let y=0;y<4;y++)add('cobble',x,y,z);if((x+z)%2===0)add('stone',x,4,z);continue;}
  const n=Math.sin(x*1.7)*Math.cos(z*1.3)*.8;
  add(r<8.6+n?'sand':(srand()<.06?'dirt':'grass'),x,-1,z);
}
const PILLARS=[[-7,-7],[6,-7],[-7,6],[6,6]];
for(const[x,z]of PILLARS)for(let y=0;y<3;y++)add('brick',x,y,z);
// trees outside
const treeSpots=[];
for(let i=0;i<22;i++){const a=srand()*Math.PI*2,d=21+srand()*24;treeSpots.push([Math.round(Math.cos(a)*d),Math.round(Math.sin(a)*d)]);}
for(const[x,z]of treeSpots){const h=4+Math.floor(srand()*3);for(let y=0;y<h;y++)add('log',x,y,z);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=h-2;dy<=h;dy++){if(Math.abs(dx)===2&&Math.abs(dz)===2)continue;if(dy===h&&(Math.abs(dx)>1||Math.abs(dz)>1))continue;if(dx===0&&dz===0&&dy<h)continue;add('leaves',x+dx,dy,z+dz);}
  add('leaves',x,h+1,z);}
{const box=new THREE.BoxGeometry(1,1,1);const m=new THREE.Matrix4();
 for(const t in blocks){const L=blocks[t];const mesh=new THREE.InstancedMesh(box,MATS[t],L.length);L.forEach((p,i)=>{m.makeTranslation(p[0]+.5,p[1]+.5,p[2]+.5);mesh.setMatrixAt(i,m);});mesh.castShadow=t!=='sand'&&t!=='grass';mesh.receiveShadow=true;scene.add(mesh);}}
{const g=new THREE.Mesh(new THREE.PlaneGeometry(480,480),lam(T.ground));g.rotation.x=-Math.PI/2;g.position.y=-.02;g.receiveShadow=true;scene.add(g);}
// torches on pillars
const torches=[];
{const wood=new THREE.MeshLambertMaterial({color:0x5a3d22});const flameM=new THREE.MeshBasicMaterial({color:0xffb050});
 for(const[x,z]of PILLARS){const s=new THREE.Mesh(new THREE.BoxGeometry(.14,.5,.14),wood);s.position.set(x+.5,3.25,z+.5);scene.add(s);
  const f=new THREE.Mesh(new THREE.BoxGeometry(.2,.22,.2),flameM);f.position.set(x+.5,3.6,z+.5);scene.add(f);
  const l=new THREE.PointLight(0xff9a48,1.1,13,1.6);l.position.set(x+.5,3.9,z+.5);scene.add(l);torches.push({l,f,ph:srand()*10});}}
// banners: original crest (gold chevron over two stripes)
function bannerTex(c1,c2){const c=document.createElement('canvas');c.width=16;c.height=40;const g=c.getContext('2d');g.fillStyle=c1;g.fillRect(0,0,16,40);g.fillStyle=c2;g.fillRect(0,30,16,3);g.fillRect(0,35,16,2);g.fillStyle='#d6ae48';for(let i=0;i<8;i++){g.fillRect(i,12+i,2,2);g.fillRect(14-i,12+i,2,2);}g.fillRect(7,6,2,4);for(let x=0;x<16;x+=4){g.clearRect(x,38,2,2);}const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;return t;}
{const bt=[bannerTex('#7d1f1a','#3b0d0b'),bannerTex('#27355a','#10182c')];
 const places=[[0,-HALF+.02,0],[0,HALF-.02,Math.PI],[-HALF+.02,0,Math.PI/2],[HALF-.02,0,-Math.PI/2]];
 places.forEach((p,i)=>{for(const off of[-4,4]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.2,3),new THREE.MeshLambertMaterial({map:bt[(i+(off>0?1:0))%2],side:THREE.DoubleSide,transparent:true,alphaTest:.5}));
   if(i<2){m.position.set(off,2.3,p[1]);}else{m.position.set(p[0],2.3,off);}m.rotation.y=p[2];scene.add(m);}});}
