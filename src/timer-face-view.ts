import * as T from 'three';
import type {Circuit} from './logic';
import type {Piece} from './world';
import {quaternionRotation} from './placement';

/** Shared runtime face indicators, independent of housing geometry and history. */
export class TimerFaceView {
 root=new T.Group();
 private meterGeometry=new T.CylinderGeometry(.23,.23,1,20,3);
 private inputGeometry=new T.BoxGeometry(.4,.084,.032);
 // Bias coincident cylinder end faces as well as the inset's front surface.
 private material=new T.MeshBasicMaterial({color:0x19b7e5,vertexColors:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 meters:T.InstancedMesh<T.BufferGeometry,T.MeshBasicMaterial>=new T.InstancedMesh(this.meterGeometry,this.material,8);
 indicators:T.InstancedMesh<T.BufferGeometry,T.MeshBasicMaterial>=new T.InstancedMesh(this.inputGeometry,this.material,8);
 private pieces:readonly Piece[]=[];private version=-1;private nextUpdate=0;
 private matrix=new T.Matrix4();private local=new T.Matrix4();private pieceMatrix=new T.Matrix4();
 private position=new T.Vector3();private scale=new T.Vector3();private rotation=new T.Quaternion();
 constructor(){
  // Shade a narrow rim and the caps so adjacent blue rows keep visible seams.
  // Vertex colors keep the entire meter in one shared draw.
  for(const geometry of [this.meterGeometry,this.inputGeometry]){
   const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),colors=new Float32Array(normals.count*3);
   for(let i=0;i<normals.count;i++){
    const meter=geometry===this.meterGeometry,y=positions.getY(i);
    if(meter&&Math.abs(normals.getY(i))<.1&&Math.abs(y)<.49)positions.setY(i,Math.sign(y)*.44);
    const shade=meter&&(Math.abs(normals.getY(i))>.9||Math.abs(y)>.49)?.12:1;colors.fill(shade,i*3,i*3+3);
   }
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  }
  this.root.name='Timer face displays';this.meters.count=this.indicators.count=0;this.root.add(this.meters,this.indicators);this.setup(this.meters);this.setup(this.indicators);
 }
 private setup(mesh:T.InstancedMesh){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;}
 rebuild(pieces:readonly Piece[]){
  this.pieces=pieces.filter(p=>p.item==='signal-delay'||p.item==='signal-sustain');this.version=-1;
  const capacity=this.pieces.reduce((n,p)=>n+(p.item==='signal-delay'?12:1),0);
  const grow=(mesh:T.InstancedMesh<T.BufferGeometry,T.MeshBasicMaterial>,geometry:T.BufferGeometry,count:number)=>{
   if(mesh.instanceMatrix.count>=count)return mesh;
   this.root.remove(mesh);mesh.dispose();const next=new T.InstancedMesh(geometry,this.material,2**Math.ceil(Math.log2(count)));next.count=0;this.setup(next);this.root.add(next);return next;
  };
  this.meters=grow(this.meters,this.meterGeometry,capacity);this.indicators=grow(this.indicators,this.inputGeometry,this.pieces.length);
 }
 update(circuit:Circuit){
  if(this.version===circuit.version&&circuit.time<this.nextUpdate)return;
  this.version=circuit.version;this.nextUpdate=Infinity;let meters=0,indicators=0;
  const set=(mesh:T.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
   this.local.makeScale(sx,sy,sz).setPosition(x,y,z);this.matrix.multiplyMatrices(this.pieceMatrix,this.local);mesh.setMatrixAt(index,this.matrix);
  };
  for(const p of this.pieces){
   const state=circuit.timerDisplay(p.id);if(!state)continue;this.nextUpdate=Math.min(this.nextUpdate,state.nextChange);
   this.rotation.setFromEuler(quaternionRotation(p.rotation));this.position.fromArray(p.position);this.scale.set(1,1,1);this.pieceMatrix.compose(this.position,this.rotation,this.scale);
   if(state.input)set(this.indicators,indicators++,-.4,-.72,.942,1,1,1);
   if(p.item==='signal-delay'){
    for(let i=0;i<12;i++)if(state.mask&(1<<i))set(this.meters,meters++,.55,.8*(.337+i*.14)-1,.922,1,.1064,.34);
   }else if(state.level>0){
    const height=1.34*state.level;set(this.meters,meters++,.55,-.7836+height/2,.922,1,height,.34);
   }
  }
  this.meters.count=meters;this.indicators.count=indicators;
  this.meters.instanceMatrix.needsUpdate=true;this.indicators.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.meters.dispose();this.indicators.dispose();this.meterGeometry.dispose();this.inputGeometry.dispose();this.material.dispose();}
}
