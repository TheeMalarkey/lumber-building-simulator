import {Group,InstancedMesh,Matrix4,Quaternion,Vector3,type MeshStandardMaterial} from 'three';
import {Transport} from './transport';
import {geometryFor} from './geometry';
import type {World} from './world';
import type {Circuit} from './logic';

/** Test poses are transient; existing project files keep authored starting poses. */
export class TransportView {
 root=new Group();simulation:Transport;paused=false;
 private signature='';private revision=-1;private generation=-1;
 private meshes=new Map<string,InstancedMesh>();
 constructor(private world:World,private materials:Map<string,MeshStandardMaterial>){this.simulation=new Transport(world);}
 private layout(){return JSON.stringify([this.world.plots,[...this.world.pieces.values()].map(p=>[p.id,p.item,p.wood,p.position,p.rotation])]);}
 start(){
  this.stop();this.signature=this.layout();this.generation=this.world.generation;this.revision=this.world.revision;this.simulation.start();
  const batches=new Map<string,string[]>();
  for(const id of this.simulation.bodies.keys()){const wood=this.world.pieces.get(id)!.wood;if(!batches.has(wood))batches.set(wood,[]);batches.get(wood)!.push(id);}
  for(const [wood,ids] of batches){const mesh=new InstancedMesh(geometryFor('loose-plank'),this.materials.get(wood),ids.length);mesh.userData.ids=ids;mesh.castShadow=true;mesh.receiveShadow=true;this.meshes.set(wood,mesh);this.root.add(mesh);}
  this.paint();
 }
 stop(){this.simulation.stop();this.paused=false;for(const mesh of this.meshes.values()){this.root.remove(mesh);mesh.dispose();}this.meshes.clear();}
 update(dt:number,circuit:Circuit){
  if(!this.simulation.running)return;
  if(this.generation!==this.world.generation){this.stop();return;}
  if(this.revision!==this.world.revision){this.revision=this.world.revision;if(this.layout()!==this.signature){this.stop();return;}}
  if(!this.paused)this.simulation.step(dt,circuit);this.paint();
 }
 private paint(){
  const m=new Matrix4(),p=new Vector3(),q=new Quaternion(),s=new Vector3(1,1,1);
  for(const mesh of this.meshes.values()){
   (mesh.userData.ids as string[]).forEach((id,i)=>{const b=this.simulation.bodies.get(id)!;p.set(b.position.x,b.position.y,b.position.z);q.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);mesh.setMatrixAt(i,m.compose(p,q,s));});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }
 }
}
