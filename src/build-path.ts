import { Vector3 } from "three";
import { ITEMS, type Vec3 } from "./catalog";
import { rotatedSize, snapMovement } from "./placement";
import type { Piece } from "./world";

export type BuildMode = "single" | "line";
export interface PathOptions { fill: boolean; surfaceNormal?: Vec3 }
export interface BuildPath { pieces: Piece[]; guide: Vec3[] }

/** Snap along a face's grid axes, solving its support axis to keep contact flush. */
export function snapPathOnSurface(point: Vec3, origin: Vec3, normal: Vec3): Vec3 {
  const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const snapped=point.map((v,i)=>snapMovement(v,origin[i])) as Vec3;
  const plane=origin.reduce((sum,v,i)=>sum+v*normal[i],0);
  const tangent=snapped.reduce((sum,v,i)=>sum+(i===axis ? 0 : v*normal[i]),0);
  const contact=(plane-tangent)/normal[axis];
  snapped[axis]=normal[axis]>0 ? Math.ceil(contact*10000-1e-4)/10000 : Math.floor(contact*10000+1e-4)/10000;
  return snapped;
}

/** Repeat the chosen blueprint along a straight span, preserving its pose and stud lattice. */
export function buildPath(template: Piece, anchors: readonly Vec3[], options: PathOptions): BuildPath {
  if (!anchors.length) return {pieces:[],guide:[]};
  const start=new Vector3(...anchors[0]),end=new Vector3(...anchors[anchors.length-1]);
  const length=start.distanceTo(end),direction=end.clone().sub(start).normalize();
  const item=ITEMS.get(template.item)!;
  const size=rotatedSize(item.boundsSize ?? item.size,template.rotation);
  const span=Math.abs(direction.x)*size[0]+Math.abs(direction.y)*size[1]+Math.abs(direction.z)*size[2];
  const step=options.fill ? 1 : Math.max(1,Math.ceil(span-1e-5));
  const seen=new Set<string>(),pieces:Piece[]=[];
  for (let distance=0;distance<=length+1e-8;) {
    const point=start.clone().addScaledVector(direction,distance).toArray() as Vec3;
    const position=options.surfaceNormal ? snapPathOnSurface(point,anchors[0],options.surfaceNormal)
      : point.map((v,i)=>snapMovement(v,start.getComponent(i))) as Vec3;
    const key=position.join(",");
    if(!seen.has(key)) {
      seen.add(key);pieces.push({...template,id:`path-${pieces.length}`,position,rotation:[...template.rotation]});
    }
    if(distance>=length-1e-8) break;
    distance=options.fill ? Math.min(length,distance+step) : distance+step;
  }
  return {pieces,guide:[start.toArray() as Vec3,end.toArray() as Vec3]};
}
