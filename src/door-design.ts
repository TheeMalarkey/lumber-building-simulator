import {Box3,Matrix4,Vector3} from 'three';
import {ITEMS,type Vec3} from './catalog';
import {quaternionRotation} from './placement';
import type {Piece} from './world';

export const isDoor=(item:string)=>['hatch','basic-door','half-door','fat-door','glass-door'].includes(item);
const poses=new WeakMap<Piece,number>();
// Saved state is a request, not a collision bypass. Loads and placement previews
// begin closed, then the motion controller opens through the same safe sweep.
export const doorProgress=(p:Piece)=>poses.get(p)??0;
export const setDoorProgress=(p:Piece,value:number)=>poses.set(p,Math.max(0,Math.min(1,value)));
/** Positive local X rotation lifts the hatch panel above its stationary bar. */
export function doorTransform(item:string,progress:number){
 const hatch=item==='hatch',pivot=hatch?new Vector3(0,-.4,1.5):new Vector3(ITEMS.get(item)!.size[0]/2,0,0);
 const rotation=hatch?new Matrix4().makeRotationX(progress*Math.PI/2):new Matrix4().makeRotationY(progress*Math.PI/2);
 return new Matrix4().makeTranslation(...pivot.toArray()).multiply(rotation).multiply(new Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
}
/** Conservative sweep index only; placement still validates the actual pose. */
export function doorSearchBounds(p:Piece){
 const [w,h,d]=ITEMS.get(p.item)!.size,hatch=p.item==='hatch';
 const radius=hatch?4:Math.hypot(w,d),pivot=hatch?new Vector3(0,-.4,1.5):new Vector3(w/2,0,0);
 const points:Vector3[]=[];
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])points.push(new Vector3(hatch?x*w/2:x*radius,hatch?y*radius:y*h/2,hatch?z*radius:z*radius).add(pivot).applyEuler(quaternionRotation(p.rotation)).add(new Vector3(...p.position)));
 const box=new Box3().setFromPoints(points);return {min:box.min.toArray() as Vec3,max:box.max.toArray() as Vec3};
}
