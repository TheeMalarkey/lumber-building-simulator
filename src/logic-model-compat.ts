import {Box3,BoxGeometry,CylinderGeometry,Vector3} from 'three';
import {quaternionRotation,rotatedSize} from './placement';
import type {Piece} from './world';
import type {Vec3} from './catalog';

/** Import-only footprint of the original lever, expressed at its preserved
 * mounting plane. Old fractional placements used this OFF recipe even when ON.
 * Used only to retain already-valid edge placements, never for new placement.
 */
export function originalLeverBounds(piece:Piece){
 const rotation=quaternionRotation(piece.rotation);
 const center=new Vector3(0,.25,0).applyEuler(rotation).add(new Vector3(...piece.position));
 if(piece.rotation.every(Number.isInteger)){
  const size=new Vector3(...rotatedSize([2,2,1.5],piece.rotation)).multiplyScalar(.5);
  return {min:center.clone().sub(size).toArray() as Vec3,max:center.clone().add(size).toArray() as Vec3};
 }
 const base=new BoxGeometry(1.84,.28,1.5).translate(0,-.86,0);
 const pivot=new CylinderGeometry(.42,.42,.7,24).rotateZ(Math.PI/2).translate(0,-.58,0);
 const stem=new BoxGeometry(.2,1.03,.34).translate(0,-.04,0);
 const grip=new CylinderGeometry(.25,.25,1,24).rotateZ(Math.PI/2).translate(0,.7,0);
 for(const g of [stem,grip]){g.translate(0,.56,0);g.rotateZ(.1);g.translate(0,-.56,0);}
 const port=new CylinderGeometry(.135,.135,.14,24).rotateZ(Math.PI/2).translate(.93,-.82,0);
 const bounds=new Box3(),point=new Vector3();
 for(const g of [base,pivot,stem,grip,port]){
  const pos=g.getAttribute('position');
  for(let i=0;i<pos.count;i++)bounds.expandByPoint(point.fromBufferAttribute(pos,i).applyEuler(rotation).add(center));
  g.dispose();
 }
 return {min:bounds.min.toArray() as Vec3,max:bounds.max.toArray() as Vec3};
}
