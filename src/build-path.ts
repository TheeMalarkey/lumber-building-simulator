import { Vector3 } from "three";
import { ITEMS, type Vec3 } from "./catalog";
import { rotatedSize, snapMovement } from "./placement";
import type { Piece } from "./world";

export type BuildMode = "single" | "line";
export interface PathOptions { fill: boolean }
export interface BuildPath { pieces: Piece[]; guide: Vec3[] }

/** Repeat the chosen blueprint along a straight span, preserving its pose and stud lattice. */
export function buildPath(template: Piece, anchors: readonly Vec3[], options: PathOptions): BuildPath {
  if (!anchors.length) return {pieces:[],guide:[]};
  const start=new Vector3(...anchors[0]),end=new Vector3(...anchors[anchors.length-1]);
  const length=start.distanceTo(end),direction=end.clone().sub(start).normalize();
  const size=rotatedSize(ITEMS.get(template.item)!.size,template.rotation);
  const span=Math.abs(direction.x)*size[0]+Math.abs(direction.y)*size[1]+Math.abs(direction.z)*size[2];
  const step=options.fill ? 1 : Math.max(1,Math.ceil(span-1e-5));
  const seen=new Set<string>(),pieces:Piece[]=[];
  for (let distance=0;distance<=length+1e-8;) {
    const position=start.clone().addScaledVector(direction,distance).toArray()
      .map((v,i)=>snapMovement(v,start.getComponent(i))) as Vec3;
    const key=position.join(",");
    if(!seen.has(key)) {
      seen.add(key);pieces.push({...template,id:`path-${pieces.length}`,position,rotation:[...template.rotation]});
    }
    if(distance>=length-1e-8) break;
    distance=options.fill ? Math.min(length,distance+step) : distance+step;
  }
  return {pieces,guide:[start.toArray() as Vec3,end.toArray() as Vec3]};
}
