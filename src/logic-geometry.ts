import {BoxGeometry,CylinderGeometry,BufferGeometry,Shape,ExtrudeGeometry,PlaneGeometry,CanvasTexture,MeshStandardMaterial,SRGBColorSpace} from 'three';
import type {CatalogItem} from './catalog';
import {portsFor} from './logic-ports';
import {applyPhysicalUVs,TEXTURE_TILE_STUDS} from './texture-uv';
import {makeLogicHousingMaterial} from './materials';

// Small details are merged by surface in geometry.ts, not one mesh per part.
export function logicParts(item:CatalogItem,state={active:false,timing:1}):BufferGeometry[]{
 const [w,h,d]=item.size,parts:BufferGeometry[]=[];
 const add=(g:BufferGeometry,x:number,y:number,z:number,s:number)=>{
  g.translate(x,y-h/2,z);g.userData.surface=s;parts.push(g);return g;
 };
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,s=0)=>{
  const g=new BoxGeometry(a,b,c);applyPhysicalUVs(g,[a,b,c]);
  if(s===0){const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*4,uv.getY(i)*4);}
  return add(g,x,y,z,s);
 };
 const cyl=(r:number,l:number,x:number,y:number,z:number,s:number,axis:'x'|'y'|'z'='y',segments=24)=>{
  const g=new CylinderGeometry(r,r,l,segments);
  const uv=g.getAttribute('uv'),p=g.getAttribute('position'),n=g.getAttribute('normal');
  for(let i=0;i<uv.count;i++){
   if(Math.abs(n.getY(i))>.9)uv.setXY(i,p.getX(i)/TEXTURE_TILE_STUDS,p.getZ(i)/TEXTURE_TILE_STUDS);
   else uv.setXY(i,uv.getX(i)*2*Math.PI*r/TEXTURE_TILE_STUDS,uv.getY(i)*l/TEXTURE_TILE_STUDS);
  }
  if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);
  return add(g,x,y,z,s);
 };
 const decal=(width:number,height:number,x:number,y:number,z:number,s:number,rx=0,ry=0,flipU=false)=>{
  const g=new PlaneGeometry(width,height);g.rotateX(rx);g.rotateY(ry);
  if(flipU){const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
  g.userData.collisionSolids=[];return add(g,x,y,z,s);
 };
 const profile=(shape:Shape,depth:number,x:number,y:number,z:number,s=0)=>{
  const g=new ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:12});
  g.translate(0,0,-depth/2);applyPhysicalUVs(g,[w,h,depth]);
  if(s===0){const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*4,uv.getY(i)*4);}
  return add(g,x,y,z,s);
 };
 if(item.id==='lever'){
  // X is the long plate axis. Both hinge and grip run across its Z width.
  // OFF leans toward the output, ON away, matching Circuit Workbench.
  box(w-.12,.4,d,0,.2,0);
  const hood=new Shape();hood.moveTo(-.32,0);hood.absarc(0,0,.32,Math.PI,0,true);hood.lineTo(-.32,0);
  const cover=profile(hood,.62,0,.4,0,3),p=cover.getAttribute('position'),n=cover.getAttribute('normal');
  for(let i=0;i<n.count;i++)if(Math.abs(n.getZ(i))<.5&&n.getY(i)>0)n.setXYZ(i,p.getX(i)/.32,(p.getY(i)-(.4-h/2))/.32,0);
  cyl(.25,.66,0,.4,0,11,'z');
  const first=parts.length;
  box(.14,.98,.44,0,.89,0,3);
  cyl(.23,.84,0,1.38,0,2,'z');
  for(const z of [-.421,.421])cyl(.229,.002,0,1.38,z,10,'z');
  const pivot=.4-h/2,angle=(state.active?1:-1)*Math.PI/4;
  for(const g of parts.slice(first)){g.translate(0,-pivot,0);g.rotateZ(angle);g.translate(0,pivot,0);}
 }else if(item.id==='button'){
  box(w-.12,.4,d,0,.2,0);
  cyl(.37,state.active?.035:.1,0,state.active?.4175:.45,0,2);
 }else if(item.id==='pressure-plate'){
  box(w-.12,.23,d,0,.115,0);
  const pitch=(w-.28)/5,depth=d-.18;
  for(let i=0;i<5;i++){
   const x=-w/2+.14+pitch*(i+.5),seam=(i%2?1:-1)*(depth/2-.52);
   for(const [a,b] of [[-depth/2,seam-.006],[seam+.006,depth/2]]){
    const plank=box(pitch-.018,.07,b-a,x,.265,(a+b)/2,6);
    const uv=plank.getAttribute('uv');for(let j=0;j<uv.count;j++)uv.setXY(j,uv.getX(j)*1.8+i*.19,uv.getY(j)*1.8+i*.13);
   }
   for(const z of [-depth/2+.1,seam-.1,seam+.1,depth/2-.1])
    cyl(.022,.002,x+pitch*.28,.2998,z,11,'y',8).userData.collisionSolids=[];
  }
 }else{
  const timer=item.id==='signal-delay'||item.id==='signal-sustain';
  box(w-.12,.18,d,0,.09,0);
  const shape=new Shape(),half=(w-.2)/2,shoulder=timer?h-.5:h*.62;
  shape.moveTo(-half,.18);shape.lineTo(half,.18);shape.lineTo(half,shoulder);
  shape.lineTo(half*.62,h);shape.lineTo(-half*.62,h);shape.lineTo(-half,shoulder);shape.closePath();
  const depth=d-.16;profile(shape,depth,0,0,0);
  decal(.58,.48,0,h+.0004,0,7,-Math.PI/2);
  if(timer){
   const z=depth/2;
   cyl(.45,.035,-.4,1.3,z+.019,2,'z');
   decal(.8,.8,-.4,1.3,z+.037,9);
   box(.026,1.61,.018,.13,1.125,z+.01,4);
   box(.15,.17,.033,.13,.35+(state.timing-1)*.132,z+.022,5);
   box(.4,.105,.032,-.4,.35,z+.02,1);
   const meter=(length:number,y:number)=>{
    const g=new CylinderGeometry(.23,.23,length,20);g.scale(1,1,.34);
    add(g,.55,y,z,1);
   };
   if(item.id==='signal-delay')for(let i=0;i<12;i++)meter(.133,.337+i*.14);
   else meter(1.675,1.108);
  }else{
   decal(1.12,.57,0,.48,depth/2+.0004,8);
   // Rear markings must also point toward the physical +X output.
   decal(1.12,.57,0,.48,-depth/2-.0004,8,0,Math.PI,true);
  }
 }
 for(const p of portsFor(item.id)){
  const [x,y,z]=p.position;
  cyl(item.id==='pressure-plate'?.12:.15,.1,x-Math.sign(x)*.05,y+h/2,z,1,'x');
 }
 return parts;
}
function labelTexture(draw:(c:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;draw(canvas.getContext('2d')!);
 const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;t.anisotropy=4;
 return new MeshStandardMaterial({map:t,transparent:true,alphaTest:.05,roughness:.95,depthWrite:false});
}
function symbol(c:CanvasRenderingContext2D,id:string){
 c.strokeStyle='#898a80';c.lineWidth=7;c.lineJoin='round';c.lineCap='butt';
 const not=id==='signal-inverter',isAnd=id.includes('and'),xor=id.includes('xor')||id.includes('xnor'),neg=not||id.includes('nand')||id.includes('nor');
 c.beginPath();
 if(not){c.moveTo(65,40);c.lineTo(174,128);c.lineTo(65,216);c.closePath();}
 else if(isAnd){c.moveTo(75,40);c.lineTo(120,40);c.bezierCurveTo(215,40,215,216,120,216);c.lineTo(75,216);c.closePath();}
 else{c.moveTo(65,40);c.quadraticCurveTo(160,32,195,128);c.quadraticCurveTo(160,224,65,216);c.quadraticCurveTo(116,128,65,40);if(xor){c.moveTo(44,40);c.quadraticCurveTo(96,128,44,216);}}
 c.stroke();c.beginPath();
 if(not){c.moveTo(15,128);c.lineTo(65,128);}else for(const y of [84,172]){c.moveTo(10,y);c.lineTo(isAnd?75:82,y);}
 c.moveTo(neg?(not?202:221):195,128);c.lineTo(249,128);c.stroke();
 if(neg){c.beginPath();c.arc(not?188:207,128,12,0,Math.PI*2);c.stroke();}
}
function timerFace(c:CanvasRenderingContext2D,id:string){
 c.fillStyle='#080b0c';c.beginPath();c.arc(128,128,125,0,Math.PI*2);c.fill();
 c.strokeStyle='#d78736';c.fillStyle='#d78736';c.lineWidth=6;c.lineJoin='round';
 if(id==='signal-delay'){
  c.beginPath();c.arc(128,143,75,0,Math.PI*2);c.stroke();
  c.beginPath();c.moveTo(128,87);c.lineTo(128,143);c.lineTo(166,160);c.stroke();
  c.fillRect(111,36,34,12);c.fillRect(123,48,10,19);
  c.save();c.translate(187,83);c.rotate(.6);c.fillRect(-8,-10,16,13);c.restore();
 }else{
  c.beginPath();c.moveTo(76,35);c.lineTo(180,35);
  c.bezierCurveTo(180,87,161,110,133,129);c.bezierCurveTo(164,152,179,175,180,221);
  c.lineTo(76,221);c.bezierCurveTo(77,175,92,152,123,129);c.bezierCurveTo(95,110,76,87,76,35);c.closePath();c.stroke();
  c.beginPath();c.moveTo(102,86);c.lineTo(156,86);c.quadraticCurveTo(153,108,129,122);c.quadraticCurveTo(105,108,102,86);c.fill();
  c.fillRect(126,128,5,31);
  c.beginPath();c.moveTo(87,207);c.quadraticCurveTo(128,163,169,207);c.closePath();c.fill();
 }
}
export function makeLogicMaterials(wood:MeshStandardMaterial){
 const planks=wood.clone();planks.name='Pressure plate / weathered wood';planks.color.setHex(0x796758);
 const base=[makeLogicHousingMaterial(),
  new MeshStandardMaterial({name:'Logic / blue sockets',color:0x18313d,roughness:.88}),
  new MeshStandardMaterial({name:'Logic / orange controls',color:0xd47f2e,roughness:.86}),
  new MeshStandardMaterial({name:'Logic / pale handle',color:0xb5b7ad,roughness:.85}),
  new MeshStandardMaterial({color:0x111414,roughness:.9}),new MeshStandardMaterial({color:0xeeeeeb,roughness:.8}),planks,
  labelTexture(c=>{c.fillStyle='#959589';c.beginPath();c.moveTo(215,128);c.lineTo(61,192);c.lineTo(61,64);c.closePath();c.fill();})];
 const end=new MeshStandardMaterial({color:0xb8732e,roughness:.9}),hinge=new MeshStandardMaterial({color:0x54584f,roughness:.9});
 const materials=new Map<string,MeshStandardMaterial[]>();
 for(const id of ['lever','button','pressure-plate','and-gate','or-gate','xor-gate','nand-gate','nor-gate','xnor-gate','signal-inverter','signal-delay','signal-sustain'])
  materials.set(id,[...base,labelTexture(c=>symbol(c,id)),labelTexture(c=>timerFace(c,id)),end,hinge]);
 return materials;
}
