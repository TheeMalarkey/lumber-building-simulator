import {BoxGeometry,CylinderGeometry,BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {applyPhysicalUVs} from './texture-uv';

/** Fixed motor bar and a thin, upward-hinged diamond plate. Coordinates centered. */
export function hatchParts(){
 const parts:BufferGeometry[]=[];
 const box=(size:[number,number,number],position:[number,number,number],surface:number,fixed:boolean)=>{
  const g=new BoxGeometry(...size);applyPhysicalUVs(g,size);
  if(surface===1){const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2,uv.getY(i)*2);}
  g.translate(...position);g.userData={surface,doorFixed:fixed};parts.push(g);
 };
 box([4,1,.455],[0,0,1.7275],0,true);
 box([4,.18,3.5],[0,-.4,-.25],1,false);
 const disk=(radius:number,depth:number,z:number,surface:number)=>{
  const g=new CylinderGeometry(radius,radius,depth,32);g.rotateX(Math.PI/2);g.translate(0,0,z);g.userData={surface,doorFixed:true};parts.push(g);
 };
 disk(.38,.024,1.961,2);disk(.31,.026,1.978,3);
 // The round control carries a small return-arrow symbol.
 for(const [x,y,angle,length] of [[0,0,-.6,.42],[-.146,.057,-1.6,.11],[-.108,.123,.4,.11],[.146,-.057,-1.6,.11],[.108,-.123,.4,.11]]){
  const g=new BoxGeometry(length,.01,.009);g.rotateZ(angle);g.translate(x,y,1.995);g.userData={surface:2,doorFixed:true,collisionSolids:[]};parts.push(g);
 }
 return parts;
}
const meshes=new Map<boolean,BufferGeometry>();
export function hatchGeometry(fixed:boolean){
 let result=meshes.get(fixed);if(result)return result;
 const parts=hatchParts().filter(g=>{if(g.userData.doorFixed===fixed)return true;g.dispose();return false;}).sort((a,b)=>a.userData.surface-b.userData.surface);
 const flat=parts.map(g=>g.toNonIndexed());result=mergeGeometries(flat)!;let offset=0;
 parts.forEach((g,i)=>{const count=flat[i].getAttribute('position').count;result!.addGroup(offset,count,g.userData.surface);offset+=count;});
 for(const g of [...parts,...flat])g.dispose();result.computeBoundingBox();result.computeBoundingSphere();meshes.set(fixed,result);return result;
}
