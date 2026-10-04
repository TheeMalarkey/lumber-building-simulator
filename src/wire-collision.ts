import {Box3,Ray,Vector3} from 'three';
import type {Vec3} from './catalog';
import {wirePath,endpointPosition,type Wire} from './logic-ports';
import {solidsOverlap} from './solid';
import {wireParts,wireEndParts,wirePartSolid as solid,wirePartBounds,type WirePart,type WireSurface} from './wire-shape';
import type {Piece} from './world';

type Body={wire:Wire;parts:WirePart[];sockets:Map<string,Vector3>};
type Entry={body:Body;part:WirePart;bounds:Box3};
const collisionMessage='Wires cannot pass through other wires. Add a bend on or over the wire.';
const makeBody=(wire:Wire,pieces:Map<string,Piece>):Body=>({wire,parts:wireParts(wire,wirePath(wire,pieces)),sockets:new Map([wire.from,wire.to].flatMap(e=>'piece' in e?[[e.piece+':'+e.port,new Vector3(...endpointPosition(e,pieces))] as const]:[]))});
function cells(bounds:Box3){
 const a=bounds.min.clone().divideScalar(4).floor(),b=bounds.max.clone().divideScalar(4).floor(),size=b.clone().sub(a).addScalar(1);
 if(size.x*size.y*size.z>4096)return null;
 const keys:string[]=[];for(let x=a.x;x<=b.x;x++)for(let y=a.y;y<=b.y;y++)for(let z=a.z;z<=b.z;z++)keys.push(`${x},${y},${z}`);return keys;
}
function trimAt(p:WirePart,point:Vector3,distance:number):WirePart|null{
 const atA=p.a.distanceToSquared(point)<1e-12,atB=p.b.distanceToSquared(point)<1e-12;
 if(!atA&&!atB)return p;
 const length=p.a.distanceTo(p.b);if(length<=distance+1e-6)return null;
 const delta=p.b.clone().sub(p.a).multiplyScalar(distance/length);
 return {...p,a:atA?p.a.clone().add(delta):p.a,b:atB?p.b.clone().sub(delta):p.b};
}
function overlaps(a:WirePart,b:WirePart,joins:Vector3[]=[],jointRadius=.32){
 if(!wirePartBounds(a).intersectsBox(wirePartBounds(b)))return false;
 let first:WirePart|null=a,second:WirePart|null=b;
 for(const p of joins){first=first&&trimAt(first,p,jointRadius);second=second&&trimAt(second,p,jointRadius);}
 return !!first&&!!second&&solidsOverlap(solid(first),solid(second));
}
function selfOverlap(body:Body){
 const tubes=body.parts.filter(p=>p.kind==='tube'),arc=[0];for(const p of tubes)arc.push(arc.at(-1)!+p.a.distanceTo(p.b));
 const interval=(p:WirePart)=>{
  if(p.kind==='bend')return [arc[p.segment+1],arc[p.segment+1]];
  const start=tubes[p.segment].a,a=arc[p.segment]+start.distanceTo(p.a),b=arc[p.segment]+start.distanceTo(p.b);return [Math.min(a,b),Math.max(a,b)];
 };
 const entries=body.parts.map(part=>({part,bounds:wirePartBounds(part),arc:interval(part)}));
 const bounds=new Box3();for(const e of entries)bounds.union(e.bounds);const size=bounds.getSize(new Vector3()),axis=size.x>=size.y&&size.x>=size.z?0:size.y>=size.z?1:2;
 entries.sort((a,b)=>a.bounds.min.getComponent(axis)-b.bounds.min.getComponent(axis));
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  const first=entries[i],second=entries[j];if(second.bounds.min.getComponent(axis)>first.bounds.max.getComponent(axis))break;
  if(!first.bounds.intersectsBox(second.bounds))continue;
  const a=first.part,b=second.part;if(a.segment===b.segment)continue;
  const arcGap=Math.max(0,first.arc[0]-second.arc[1],second.arc[0]-first.arc[1]);
  if((a.kind!=='tube'||b.kind!=='tube')&&arcGap<=a.radius+b.radius+1e-6)continue;
  // Consecutive tubes intentionally meet inside their rounded elbow. Check
  // beyond that small joint so a folded-back leg cannot hide inside its neighbor.
  const joins=Math.abs(a.segment-b.segment)===1?[a.a,a.b].filter(p=>p.distanceToSquared(b.a)<1e-12||p.distanceToSquared(b.b)<1e-12):[];
  if(joins.length&&a.kind==='tube'&&b.kind==='tube'&&a.b.clone().sub(a.a).normalize().dot(b.b.clone().sub(b.a).normalize())<-.9999)return true;
  if(overlaps(a,b,joins,Math.max(a.radius,b.radius)*1.5))return true;
 }return false;
}
function raySurface(ray:Ray,p:WirePart){
 if(!ray.intersectsBox(wirePartBounds(p)))return null;
 const s=solid(p);if(!ray.intersectsBox(s.bounds))return null;
 let enter=0,exit=Infinity,normal:Vector3|undefined;
 for(const n of s.normals){
  const boundary=Math.max(...s.vertices.map(v=>v.dot(n))),d=ray.origin.dot(n)-boundary,speed=ray.direction.dot(n);
  if(Math.abs(speed)<1e-10){if(d>1e-7)return null;continue;}
  const t=-d/speed;
  if(speed<0){if(t>enter){enter=t;normal=n;}}else exit=Math.min(exit,t);
  if(enter>exit+1e-7)return null;
 }
 return normal&&exit>=0?{point:ray.at(enter,new Vector3()),normal,distance:enter}:null;
}

/** Spatial lookup is rebuilt only for route/anchor edits, never power changes.
 * Oversized imported routes use a bounded overflow list instead of millions of cells. */
export class WireCollisionIndex {
 private bodies=new Map<string,Body>();private buckets=new Map<string,Entry[]>();private overflow:Entry[]=[];
 constructor(wires:readonly Wire[]=[],pieces=new Map<string,Piece>()){for(const w of wires)this.add(w,pieces);}
 add(wire:Wire,pieces:Map<string,Piece>){
  const body=makeBody(wire,pieces);this.bodies.set(wire.id,body);
  for(const part of body.parts){const entry={body,part,bounds:wirePartBounds(part)},keys=cells(entry.bounds);
   if(!keys){this.overflow.push(entry);continue;}
   for(const key of keys){if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key)!.push(entry);}
  }
 }
 private candidates(bounds:Box3){
  const keys=cells(bounds),entries=new Set(this.overflow);
  if(keys)for(const key of keys)for(const e of this.buckets.get(key)??[])entries.add(e);
  else for(const bucket of this.buckets.values())for(const e of bucket)entries.add(e);
  return entries;
 }
 issue(wire:Wire,pieces:Map<string,Piece>,ignore:ReadonlySet<string>=new Set(),checkSelf=true):string|null{
  const body=makeBody(wire,pieces);if(checkSelf&&selfOverlap(body))return 'A wire cannot pass through itself. Move or remove the last bend.';
  for(const part of body.parts)for(const e of this.candidates(wirePartBounds(part))){
   if(e.body.wire.id===wire.id||ignore.has(e.body.wire.id))continue;
   const joins=[...body.sockets].filter(([key])=>e.body.sockets.has(key)).map(([,p])=>p);
   // Shared electrical sockets permit leads meeting inside the connector,
   // never coincident runs or intersections elsewhere on the same circuit.
   if(overlaps(part,e.part,joins))return collisionMessage;
  }
  return null;
 }
 /** Solve the collar's actual contact with the curved host. Plane support
  * leaves gaps when a sloping leg moves its lowest vertex away from the host. */
 snapEnds(style:Pick<Wire,'kind'|'color'|'frame'>,points:readonly Vec3[],start?:WireSurface,end?:WireSurface):Vec3[]{
  const path=points.map(p=>[...p] as Vec3);if(!start&&!end)return path;
  for(let pass=0;pass<4;pass++){
   let movement=0;
   for(const [anchor,index,endIndex] of [[start,0,0],[end,path.length-1,1]] as const){
    if(!anchor||!this.bodies.has(anchor.wireId))continue;
    const previous=new Vector3(...path[index]),point=new Vector3(...anchor.point),normal=new Vector3(...anchor.normal);
    const at=(distance:number)=>point.clone().addScaledVector(normal,distance).toArray() as Vec3;
    const intersects=(distance:number)=>{
     path[index]=at(distance);const p=wireEndParts(style,path)[endIndex];if(!p)return false;
     const bounds=wirePartBounds(p);
     for(const e of this.candidates(bounds))if(e.body.wire.id===anchor.wireId&&bounds.intersectsBox(e.bounds)&&solidsOverlap(solid(p),solid(e.part)))return true;
     return false;
    };
    let lo=0,hi=.5;
    if(intersects(0)){
     for(let step=0;step<16;step++){const mid=(lo+hi)/2;if(intersects(mid))lo=mid;else hi=mid;}
    }else hi=0;
    path[index]=at(hi+.005);movement=Math.max(movement,previous.distanceToSquared(new Vector3(...path[index])));
   }
   if(movement<1e-12)break;
  }
  return path;
 }
 surface(id:string,eye:Vector3,center:Vec3){
  const body=this.bodies.get(id);if(!body)return null;
  const point=new Vector3(...center),tubes=body.parts.filter(p=>p.kind==='tube');
  let nearest:WirePart|undefined,distance=Infinity;
  for(const p of tubes){const d=p.b.clone().sub(p.a),t=Math.max(0,Math.min(1,point.clone().sub(p.a).dot(d)/d.lengthSq())),squared=p.a.clone().addScaledVector(d,t).distanceToSquared(point);if(squared<distance){distance=squared;nearest=p;}}
  if(!nearest)return null;
  // Prefer the upper side for an overpass. On vertical runs use the visible
  // side instead, so clicking their middle never snaps to a distant end.
  const axis=nearest.b.clone().sub(nearest.a).normalize(),normal=new Vector3(0,1,0).addScaledVector(axis,-axis.y);
  if(normal.lengthSq()<.01){normal.copy(eye).sub(point);normal.addScaledVector(axis,-normal.dot(axis));}
  normal.normalize();
  const ray=new Ray(point.clone().addScaledVector(normal,.5),normal.clone().negate());
  let best:ReturnType<typeof raySurface>=null;
  for(const part of body.parts){const hit=raySurface(ray,part);if(hit&&(!best||hit.distance<best.distance))best=hit;}
  return best?{wireId:id,point:best.point.toArray() as Vec3,normal:normal.toArray() as Vec3}:null;
 }
}
