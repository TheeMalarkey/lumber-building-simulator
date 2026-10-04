import {Box3,CylinderGeometry,Matrix3,Matrix4,Quaternion,SphereGeometry,Vector3} from 'three';
import type {Vec3} from './catalog';
import {wireRadius,wireCollarRadius,type WireStyle} from './wire-design';
import {solidFromGeometry,type Solid} from './solid';

export interface WirePart {
 kind:'tube'|'collar'|'bend';a:Vector3;b:Vector3;radius:number;segment:number;frame?:WireFrame;
}
export type WireFrame=[number,number,number,number];
type ShapeStyle=WireStyle&{frame?:WireFrame};
export interface WireSurface {wireId:string;point:Vec3;normal:Vec3}
const up=new Vector3(0,1,0);
export const wireTubeGeometry=()=>new CylinderGeometry(1,1,1,12);
export const wireBendGeometry=()=>new SphereGeometry(1,10,6);
const tube=wireTubeGeometry(),bend=wireBendGeometry();
const shapes={tube:solidFromGeometry(tube)[0],bend:solidFromGeometry(bend)[0]};tube.dispose();bend.dispose();
const solids=new Map<WirePart,Solid>();
/** Bound detailed collision meshes independently of the number of wires. */
export function wirePartSolid(p:WirePart){
 const cached=solids.get(p);if(cached)return cached;
 const base=shapes[p.kind==='bend'?'bend':'tube'],matrix=wirePartMatrix(p),normal=new Matrix3().getNormalMatrix(matrix);
 const s:Solid={vertices:base.vertices.map(v=>v.clone().applyMatrix4(matrix)),normals:base.normals.map(v=>v.clone().applyNormalMatrix(normal)),edges:base.edges.map(v=>v.clone().transformDirection(matrix)),bounds:new Box3()};
 s.bounds.setFromPoints(s.vertices);solids.set(p,s);if(solids.size>512)solids.delete(solids.keys().next().value!);return s;
}
export const wirePartBounds=(p:WirePart)=>new Box3().setFromPoints([p.a,p.b]).expandByScalar(p.radius);
export function wirePartMatrix(p:WirePart){
 const frame=p.frame?new Quaternion(...p.frame):new Quaternion();
 if(p.kind==='bend')return new Matrix4().compose(p.a,frame,new Vector3().setScalar(p.radius));
 const delta=p.b.clone().sub(p.a),length=delta.length(),localDirection=delta.divideScalar(length).applyQuaternion(frame.clone().invert());
 const rotation=frame.multiply(new Quaternion().setFromUnitVectors(up,localDirection));
 return new Matrix4().compose(p.a.clone().add(p.b).multiplyScalar(.5),rotation,new Vector3(p.radius,length,p.radius));
}
/** One recipe for the visible mesh, surface picking and collision. Flat end
 * faces matter: capsules would incorrectly reject end-to-end contact. */
const cleanPath=(points:readonly Vec3[])=>points.map(p=>new Vector3(...p)).filter((p,i,all)=>!i||p.distanceToSquared(all[i-1])>1e-10);
function collars(style:ShapeStyle,path:Vector3[]):WirePart[]{
 if(path.length<2)return [];
 return [[0,1,0],[path.length-1,path.length-2,path.length-2]].map(([index,neighbor,segment])=>{
  const a=path[index],d=path[neighbor].clone().sub(a),length=d.length();
  return {kind:'collar',a,b:a.clone().add(d.multiplyScalar(Math.min(.14,length*.35)/length)),radius:wireCollarRadius(style),segment,frame:style.frame};
 });
}
export const wireEndParts=(style:ShapeStyle,points:readonly Vec3[])=>collars(style,cleanPath(points));
export function wireParts(style:ShapeStyle,points:readonly Vec3[]):WirePart[]{
 const path=cleanPath(points),parts:WirePart[]=[],r=wireRadius(style);
 if(path.length<2)return parts;
 for(let i=1;i<path.length;i++){
  parts.push({kind:'tube',a:path[i-1],b:path[i],radius:r,segment:i-1,frame:style.frame});
  if(i<path.length-1)parts.push({kind:'bend',a:path[i],b:path[i],radius:r,segment:i-1,frame:style.frame});
 }
 parts.push(...collars(style,path));
 return parts;
}
