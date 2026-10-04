import {BoxGeometry,CylinderGeometry,BufferGeometry,Shape,ExtrudeGeometry,PlaneGeometry,CanvasTexture,MeshStandardMaterial,SRGBColorSpace} from 'three';
import type {CatalogItem} from './catalog';
import {portsFor} from './logic-ports';
import {applyPhysicalUVs} from './texture-uv';

export function logicParts(item:CatalogItem,state={active:false,timing:1}):BufferGeometry[]{
 const [w,h,d]=item.size,parts:BufferGeometry[]=[];
 const add=(g:BufferGeometry,x:number,y:number,z:number,s:number)=>{g.translate(x,y-h/2,z);g.userData.surface=s;parts.push(g);};
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,s=0)=>{const g=new BoxGeometry(a,b,c);if(s===6)applyPhysicalUVs(g,[a,b,c]);add(g,x,y,z,s);};
 const cyl=(r:number,l:number,x:number,y:number,z:number,s:number,rz=0,rx=0)=>{const g=new CylinderGeometry(r,r,l,24);g.rotateZ(rz);g.rotateX(rx);add(g,x,y,z,s);};
 const decal=(width:number,height:number,x:number,y:number,z:number,s:number,rx=0,ry=0)=>{const g=new PlaneGeometry(width,height);g.rotateX(rx);g.rotateY(ry);g.userData.collisionSolids=[];add(g,x,y,z,s);};
 const source=['lever','button','pressure-plate'].includes(item.id);
 const timer=item.id==='signal-delay'||item.id==='signal-sustain';
 if(source){
  box(w-.16,.28,d,0,.14,0);
  if(item.id==='button')cyl(.48,state.active?.07:.18,0,state.active?.335:.39,0,2);
  if(item.id==='lever'){
   cyl(.42,.7,0,.42,0,3,Math.PI/2);
   const first=parts.length;
   box(.2,1.03,.34,0,.96,0,3);
   cyl(.25,1.0,0,1.7,0,2,Math.PI/2);
   const pivot=.44-h/2;for(const g of parts.slice(first)){g.translate(0,-pivot,0);g.rotateZ(state.active?-.35:.1);g.translate(0,pivot,0);}
  }
  if(item.id==='pressure-plate'){
   for(let i=0;i<5;i++)box((w-.3)/5-.014,.09,d-.14,-(w-.3)/2+((w-.3)/5)*(i+.5),.255,0,6);
   for(const x of [-1.65,1.65])for(const z of [-1.55,1.55])cyl(.033,.004,x,.298,z,3);
  }
 }else{
  box(w-.12,.18,d,0,.09,0);
  const shape=new Shape(),half=(w-.2)/2;
  shape.moveTo(-half,.18);shape.lineTo(half,.18);shape.lineTo(half,h*.62);shape.lineTo(half*.62,h);shape.lineTo(-half*.62,h);shape.lineTo(-half,h*.62);shape.closePath();
  const depth=d-(timer?.16:.05);
  const g=new ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});g.translate(0,0,-depth/2);add(g,0,0,0,0);
  decal(.65,.5,0,h+.0003,0,7,-Math.PI/2);
  if(timer){
   const z=d/2-.04;
   cyl(.43,.045,-.4,h*.54,z-.012,2,0,Math.PI/2);
   decal(.75,.75,-.4,h*.54,z+.013,9);
   box(.025,h*.57,.025,.13,h*.43,z+.005,4);
   box(.15,.16,.04,.13,.35+(state.timing-1)*.123,z+.005,5);
   box(.35,.095,.035,-.4,.34,z,1);
   // Delay has distinct stacked meter segments; Sustain has a smooth meter.
   const meter=(length:number,y:number)=>{const g=new CylinderGeometry(.19,.19,length,16);g.scale(1,1,.35);add(g,.49,y,depth/2,1);};
   if(item.id==='signal-delay')for(let i=0;i<12;i++)meter(.115,.3+i*.123);
   else meter(1.47,1.0);
  }else{
   decal(1.15,.57,0,.48,d/2-.01,8);
   decal(1.15,.57,0,.48,-d/2+.01,8,0,Math.PI);
  }
 }
 for(const p of portsFor(item.id)){
  const [x,y,z]=p.position;cyl(.135,.14,x-Math.sign(x)*.07,y+h/2,z,1,Math.PI/2);
 }
 return parts;
}
function labelTexture(draw:(c:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d')!;draw(c);
 const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;t.anisotropy=4;
 return new MeshStandardMaterial({map:t,transparent:true,alphaTest:.05,roughness:.9,depthWrite:false});
}
function symbol(c:CanvasRenderingContext2D,id:string){
 c.strokeStyle='#94948b';c.lineWidth=9;c.lineJoin='round';c.lineCap='round';
 const not=id==='signal-inverter',isAnd=id.includes('and'),xor=id.includes('xor')||id.includes('xnor'),neg=not||id.includes('nand')||id.includes('nor');
 c.beginPath();
 if(not){c.moveTo(65,40);c.lineTo(174,128);c.lineTo(65,216);c.closePath();}
 else if(isAnd){c.moveTo(75,40);c.lineTo(120,40);c.bezierCurveTo(215,40,215,216,120,216);c.lineTo(75,216);c.closePath();}
 else{c.moveTo(65,40);c.quadraticCurveTo(160,32,195,128);c.quadraticCurveTo(160,224,65,216);c.quadraticCurveTo(116,128,65,40);if(xor){c.moveTo(44,40);c.quadraticCurveTo(96,128,44,216);}}
 c.stroke();c.beginPath();
 if(not){c.moveTo(15,128);c.lineTo(65,128);}else{for(const y of [84,172]){c.moveTo(10,y);c.lineTo(isAnd?75:82,y);}}
 c.moveTo(neg?218:195,128);c.lineTo(249,128);c.stroke();
 if(neg){c.beginPath();c.arc(not?188:207,128,12,0,Math.PI*2);c.stroke();}
}
export function makeLogicMaterials(wood:MeshStandardMaterial){
 const base=[new MeshStandardMaterial({color:0x55554c,roughness:.86}),new MeshStandardMaterial({color:0x172d37,roughness:.7}),
 new MeshStandardMaterial({color:0xe78b2b,roughness:.7}),new MeshStandardMaterial({color:0xb4b5af,metalness:.25,roughness:.55}),
 new MeshStandardMaterial({color:0x141516}),new MeshStandardMaterial({color:0xeeeeeb}),wood,
 labelTexture(c=>{c.fillStyle='#aaa99b';c.beginPath();c.moveTo(235,128);c.lineTo(48,195);c.lineTo(85,128);c.lineTo(48,61);c.closePath();c.fill();})];
 const materials=new Map<string,MeshStandardMaterial[]>();
 for(const id of ['lever','button','pressure-plate','and-gate','or-gate','xor-gate','nand-gate','nor-gate','xnor-gate','signal-inverter','signal-delay','signal-sustain']){
  materials.set(id,[...base,labelTexture(c=>symbol(c,id)),labelTexture(c=>{
   c.fillStyle='#101315';c.beginPath();c.arc(128,128,123,0,Math.PI*2);c.fill();c.strokeStyle='#e78b2b';c.lineWidth=7;
   if(id==='signal-delay'){c.beginPath();c.arc(128,143,76,0,Math.PI*2);c.moveTo(128,88);c.lineTo(128,142);c.lineTo(160,170);c.moveTo(110,40);c.lineTo(145,40);c.moveTo(128,40);c.lineTo(128,64);c.stroke();}
   else{c.beginPath();c.moveTo(65,43);c.lineTo(195,43);c.bezierCurveTo(190,106,147,112,132,128);c.bezierCurveTo(178,150,188,181,195,212);c.lineTo(65,212);c.bezierCurveTo(72,165,98,148,125,128);c.bezierCurveTo(92,108,72,76,65,43);c.stroke();}
  })]);
 }return materials;
}
