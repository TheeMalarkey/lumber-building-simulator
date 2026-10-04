import { Box3, Vector3 } from "three";
import { ITEMS, type Vec3 } from "./catalog";
import { quaternionRotation, rotatedSize, snapOnSurface, STUD_STEP } from "./placement";
import type { Piece } from "./world";

import { collisionPartsFor } from "./geometry";
import {solidsOverlap,type Solid} from "./solid";
// Bound transformed collision data independently of the number of stored blueprints.
const worldCache = new Map<Piece, { item: string; active: boolean|'travel'; position: Vec3; rotation: Vec3; solids: Solid[] }>();
const MAX_CACHED_PIECES = 1024;
const EPS = .0001;
export function placementSolids(piece: Piece,reserveTravel=false): Solid[] {
  const cached = worldCache.get(piece);
  const active=piece.item==='lever'&&reserveTravel?'travel':piece.item==='lever'&&piece.logicOn===true;
  if (cached?.item === piece.item && cached.active===active && cached.position.every((v,i)=>v===piece.position[i]) &&
      cached.rotation.every((v,i)=>v===piece.rotation[i])) {
    worldCache.delete(piece);worldCache.set(piece,cached);return cached.solids;
  }
  const rotation = quaternionRotation(piece.rotation), position = new Vector3(...piece.position);
  const local=active==='travel'?[...collisionPartsFor(piece.item),...collisionPartsFor(piece.item,true)]:collisionPartsFor(piece.item,active);
  const solids = local.map(s => ({
    vertices: s.vertices.map(v=>v.clone().applyEuler(rotation).add(position)),
    normals: s.normals.map(v=>v.clone().applyEuler(rotation)),
    edges: s.edges.map(v=>v.clone().applyEuler(rotation)),
    bounds: new Box3(),
  }));
  for (const s of solids) s.bounds.setFromPoints(s.vertices);
  worldCache.set(piece,{item:piece.item,active,position:[...piece.position],rotation:[...piece.rotation],solids});
  if (worldCache.size>MAX_CACHED_PIECES) worldCache.delete(worldCache.keys().next().value!);
  return solids;
}
/** Called only after spatial-index and outer-bounds rejection. */
export function solidOverlap(a: Piece, b: Piece) {
  if (ITEMS.get(a.item)!.shape === "box" && ITEMS.get(b.item)!.shape === "box" &&
      a.rotation.every(Number.isInteger) && b.rotation.every(Number.isInteger)) return true;
  const first=placementSolids(a), second=placementSolids(b);
  return first.some(s=>second.some(t=>solidsOverlap(s,t)));
}
export function surfaceSupport(pieces: readonly Piece[], center: Vec3, normal: Vec3) {
  const n=new Vector3(...normal), origin=new Vector3(...center).dot(n);
  let minimum=Infinity;
  // Reserve both lever poses when snapping, so switching never drives its
  // handle through the supporting face. Walking/picking use only its live pose.
  for (const p of pieces) for (const solid of placementSolids(p,p.item==='lever')) for (const v of solid.vertices)
    minimum=Math.min(minimum,v.dot(n)-origin);
  return -minimum;
}
export function snapBlueprintOnSurface(point: Vec3, normal: Vec3, item: string, rotation: Vec3): Vec3 {
  const origin: Piece = {id:"support",item,wood:"oak",position:[0,0,0],rotation};
  return snapOnSurface(point,normal,rotatedSize(ITEMS.get(item)!.size,rotation),STUD_STEP,
    surfaceSupport([origin],[0,0,0],normal));
}

export type CollisionPlane = { normal: Vector3; distance: number };
const expandedCache = new WeakMap<Solid, Map<string, CollisionPlane[]>>();
/** Minkowski sum with an axis-aligned body: faces plus edge/box-axis cross products. */
export function expandedPlanes(solid: Solid, halfSize: Vec3): CollisionPlane[] {
  let cache=expandedCache.get(solid);
  if (!cache) {cache=new Map();expandedCache.set(solid,cache);}
  const key=halfSize.join(","), cached=cache.get(key);
  if (cached) return cached;
  const basis=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)], directions:Vector3[]=[];
  const add=(v:Vector3)=>{
    if (v.lengthSq()<1e-12) return;
    v.normalize();
    if (!directions.some(n=>Math.abs(n.dot(v))>1-1e-7)) directions.push(v);
  };
  [...basis,...solid.normals].forEach(n=>add(n.clone()));
  for (const edge of solid.edges) for (const axis of basis) add(edge.clone().cross(axis));
  const planes:CollisionPlane[]=[];
  for (const n of directions) {
    let min=Infinity,max=-Infinity;
    for (const v of solid.vertices) {const d=v.dot(n);min=Math.min(min,d);max=Math.max(max,d);}
    const radius=Math.abs(n.x)*halfSize[0]+Math.abs(n.y)*halfSize[1]+Math.abs(n.z)*halfSize[2];
    planes.push({normal:n,distance:max+radius},{normal:n.clone().negate(),distance:-min+radius});
  }
  cache.set(key,planes);return planes;
}
export const insidePlanes = (planes: CollisionPlane[], point: Vector3) =>
  planes.every(p=>p.normal.dot(point)<p.distance-1e-5);

export function verticalRange(planes: CollisionPlane[], x: number, z: number) {
  let min=-Infinity,max=Infinity;
  for (const {normal:n,distance:d} of planes) {
    const rest=d-n.x*x-n.z*z;
    if (Math.abs(n.y)<1e-10) {if (rest<=1e-5) return null;}
    else if (n.y>0) max=Math.min(max,rest/n.y);
    else min=Math.max(min,rest/n.y);
  }
  return min<max-1e-5 ? {min,max} : null;
}
export function rayEntry(planes: CollisionPlane[], origin: Vector3, direction: Vector3, distance: number) {
  let near=0,far=distance;
  for (const p of planes) {
    const rest=p.distance-p.normal.dot(origin), speed=p.normal.dot(direction);
    if (Math.abs(speed)<1e-10) {if (rest<=1e-5) return null;}
    else if (speed<0) near=Math.max(near,rest/speed);
    else far=Math.min(far,rest/speed);
    if (near>far || far<1e-8) return null;
  }
  return near<=distance ? near : null;
}
