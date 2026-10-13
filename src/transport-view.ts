import {Group,InstancedMesh,Matrix4,Quaternion,Vector3,type MeshStandardMaterial,type Raycaster} from 'three';
import {Transport} from './transport';
import {geometryFor} from './geometry';
import type {World,Piece} from './world';
import type {Circuit} from './logic';
import type {Vec3} from './catalog';

/** Live wood has independent physics; periodic pose snapshots feed editing and saves. */
export class TransportView {
 root=new Group();simulation:Transport;paused=false;
 private generation=-1;private signature='';private elapsed=0;private flushing=false;private meshRevision=-1;
 private meshes=new Map<string,InstancedMesh>();private starts=new Map<string,Piece>();private grabBefore:Piece|null=null;
 constructor(private world:World,private materials:Map<string,MeshStandardMaterial>){this.simulation=new Transport(world);}
 start(){
  this.stop();this.generation=this.world.generation;this.simulation.start();this.rebuild();this.paint();
 }
 stop(){this.simulation.stop();this.grabBefore=null;this.paused=false;this.signature='';this.meshRevision=-1;this.elapsed=0;for(const mesh of this.meshes.values()){this.root.remove(mesh);mesh.dispose();}this.meshes.clear();}
 private rebuild(){
  if(this.meshRevision===this.world.revision)return;this.meshRevision=this.world.revision;
  for(const id of this.starts.keys())if(!this.world.looseIds.has(id))this.starts.delete(id);
  const batches=new Map<string,string[]>();
  for(const id of this.simulation.bodies.keys()){const p=this.world.pieces.get(id)!;if(!this.starts.has(id))this.starts.set(id,structuredClone(p));if(!batches.has(p.wood))batches.set(p.wood,[]);batches.get(p.wood)!.push(id);}
  const signature=JSON.stringify([...batches]);if(signature===this.signature)return;this.signature=signature;
  for(const mesh of this.meshes.values()){this.root.remove(mesh);mesh.dispose();}this.meshes.clear();
  for(const [wood,ids] of batches){const mesh=new InstancedMesh(geometryFor('loose-plank'),this.materials.get(wood),ids.length);mesh.userData.ids=ids;mesh.castShadow=true;mesh.receiveShadow=true;this.meshes.set(wood,mesh);this.root.add(mesh);}
 }
 update(dt:number,circuit:Circuit){
  if(this.generation!==this.world.generation){this.stop();this.starts.clear();this.generation=this.world.generation;}
  if(!this.simulation.running){if(!this.world.looseIds.size)return;this.start();}
  this.simulation.syncSource();this.rebuild();
  if(!this.paused)this.simulation.step(dt,circuit);
  this.paint();this.elapsed+=Math.min(dt,.1);if(this.elapsed>=.15){this.elapsed=0;this.flush();}
 }
 flush(){
  if(this.flushing||!this.simulation.running||this.generation!==this.world.generation)return;
  this.flushing=true;
  try{this.simulation.syncSource();this.world.updateLoosePoses(this.simulation.poses());this.simulation.acceptPoses();}
  finally{this.flushing=false;}
 }
 beginGrab(id:string,point:Vec3){
  if(!this.simulation.running)this.start();this.flush();const p=this.world.pieces.get(id);
  if(!p||!this.simulation.grab(id,point))return false;this.grabBefore=structuredClone(p);this.paused=false;return true;
 }
 endGrab(){
  const before=this.grabBefore;this.grabBefore=null;this.simulation.releaseGrab();this.flush();
  const after=before&&this.world.pieces.get(before.id);
  if(before&&after&&this.generation===this.world.generation&&(!before.position.every((v,i)=>Math.abs(v-after.position[i])<1e-4)||!before.rotation.every((v,i)=>Math.abs(v-after.rotation[i])<1e-4))){
   this.world.execute([{before,after}]);this.simulation.acceptPoses();
  }
 }
 reset(){
  this.endGrab();const changes=[...this.starts].flatMap(([id,start])=>{const p=this.world.pieces.get(id);return p?[{before:p,after:{...p,position:[...start.position] as Vec3,rotation:[...start.rotation] as Vec3}}]:[];});
  this.world.execute(changes);this.paused=true;this.simulation.syncSource();this.paint();
 }
 /** Raycast in absolute world coordinates, independently of the floating render origin. */
 pick(raycaster:Raycaster,exclude?:string|ReadonlySet<string>|null){
  this.root.updateMatrix();this.root.matrixWorld.identity();for(const mesh of this.meshes.values())mesh.updateMatrixWorld(true);
  for(const hit of raycaster.intersectObjects([...this.meshes.values()],false)){
   const id=(hit.object.userData.ids as string[])[hit.instanceId!];if(typeof exclude==='string'?exclude===id:exclude?.has(id))continue;
   const b=this.simulation.bodies.get(id)!,q=b.quaternion;
   hit.normal=hit.face!.normal.clone().applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w));return {hit,id};
  }
  return null;
 }
 private paint(){
  const m=new Matrix4(),p=new Vector3(),q=new Quaternion(),s=new Vector3(1,1,1);
  for(const mesh of this.meshes.values()){
   (mesh.userData.ids as string[]).forEach((id,i)=>{const b=this.simulation.bodies.get(id)!;p.set(b.position.x,b.position.y,b.position.z);q.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);mesh.setMatrixAt(i,m.compose(p,q,s));});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }
 }
}
