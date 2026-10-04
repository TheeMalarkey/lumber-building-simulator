import * as T from 'three';
import {Circuit} from './logic';
import {portsFor,portPosition,wirePath,logicAppearance} from './logic-ports';
import {ITEMS,type Vec3} from './catalog';
import {chunkKey,type World} from './world';
import {quaternionRotation} from './placement';

/** Shared meshes for wire segments and socket indicators. */
export class LogicView {
 root=new T.Group();circuit=new Circuit();showSockets=false;lightChanged=false;
 private displays=new Map<string,string>();
 private revision=-1;private version=-1;private generation=-1;private previous=0;
 private wireMesh?:T.InstancedMesh;private sockets?:T.InstancedMesh;
 private wireGeometry=new T.CylinderGeometry(.045,.045,1,6);
 private socketGeometry=new T.SphereGeometry(.14,10,6);
 private material=new T.MeshBasicMaterial({color:0xffffff});
 private socketMaterial=new T.MeshBasicMaterial({color:0xffffff,depthWrite:false});
 private topology='';
 wireIds:string[]=[];
 constructor(private world:World){this.root.name='Logic wires and signals';}
 tick(now:number,feet?:T.Vector3){
  this.lightChanged=false;
  if(this.generation!==this.world.generation){this.generation=this.world.generation;this.circuit=new Circuit();this.displays.clear();this.previous=0;this.version=-1;}
  if(this.revision!==this.world.revision){
   this.revision=this.world.revision;
   for(const id of this.displays.keys())if(!this.world.pieces.has(id))this.displays.delete(id);
   this.circuit.configure([...this.world.logicIds].map(id=>this.world.pieces.get(id)!),this.world.wires);
   this.version=-1;
  }
  const plates=new Set<string>();
  if(feet)for(const p of this.world.query(feet.toArray() as [number,number,number],3)){if(p.item!=='pressure-plate')continue;
   const pos=feet.clone().sub(new T.Vector3(...p.position)).applyQuaternion(new T.Quaternion().setFromEuler(quaternionRotation(p.rotation)).invert());
   if(Math.abs(pos.x)<2.35&&Math.abs(pos.z)<2.35&&pos.y>=-.05&&pos.y<=.6)plates.add(p.id);
  }
  this.circuit.setPlates(plates);
  this.circuit.advance(this.previous?Math.min(250,now-this.previous):0);this.previous=now;
  if(this.version===this.circuit.version)return;
  this.version=this.circuit.version;
  for(const id of this.world.logicIds){const p=this.world.pieces.get(id)!;if(ITEMS.get(p.item)!.fixedMaterial==='logic'){
    const visual=logicAppearance(p.item,this.circuit.output(id),p.timing??1),state=String(visual.active)+'|'+visual.timing;if(this.displays.get(id)!==state){this.displays.set(id,state);this.world.dirty.add(chunkKey(p.position));}continue;
   }
   if(ITEMS.get(p.item)!.fixedMaterial!=='lighting')continue;
   const before=this.world.lightEnabled(p),connected=this.circuit.connected(id),after=connected?this.circuit.input(id):p.lightOn!==false;
   if(connected)this.world.lightStates.set(id,after);else this.world.lightStates.delete(id);
   if(before!==after){this.lightChanged=true;this.world.dirty.add(chunkKey(p.position));}
  }
  this.paint();
 }
 refresh(){this.version=-1;this.paint();}
 private mesh(old:T.InstancedMesh|undefined,g:T.BufferGeometry,count:number){
  if(old&&old.instanceMatrix.count>=count){old.count=count;return old;}
  if(old){this.root.remove(old);old.dispose();}
  const mesh=new T.InstancedMesh(g,this.material,Math.max(8,2**Math.ceil(Math.log2(count||1)))) ;mesh.count=count;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(mesh);return mesh;
 }
 private paint(){
  const m=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
  const topology=this.world.generation+':'+this.circuit.topologyBuilds;
  if(topology!==this.topology||!this.wireMesh){
   this.topology=topology;const lines:{a:Vec3;b:Vec3;id:string}[]=[];
   for(const w of this.world.wires){const path=wirePath(w,this.world.pieces);for(let i=1;i<path.length;i++)lines.push({a:path[i-1],b:path[i],id:w.id});}
   this.wireMesh=this.mesh(this.wireMesh,this.wireGeometry,lines.length);this.wireIds=lines.map(l=>l.id);
   lines.forEach((l,i)=>{const a=new T.Vector3(...l.a),b=new T.Vector3(...l.b),delta=b.clone().sub(a),length=delta.length();
    q.setFromUnitVectors(new T.Vector3(0,1,0),length?delta.clone().normalize():new T.Vector3(0,1,0));m.compose(a.add(b).multiplyScalar(.5),q,new T.Vector3(1,length,1));this.wireMesh!.setMatrixAt(i,m);});
   this.wireMesh.instanceMatrix.needsUpdate=true;this.wireMesh.computeBoundingSphere();
  }
  this.wireIds.forEach((id,i)=>this.wireMesh!.setColorAt(i,color.setHex(this.circuit.wireOn(id)?0x46bef4:0x252c30)));
  const ports:{p:Vec3;color:number}[]=[];
  for(const id of this.world.logicIds){const piece=this.world.pieces.get(id)!;
   for(const port of portsFor(piece.item)){
    const on=port.output?this.circuit.output(id):this.circuit.input(id,port.id);
    if(!on&&!this.showSockets&&!this.circuit.unstable.has(id))continue;
    ports.push({p:portPosition(piece,port.id),color:this.circuit.unstable.has(id)?0xe8a342:on?0x46bef4:port.output?0xf0aa55:0xbdc8cc});
   }
  }
  this.sockets=this.mesh(this.sockets,this.socketGeometry,ports.length);
  this.socketMaterial.depthTest=!this.showSockets;this.sockets.material=this.socketMaterial;
  ports.forEach((p,i)=>{m.makeTranslation(...p.p);this.sockets!.setMatrixAt(i,m);this.sockets!.setColorAt(i,color.setHex(p.color));});
  this.sockets.instanceMatrix.needsUpdate=true;this.sockets.computeBoundingSphere();
  for(const mesh of [this.wireMesh!,this.sockets])if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 }
 dispose(){this.wireMesh?.dispose();this.sockets?.dispose();this.wireGeometry.dispose();this.socketGeometry.dispose();this.material.dispose();this.socketMaterial.dispose();}
}
