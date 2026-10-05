import {Box3,Frustum,Matrix4,Quaternion,Vector3,type PerspectiveCamera} from 'three';
import type {Vec3} from './catalog';
import {type Wire,type Endpoint,wirePath,endpointPosition,wiresWithinSelection} from './logic-ports';
import {pieceBounds,type Piece,type World} from './world';
import {round,snapMovement,turnRotation} from './placement';
import {surfaceSupport} from './collision';
import {wireParts,wirePartSolid,type WireFrame} from './wire-shape';
import {wireCollarRadius,wireLength,wireLimit,wireSpaceIssue} from './wire-design';
import {WireCollisionIndex} from './wire-collision';

export interface Assembly {pieces:Piece[];wires:Wire[]}
/** Only route anchors are needed; never copy every unrelated scene piece. */
export function assemblyAnchors(assembly:Assembly,existing:Map<string,Piece>){
 const anchors=new Map(assembly.pieces.map(p=>[p.id,p] as const));
 for(const w of assembly.wires)for(const e of [w.from,w.to])if('piece' in e&&!anchors.has(e.piece))anchors.set(e.piece,existing.get(e.piece)!);
 return anchors;
}
export function selectedAssembly(world:World,pieces:Piece[],wireIds:ReadonlySet<string>):Assembly{
 const ids=new Set(pieces.map(p=>p.id)),routes=new Map((ids.size?wiresWithinSelection(world.wires,world.pieces,ids):[]).map(w=>[w.id,w]));
 for(const w of world.wires)if(wireIds.has(w.id))routes.set(w.id,w);
 const end=(e:Endpoint):Endpoint=>'piece' in e&&!ids.has(e.piece)?{point:endpointPosition(e,world.pieces)}:structuredClone(e);
 return {pieces:structuredClone(pieces),wires:[...routes.values()].map(w=>({...structuredClone(w),from:end(w.from),to:end(w.to)}))};
}
export function assemblyBounds(a:Assembly,existing:Map<string,Piece>){
 const box=new Box3(),items=assemblyAnchors(a,existing);
 for(const p of a.pieces){const b=pieceBounds(p);box.expandByPoint(new Vector3(...b.min));box.expandByPoint(new Vector3(...b.max));}
 for(const w of a.wires)for(const part of wireParts(w,wirePath(w,items)))box.union(wirePartSolid(part).bounds);
 if(box.isEmpty())box.set(new Vector3(),new Vector3());
 return {min:box.min.toArray() as Vec3,max:box.max.toArray() as Vec3,center:box.getCenter(new Vector3()).toArray() as Vec3,size:box.getSize(new Vector3()).toArray() as Vec3};
}
export function transformAssembly(a:Assembly,delta:Vec3,turn=new Quaternion(),center:Vec3=[0,0,0],axis?:number):Assembly{
 const origin=new Vector3(...center),shift=new Vector3(...delta);
 // A rigid transform must preserve route length, including wires exactly at
 // their budget. Rounding each endpoint independently can stretch a diagonal.
 const point=(p:Vec3)=>new Vector3(...p).sub(origin).applyQuaternion(turn).add(origin).add(shift).toArray().map(v=>Math.abs(v)<1e-12?0:v) as Vec3;
 const end=(e:Endpoint):Endpoint=>'point' in e?{point:point(e.point)}:structuredClone(e);
 return {pieces:a.pieces.map(p=>({...p,position:point(p.position),rotation:axis===undefined?[...p.rotation]:turnRotation(p.rotation,axis)})),
  wires:a.wires.map(w=>({...w,from:end(w.from),to:end(w.to),points:w.points.map(point),frame:turn.clone().multiply(new Quaternion(...(w.frame??[0,0,0,1]))).normalize().toArray() as WireFrame}))};
}
export function rotateAssembly(a:Assembly,axis:number,existing:Map<string,Piece>){
 return transformAssembly(a,[0,0,0],new Quaternion().setFromAxisAngle(new Vector3().setComponent(axis,1),Math.PI/2),assemblyBounds(a,existing).center,axis);
}
export function placeAssemblyOnSurface(a:Assembly,point:Vec3,normal:Vec3,existing:Map<string,Piece>,elevation=0):Assembly{
 const bounds=assemblyBounds(a,existing),axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
 const center=point.map((v,i)=>snapMovement(v,bounds.center[i])) as Vec3,items=assemblyAnchors(a,existing),n=new Vector3(...normal),origin=new Vector3(...bounds.center);
 let support=a.pieces.length?surfaceSupport(a.pieces,bounds.center,normal):-Infinity;
 for(const w of a.wires)for(const part of wireParts(w,wirePath(w,items)))for(const v of wirePartSolid(part).vertices)support=Math.max(support,-v.clone().sub(origin).dot(n));
 // Ground validation reserves collar clearance at both ends, including upright
 // routes whose visible collar extends along the route rather than below it.
 if(normal[1]===1)for(const w of a.wires)for(const p of wirePath(w,items))support=Math.max(support,bounds.center[1]-p[1]+wireCollarRadius(w));
 const plane=point.reduce((sum,v,i)=>sum+v*normal[i],0),tangent=center.reduce((sum,v,i)=>sum+(i===axis?0:v*normal[i]),0);
 center[axis]=(plane+support-tangent)/normal[axis];center[1]+=elevation;
 return transformAssembly(a,center.map((v,i)=>round(v-bounds.center[i])) as Vec3);
}
export function copyAssembly(a:Assembly,nextId:()=>string=()=>crypto.randomUUID()):Assembly{
 const ids=new Map(a.pieces.map(p=>[p.id,nextId()]));
 const end=(e:Endpoint):Endpoint=>'piece' in e?{piece:ids.get(e.piece)!,port:e.port}:structuredClone(e);
 return {pieces:a.pieces.map(p=>({...structuredClone(p),id:ids.get(p.id)!})),wires:a.wires.map(w=>({...structuredClone(w),id:nextId(),from:end(w.from),to:end(w.to)}))};
}
export function assemblyIssue(world:World,a:Assembly,copy:boolean):string|null{
 const ignored=new Set(copy?[]:a.pieces.map(p=>p.id));
 for(const p of a.pieces){const issue=world.placementIssue(p,ignored);if(issue)return issue;}
 if(copy&&!world.allowOverlaps&&world.hasInternalOverlaps(a.pieces))return 'overlap';
 const old=new Map(world.wires.map(w=>[w.id,w]));let serial=0;
 // Previews need distinct IDs for collision checks, not permanent UUIDs.
 const previewId=()=>{let id:string;do{id=`preview:${serial++}`;}while(world.pieces.has(id)||old.has(id));return id;};
 const preview=copy?copyAssembly(a,previewId):a,items=assemblyAnchors(preview,world.pieces),batch=new WireCollisionIndex(preview.wires,items);
 const wireIds=new Set(copy?[]:a.wires.map(w=>w.id));
 for(let i=0;i<preview.wires.length;i++){
  const w=preview.wires[i];if(!w.kind)continue;
  const original=copy?undefined:old.get(w.id),limit=Math.max(wireLimit(w),original?wireLength(wirePath(original,world.pieces)):0);
  if(wireLength(wirePath(w,items))>limit+1e-6)return `Wire exceeds its ${wireLimit(w)}-stud limit.`;
  const space=wireSpaceIssue(wirePath(w,items),w,world.plots);if(space&&(!original||!wireSpaceIssue(wirePath(original,world.pieces),original,world.plots)))return space;
  const collision=world.wireCollisions.issue(w,items,wireIds)??batch.issue(w,items,undefined,false);if(collision)return collision;
 }return null;
}
export function selectWiresInRectangle(world:World,camera:PerspectiveCamera,viewport:{left:number;top:number;width:number;height:number},from:readonly number[],to:readonly number[],distance:number){
 const left=Math.max(0,Math.min(from[0],to[0])-viewport.left),top=Math.max(0,Math.min(from[1],to[1])-viewport.top);
 const right=Math.min(viewport.width,Math.max(from[0],to[0])-viewport.left),bottom=Math.min(viewport.height,Math.max(from[1],to[1])-viewport.top);
 if(right<=left||bottom<=top)return [];
 camera.updateMatrixWorld();const crop=camera.clone();crop.far=Math.min(camera.far,distance);crop.setViewOffset(viewport.width,viewport.height,left,top,right-left,bottom-top);crop.updateProjectionMatrix();crop.updateMatrixWorld();
 const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(crop.projectionMatrix,crop.matrixWorldInverse));
 // Clip each route segment to the selection frustum, expanded by its thickness.
 // Testing the entire route's bounding box would select empty space inside bends.
 const intersects=(a:Vector3,b:Vector3,radius:number)=>{
  let lo=0,hi=1;
  for(const plane of frustum.planes){const da=plane.distanceToPoint(a)+radius,db=plane.distanceToPoint(b)+radius;
   if(da<0&&db<0)return false;if(da<0)lo=Math.max(lo,da/(da-db));else if(db<0)hi=Math.min(hi,da/(da-db));if(lo>hi)return false;
  }return true;
 };
 return world.wires.filter(w=>wireParts(w,wirePath(w,world.pieces)).some(p=>intersects(p.a,p.b,p.radius))).map(w=>w.id);
}
