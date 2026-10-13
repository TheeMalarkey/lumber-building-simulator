import {BoxGeometry,CylinderGeometry,MeshStandardMaterial,type BufferGeometry} from 'three';
/** Reference-informed proportions, pending measured in-game stud dimensions. */
export function conveyorParts():BufferGeometry[]{
 const parts:BufferGeometry[]=[];
 const add=(g:BufferGeometry,x:number,y:number,z:number,surface:number)=>{g.translate(x,y,z);g.userData.surface=surface;parts.push(g);};
 for(const x of [-1.9,1.9]){
  add(new BoxGeometry(.2,1,8),x,0,0,0);
  add(new BoxGeometry(.34,.16,8),Math.sign(x)*1.83,-.42,0,0);
 }
 for(let i=0;i<8;i++)add(new CylinderGeometry(.38,.38,3.6,16).rotateZ(Math.PI/2),0,.12,-3.5+i,1);
 for(const z of [-3.72,3.72])add(new BoxGeometry(3.6,.12,.2),0,-.39,z,0);
 add(new CylinderGeometry(.31,.31,.18,20).rotateZ(Math.PI/2),2.09,.02,-2.6,2);
 add(new BoxGeometry(.18,.17,.35),2.09,.02,-2.3,2);
 return parts;
}
export const makeConveyorMaterials=()=>[
 new MeshStandardMaterial({color:0x30373a,roughness:.77}),
 new MeshStandardMaterial({color:0xb8b9b5,roughness:.48,metalness:.16}),
 new MeshStandardMaterial({color:0xf3a51b,roughness:.57}),
];
