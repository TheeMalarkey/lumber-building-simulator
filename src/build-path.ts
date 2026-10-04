import { CatmullRomCurve3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { CATALOG, ITEMS, type Vec3 } from "./catalog";
import { encodeRotation, quaternionRotation, snapMovement } from "./placement";
import type { Piece } from "./world";

export type BuildMode = "single" | "line" | "curve" | "wedge";
export type WedgeMode = "ramp" | "wall-arch";
export interface PathOptions { mode: Exclude<BuildMode,"single">; fill: boolean; wedge?: WedgeMode }
export interface BuildPath { pieces: Piece[]; guide: Vec3[] }

export function nextRampPoint(from: Vec3, to: Vec3, item: string): Vec3 {
  const size = ITEMS.get(item)!.size;
  return [to[0], snapMovement(from[1] + Math.hypot(to[0]-from[0],to[2]-from[2])*size[1]/size[2], from[1]), to[2]];
}

const wedges = CATALOG.filter(c=>c.shape==="wedge");
function wedgeFor(template: Piece, grade: number) {
  const size=ITEMS.get(template.item)!.size;
  const angle=Math.atan(Math.min(1,Math.abs(grade)));
  return wedges.filter(w=>w.size[0]===size[0]).reduce((best,w)=>{
    const score=(s:Vec3)=>Math.abs(Math.atan(s[1]/s[2])-angle)+Math.abs(s[2]-size[2])*.002;
    return score(w.size)<score(best.size)-1e-8 ? w : best;
  },ITEMS.get(template.item)!);
}
function planeNormal(points: Vector3[]) {
  for (let i=1;i<points.length-1;i++) {
    const n=points[i].clone().sub(points[i-1]).cross(points[i+1].clone().sub(points[i]));
    if (n.lengthSq()>1e-8) return n.normalize();
  }
  return new Vector3(0,1,0);
}

/** Generate catalog pieces only: no stretched meshes, and translations stay on the starting stud lattice. */
export function buildPath(template: Piece, anchors: readonly Vec3[], options: PathOptions): BuildPath {
  const points: Vector3[]=[];
  for (const p of anchors) {
    const v=new Vector3(...p);
    if (!points.length || v.distanceToSquared(points[points.length-1])>1e-8) points.push(v);
  }
  if (!points.length) return {pieces:[],guide:[]};
  if (points.length===1) return {pieces:[{...template,id:"path-0",position:points[0].toArray() as Vec3,rotation:[...template.rotation]}],guide:[]};
  const straight=options.mode==="line";
  const curve=straight ? null : new CatmullRomCurve3(points,false,"centripetal");
  // The guide's resolution is bounded independently of how many actual pieces are built.
  if (curve) {curve.arcLengthDivisions=Math.min(4096,Math.max(200,points.length*48));curve.updateArcLengths();}
  const start=points[0], end=points[points.length-1];
  const length=curve ? curve.getLength() : start.distanceTo(end);
  const at=(distance:number)=>curve ? curve.getPointAt(Math.max(0,Math.min(1,distance/length)))
    : start.clone().lerp(end,Math.max(0,Math.min(1,distance/length)));
  const tangent=(distance:number)=>curve ? curve.getTangentAt(Math.max(0,Math.min(1,distance/length))).normalize()
    : end.clone().sub(start).normalize();
  const base=new Quaternion().setFromEuler(quaternionRotation(template.rotation));
  const reference=planeNormal(points), seen=new Set<string>(), pieces:Piece[]=[];
  for (let distance=0;distance<=length+1e-8;) {
    const direction=tangent(distance);
    let item=ITEMS.get(template.item)!, orientation=base.clone();
    if (!straight) {
      if (options.mode==="wedge" && item.shape==="wedge") {
        if (options.wedge==="wall-arch") {
          const before=tangent(distance-item.size[2]/2), after=tangent(distance+item.size[2]/2);
          let normal=before.clone().cross(after);
          if (normal.lengthSq()<1e-8) normal=reference.clone();
          if (normal.dot(reference)<0) normal.negate();
          normal.addScaledVector(direction,-normal.dot(direction)).normalize();
          if (normal.lengthSq()<.5) normal=new Vector3(0,0,1).cross(direction).normalize();
          const z=direction.clone().negate(), y=z.clone().cross(normal).normalize();
          orientation.setFromRotationMatrix(new Matrix4().makeBasis(normal,y,z));
          item=wedgeFor(template,Math.tan(before.angleTo(after)/2));
        } else {
          const horizontal=Math.hypot(direction.x,direction.z);
          item=wedgeFor(template,direction.y/Math.max(horizontal,1e-8));
          const pitch=Math.atan2(direction.y,horizontal)-Math.atan2(item.size[1],item.size[2]);
          orientation.setFromEuler(new Euler(pitch,Math.atan2(-direction.x,-direction.z),0,"YXZ"));
        }
      } else {
        const up=Math.abs(direction.y)>.99 ? new Vector3(0,0,1) : new Vector3(0,1,0);
        if (item.size[0]>=item.size[2]) {
          const z=direction.clone().cross(up).normalize(), y=z.clone().cross(direction).normalize();
          orientation.setFromRotationMatrix(new Matrix4().makeBasis(direction,y,z));
        } else {
          const x=up.clone().cross(direction).normalize(), y=direction.clone().cross(x).normalize();
          orientation.setFromRotationMatrix(new Matrix4().makeBasis(x,y,direction));
        }
      }
      orientation.multiply(base);
    }
    const position=at(distance).toArray().map((v,i)=>snapMovement(v,start.getComponent(i))) as Vec3;
    const key=position.join(",");
    if (!seen.has(key)) {
      seen.add(key);pieces.push({...template,id:`path-${pieces.length}`,item:item.id,position,rotation:encodeRotation(orientation)});
    }
    if (distance>=length-1e-8) break;
    const local=direction.clone().applyQuaternion(orientation.clone().invert());
    const span=Math.abs(local.x)*item.size[0]+Math.abs(local.y)*item.size[1]+Math.abs(local.z)*item.size[2];
    const ramp=options.mode==="wedge" && options.wedge!=="wall-arch" && item.shape==="wedge";
    const step=options.fill ? 1 : ramp ? Math.max(1,span) : Math.max(1,Math.ceil(span-1e-5));
    const next=distance+step;
    distance=options.fill ? Math.min(length,next) : next;
  }
  const guide=curve ? curve.getPoints(Math.min(4096,Math.max(24,Math.ceil(length*2)))).map(v=>v.toArray() as Vec3)
    : [start.toArray() as Vec3,end.toArray() as Vec3];
  return {pieces,guide};
}
