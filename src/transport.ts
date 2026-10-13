import * as C from 'cannon-es';
import {Vector3,Quaternion,Euler} from 'three';
import {ITEMS,type Vec3} from './catalog';
import {pieceBounds,type World,type Piece} from './world';
import type {Circuit} from './logic';
import {placementSolids} from './collision';
import type {Solid} from './solid';
import {quaternionRotation} from './placement';
import {plotCenter} from './plots';
import {doorProgress,isDoor} from './door-design';

export const TRANSPORT_SPEED=4;
const STEP=1/120;
/** Convex recipe faces, preserving openings and wedges rather than outer boxes. */
function convex(s:Solid){
 const center=s.bounds.getCenter(new Vector3()),vs=s.vertices.map(v=>v.clone().sub(center));
 const faces:number[][]=[];
 for(const n of s.normals){
  const plane=Math.max(...vs.map(v=>v.dot(n))),ids=vs.map((v,i)=>Math.abs(v.dot(n)-plane)<1e-5?i:-1).filter(i=>i>=0);
  if(ids.length<3)continue;
  const mid=ids.reduce((v,i)=>v.add(vs[i]),new Vector3()).divideScalar(ids.length),u=vs[ids[0]].clone().sub(mid).normalize(),v=n.clone().cross(u);
  ids.sort((a,b)=>Math.atan2(vs[a].clone().sub(mid).dot(v),vs[a].clone().sub(mid).dot(u))-Math.atan2(vs[b].clone().sub(mid).dot(v),vs[b].clone().sub(mid).dot(u)));
  faces.push(ids);
 }
 return {shape:new C.ConvexPolyhedron({vertices:vs.map(v=>new C.Vec3(v.x,v.y,v.z)),faces}),center};
}
export class Transport {
 running=false;
 bodies=new Map<string,C.Body>();
 physics=new C.World({gravity:new C.Vec3(0,-35,0),allowSleep:true});
 private fixed=new Map<string,{body:C.Body;piece:Piece;pose:number}>();
 private conveyors=new Map<number,Piece>();
 private rollerMaterial=new C.Material({friction:0,restitution:0});
 private accumulator=0;
 private woodSources=new Map<string,Piece>();
 private groundBodies:C.Body[]=[];private plotSignature='';private revision=-1;
 private grip:{id:string;body:C.Body;cursor:C.Body;constraint:C.PointToPointConstraint;target:C.Vec3}|null=null;
 get grabbedId(){return this.grip?.id??null;}
 constructor(private source:World){
  this.physics.broadphase=new C.SAPBroadphase(this.physics);
  (this.physics.solver as C.GSSolver).iterations=12;
  this.physics.defaultContactMaterial.friction=.35;
  this.physics.defaultContactMaterial.restitution=0;
 }
 start(){
  this.stop();this.running=true;
  this.syncSource();this.syncStatic();
 }
 syncSource(){
  if(!this.running||this.revision===this.source.revision)return;
  this.revision=this.source.revision;
  const plots=JSON.stringify(this.source.plots);
  if(plots!==this.plotSignature){
   this.plotSignature=plots;for(const b of this.groundBodies)this.physics.removeBody(b);this.groundBodies=[];
   const ground=new C.Body({mass:0,shape:new C.Plane()});ground.position.y=this.source.plots===null?0:-.1;ground.quaternion.setFromEuler(-Math.PI/2,0,0);this.groundBodies.push(ground);
   for(const id of this.source.plots??[]){const [x,z]=plotCenter(id);this.groundBodies.push(new C.Body({mass:0,shape:new C.Box(new C.Vec3(20,.05,20)),position:new C.Vec3(x,-.05,z)}));}
   for(const b of this.groundBodies)this.physics.addBody(b);for(const b of this.bodies.values())b.wakeUp();
  }
  for(const [id,b] of this.bodies)if(!this.source.looseIds.has(id)){if(this.grabbedId===id)this.releaseGrab();this.physics.removeBody(b);this.bodies.delete(id);this.woodSources.delete(id);}
  for(const id of this.source.looseIds){const p=this.source.pieces.get(id)!,previous=this.woodSources.get(id);let body=this.bodies.get(id);
   if(previous===p)continue;
   const [x,y,z]=ITEMS.get(p.item)!.size,q=new Quaternion().setFromEuler(quaternionRotation(p.rotation));
   if(!body){
    body=new C.Body({mass:x*y*z,shape:new C.Box(new C.Vec3(x/2,y/2,z/2)),position:new C.Vec3(...p.position),quaternion:new C.Quaternion(q.x,q.y,q.z,q.w),sleepSpeedLimit:.08,sleepTimeLimit:1});
    body.material=new C.Material({friction:.6,restitution:0});body.linearDamping=.04;body.angularDamping=.15;this.bodies.set(p.id,body);this.physics.addBody(body);
   }else if(previous&&(!previous.position.every((v,i)=>v===p.position[i])||!previous.rotation.every((v,i)=>v===p.rotation[i]))){
    if(this.grabbedId===id)this.releaseGrab();body.position.set(...p.position);body.quaternion.set(q.x,q.y,q.z,q.w);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.aabbNeedsUpdate=true;body.wakeUp();
   }
   this.woodSources.set(id,p);
  }
 }
 acceptPoses(){for(const id of this.bodies.keys()){const p=this.source.pieces.get(id);if(p)this.woodSources.set(id,p);}this.revision=this.source.revision;}
 poses():Piece[]{
  const result:Piece[]=[];
  for(const [id,b] of this.bodies){const p=this.source.pieces.get(id);if(!p)continue;
   const q=b.quaternion,e=new Euler().setFromQuaternion(new Quaternion(q.x,q.y,q.z,q.w),'YXZ');
   result.push({...p,position:[b.position.x,b.position.y,b.position.z],rotation:[e.x,e.y,e.z].map(v=>((v/(Math.PI/2)%4)+4)%4) as Vec3});
  }return result;
 }
 grab(id:string,point:Vec3){
  this.syncSource();const body=this.bodies.get(id);if(!body)return false;this.releaseGrab();
  const cursor=new C.Body({mass:0,type:C.Body.KINEMATIC,position:new C.Vec3(...point),collisionFilterGroup:0,collisionFilterMask:0}),pivot=body.pointToLocalFrame(new C.Vec3(...point));
  const constraint=new C.PointToPointConstraint(body,pivot,cursor,new C.Vec3(),body.mass*180);constraint.collideConnected=false;
  this.physics.addBody(cursor);this.physics.addConstraint(constraint);body.allowSleep=false;body.wakeUp();this.grip={id,body,cursor,constraint,target:new C.Vec3(...point)};return true;
 }
 moveGrab(point:Vec3){if(this.grip&&point.every(Number.isFinite))this.grip.target.set(...point);}
 releaseGrab(){if(!this.grip)return;const {body,cursor,constraint}=this.grip;this.grip=null;this.physics.removeConstraint(constraint);this.physics.removeBody(cursor);body.allowSleep=true;body.wakeUp();}
 stop(){this.releaseGrab();this.running=false;for(const b of [...this.physics.bodies])this.physics.removeBody(b);this.bodies.clear();this.woodSources.clear();this.groundBodies=[];this.plotSignature='';this.revision=-1;this.fixed.clear();this.conveyors.clear();this.accumulator=0;}
 private syncStatic(){
  // Load only model components near wood. Spatial queries include long pieces.
  const wanted=new Map<string,Piece>();
  for(const b of this.bodies.values())for(const p of this.source.query([b.position.x,b.position.y,b.position.z],12))if(p.item!=='loose-plank'&&!wanted.has(p.id)){
   const bounds=pieceBounds(p),position=[b.position.x,b.position.y,b.position.z];
   if(position.every((n,i)=>n+12>=bounds.min[i]&&n-12<=bounds.max[i]))wanted.set(p.id,p);
  }
  for(const [id,{body,piece,pose}] of this.fixed)if(!wanted.has(id)||wanted.get(id)!==piece||(isDoor(piece.item)&&doorProgress(piece)!==pose)){this.physics.removeBody(body);this.conveyors.delete(body.id);this.fixed.delete(id);for(const wood of this.bodies.values())wood.wakeUp();}
  for(const [id,p] of wanted)if(!this.fixed.has(id)){
   const b=new C.Body({mass:0,position:new C.Vec3(...p.position)});
   placementSolids(p).forEach((s,i)=>{const {shape,center}=convex(s);if(p.item==='straight-conveyor'&&i>=4&&i<12)shape.material=this.rollerMaterial;b.addShape(shape,new C.Vec3(center.x-p.position[0],center.y-p.position[1],center.z-p.position[2]));});
   this.physics.addBody(b);this.fixed.set(id,{body:b,piece:p,pose:isDoor(p.item)?doorProgress(p):0});if(p.item==='straight-conveyor')this.conveyors.set(b.id,p);
  }
 }
 step(dt:number,circuit:Circuit){
  if(!this.running)return;
  this.syncSource();this.accumulator+=Math.min(.1,Math.max(0,dt));this.syncStatic();
  while(this.accumulator>=STEP){
   if(this.grip){const {target,cursor,body}=this.grip,delta=target.vsub(cursor.position),length=delta.length();if(length>30*STEP)delta.scale(30*STEP/length,delta);cursor.position.vadd(delta,cursor.position);body.wakeUp();}
   // Bound travel per substep below half the thinnest plank dimension.
   for(const b of this.bodies.values()){const speed=b.velocity.length();if(speed>48)b.velocity.scale(48/speed,b.velocity);}
   this.physics.step(STEP);
   const contacts=new Map<C.Body,{direction:C.Vec3;point:C.Vec3;count:number}>();
   for(const c of this.physics.contacts){
    const p=this.conveyors.get(c.bi.id)??this.conveyors.get(c.bj.id);if(!p)continue;
    const belt=this.conveyors.has(c.bi.id)?c.bi:c.bj,wood=belt===c.bi?c.bj:c.bi;if(wood.mass===0)continue;
    const offset=belt===c.bi?c.ri:c.rj,point=belt.position.vadd(offset),q=new Quaternion().setFromEuler(quaternionRotation(p.rotation));
    const normal=new Vector3(c.ni.x,c.ni.y,c.ni.z).multiplyScalar(belt===c.bi?1:-1).applyQuaternion(q.clone().invert());
    // Only roller contact drives wood: no invisible belt volume or side pull.
    if((belt===c.bi?c.si:c.sj).material!==this.rollerMaterial||Math.abs(normal.y)<.55)continue;
    const reverse=circuit.connected(p.id)?circuit.input(p.id):!!p.logicOn;
    const dir=new Vector3((reverse?-1:1)*Math.sign(normal.y),0,0).applyQuaternion(q),entry=contacts.get(wood);
    if(entry){entry.direction.vadd(new C.Vec3(dir.x,dir.y,dir.z),entry.direction);entry.point.vadd(point,entry.point);entry.count++;}
    else contacts.set(wood,{direction:new C.Vec3(dir.x,dir.y,dir.z),point,count:1});
   }
   for(const [b,c] of contacts){
    c.direction.scale(1/c.count,c.direction);c.point.scale(1/c.count,c.point);const speed=b.velocity.dot(c.direction);
    b.wakeUp();const force=c.direction.scale(Math.max(-80,Math.min(80,(TRANSPORT_SPEED-speed)*25))*b.mass);
    b.applyForce(force,c.point.vsub(b.position));
   }
   this.accumulator-=STEP;
  }
 }
}
