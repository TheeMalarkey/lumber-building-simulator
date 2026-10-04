import { Box3, Frustum, Matrix4, PerspectiveCamera } from "three";
import { type Vec3 } from "./catalog";
import { round, snapMovement } from "./placement";
import { pieceBounds, type Piece, type World } from "./world";
import { surfaceSupport } from "./collision";

export function selectionBounds(pieces: readonly Piece[]) {
  const min: Vec3 = [Infinity,Infinity,Infinity], max: Vec3 = [-Infinity,-Infinity,-Infinity];
  for (const p of pieces) {
    const b = pieceBounds(p);
    for (let i=0;i<3;i++) { min[i]=Math.min(min[i],b.min[i]);max[i]=Math.max(max[i],b.max[i]); }
  }
  return {min,max,center:min.map((v,i)=>round((v+max[i])/2)) as Vec3,size:min.map((v,i)=>round(max[i]-v)) as Vec3};
}
export function translateSelection(pieces: readonly Piece[], delta: Vec3): Piece[] {
  return pieces.map(p=>({...p,position:p.position.map((v,i)=>round(v+delta[i])) as Vec3,rotation:[...p.rotation]}));
}
export function placeSelectionOnSurface(pieces: readonly Piece[], point: Vec3, normal: Vec3, elevation=0): Piece[] {
  const b=selectionBounds(pieces);
  const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const center=point.map((v,i)=>snapMovement(v,b.center[i])) as Vec3;
  const support=surfaceSupport(pieces,b.center,normal);
  const plane=point.reduce((sum,v,i)=>sum+v*normal[i],0);
  const tangent=center.reduce((sum,v,i)=>sum+(i===axis?0:v*normal[i]),0);
  center[axis]=(plane+support-tangent)/normal[axis];
  center[1]+=elevation;
  return translateSelection(pieces,center.map((v,i)=>round(v-b.center[i])) as Vec3);
}
export function selectInRectangle(world: World, camera: PerspectiveCamera,
  viewport: {left:number;top:number;width:number;height:number}, from: readonly number[], to: readonly number[], distance: number): string[] {
  const left=Math.max(0,Math.min(from[0],to[0])-viewport.left),top=Math.max(0,Math.min(from[1],to[1])-viewport.top);
  const right=Math.min(viewport.width,Math.max(from[0],to[0])-viewport.left),bottom=Math.min(viewport.height,Math.max(from[1],to[1])-viewport.top);
  if (right<=left || bottom<=top) return [];
  camera.updateMatrixWorld();
  const crop=camera.clone();
  crop.setViewOffset(viewport.width,viewport.height,left,top,right-left,bottom-top);
  crop.updateMatrixWorld();
  const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(crop.projectionMatrix,crop.matrixWorldInverse));
  const box=new Box3(), ids:string[]=[];
  // One spatial query on release; no per-frame scan or per-piece ray casts.
  for (const p of world.query(camera.position.toArray() as Vec3,distance)) {
    const b=world.bounds.get(p.id)!;box.min.fromArray(b.min);box.max.fromArray(b.max);
    if (box.distanceToPoint(camera.position)<=distance && frustum.intersectsBox(box)) ids.push(p.id);
  }
  return ids;
}
