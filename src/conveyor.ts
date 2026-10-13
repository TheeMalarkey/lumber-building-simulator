import {BoxGeometry,CylinderGeometry,MeshStandardMaterial,type BufferGeometry} from 'three';
/** Wall-sized 4 x 8 footprint, with raised stepped rails. Roller axes follow
 * the eight-stud span; transport is across local X. Rail heights are reconstructed.
 * Keep the original bottom at -.5 so saved conveyors stay on their supports. */
export const CONVEYOR_SOCKET:[number,number,number]=[0,.6,3.88];
export function conveyorParts(reverse=false):BufferGeometry[]{
 const parts:BufferGeometry[]=[];
 const add=(g:BufferGeometry,x:number,y:number,z:number,surface:number)=>{g.translate(x,y,z);g.userData.surface=surface;parts.push(g);};
 for(const z of [-3.65,3.65]){
  add(new BoxGeometry(4,.8,.7),0,-.1,z,0);
  add(new BoxGeometry(4,.6,.2),0,.6,z,0);
 }
 for(let i=0;i<8;i++)add(new CylinderGeometry(.23,.23,7.3,24).rotateX(Math.PI/2),-1.75+i*.5,.23,0,1);
 // There is no solid tray or crossbar closing either entry face in the reference.
 add(new CylinderGeometry(.18,.18,.12,20).rotateX(Math.PI/2),0,.6,3.81,2);
 add(new BoxGeometry(.21,.12,.12),reverse?.19:-.19,.65,3.81,2);
 return parts;
}
export const makeConveyorMaterials=()=>[
 new MeshStandardMaterial({color:0x4d4b4d,roughness:.8}),
 new MeshStandardMaterial({color:0x999a98,roughness:.68,metalness:0}),
 new MeshStandardMaterial({color:0xd58a43,roughness:.7}),
];
