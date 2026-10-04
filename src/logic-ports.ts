import {Vector3} from 'three';
import {ITEMS,type Vec3} from './catalog';
import {quaternionRotation} from './placement';
import type {Piece} from './world';
import {NEON_COLORS,type WireStyle} from './wire-design';
import {wireEndParts,wirePartBounds,wirePartSolid,type WirePart,type WireFrame} from './wire-shape';
import {solidsOverlap} from './solid';

export type Endpoint={piece:string;port:string}|{point:Vec3};
export interface Wire extends WireStyle {id:string;from:Endpoint;to:Endpoint;points:Vec3[];frame?:WireFrame}
export interface Port {id:string;label:string;output:boolean;position:Vec3;normal:Vec3}
export const isLogic=(p:Piece)=>ITEMS.get(p.item)?.fixedMaterial==='logic';
export const portKey=(id:string,port:string)=>id+':'+port;
export const logicAppearance=(item:string,active:boolean,timing=1)=>({active:(item==='lever'||item==='button')&&active,timing:item==='signal-delay'||item==='signal-sustain'?timing:1});
export function portsFor(item:string):Port[]{
 const spec=ITEMS.get(item);if(!spec)return [];
 const [w,h,d]=spec.size;
 const port=(id:string,label:string,output:boolean,x:number,y:number,z:number,normal:Vec3):Port=>({id,label,output,position:[x,y,z],normal});
 if(spec.fixedMaterial==='lighting'){
  const positions:Record<string,Vec3>={'lamp':[0,-.4,.22],'floor-lamp':[0,-.48,.22],'wall-light':[.72,.1,.2],'floodlight':[0,.4,-.82],'worklight':[-1.31,.55,.05]};
  return [port('in','Switch',false,...positions[item],[0,0,1])];
 }
 if(!isLogic({item} as Piece))return [];
 if(['button','lever','pressure-plate'].includes(item))return [port('out','Output',true,w/2,-h/2+(item==='pressure-plate'?.15:.18),0,[1,0,0])];
 const y=-h/2+.25;
 return item.endsWith('-gate') ? [port('a','Input A',false,-w/2,y,-d*.25,[-1,0,0]),port('b','Input B',false,-w/2,y,d*.25,[-1,0,0]),port('out','Output',true,w/2,y,0,[1,0,0])]
  : [port('in','Input',false,-w/2,y,0,[-1,0,0]),port('out','Output',true,w/2,y,0,[1,0,0])];
}
export function portPosition(p:Piece,port:string):Vec3{
 const def=portsFor(p.item).find(v=>v.id===port);if(!def)throw new Error('Unknown socket');
 return new Vector3(...def.position).applyEuler(quaternionRotation(p.rotation)).add(new Vector3(...p.position)).toArray() as Vec3;
}
export function endpointPosition(e:Endpoint,pieces:Map<string,Piece>):Vec3{
 return 'point' in e?e.point:portPosition(pieces.get(e.piece)!,e.port);
}
export function wirePath(w:Wire,pieces:Map<string,Piece>):Vec3[]{return [endpointPosition(w.from,pieces),...w.points,endpointPosition(w.to,pieces)];}
export function pointOnSegment(p:Vec3,a:Vec3,b:Vec3,tolerance=.025){
 const v=new Vector3(...b).sub(new Vector3(...a)),length=v.lengthSq();
 const t=length?Math.max(0,Math.min(1,new Vector3(...p).sub(new Vector3(...a)).dot(v)/length)):0;
 return new Vector3(...a).addScaledVector(v,t).distanceToSquared(new Vector3(...p))<=tolerance*tolerance;
}
export function validateWires(raw:unknown,pieces:Piece[]):Wire[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw))throw new Error('Invalid wires.');
 const map=new Map(pieces.map(p=>[p.id,p])),ids=new Set<string>();
 const vec=(p:unknown):p is Vec3=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e8);
 const endpoint=(e:any):Endpoint=>{
  if(!e||typeof e!=='object')throw new Error('Invalid wire endpoint.');
  if('point' in e){if(!vec(e.point))throw new Error('Invalid wire point.');return {point:[...e.point] as Vec3};}
  if(typeof e.piece!=='string'||!map.has(e.piece)||!portsFor(map.get(e.piece)!.item).some(p=>p.id===e.port))throw new Error('Invalid wire socket.');
  return {piece:e.piece,port:e.port};
 };
 return raw.map(w=>{
  if(!w||typeof w.id!=='string'||!w.id||w.id.length>100||ids.has(w.id)||!Array.isArray(w.points)||w.points.length>1024||!w.points.every(vec))throw new Error('Invalid or duplicate wire.');
  if(w.kind!==undefined&&w.kind!=='wire'&&w.kind!=='neon')throw new Error('Unknown wire type.');
  if(w.kind==='neon'?(typeof w.color!=='string'||!Object.hasOwn(NEON_COLORS,w.color)):w.color!==undefined)throw new Error('Invalid neon wire color.');
  if(w.frame!==undefined&&(!Array.isArray(w.frame)||w.frame.length!==4||!w.frame.every((v:unknown)=>typeof v==='number'&&Number.isFinite(v))||Math.abs(Math.hypot(...w.frame)-1)>1e-6))throw new Error('Invalid wire orientation.');
  ids.add(w.id);return {id:w.id,from:endpoint(w.from),to:endpoint(w.to),points:w.points.map((p:Vec3)=>[...p] as Vec3),
   ...(w.kind?{kind:w.kind}:{}),...(w.kind==='neon'?{color:w.color}:{}),...(w.frame?{frame:[...w.frame] as WireFrame}:{})};
 });
}

export function wireGroups(wires:Wire[],pieces:Map<string,Piece>):number[][]{
  const parent=wires.map((_,i)=>i),root=(i:number):number=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const next=parent[i];parent[i]=r;i=next;}return r;};
  const join=(a:number,b:number)=>{parent[root(a)]=root(b);};
  const socket=new Map<string,number>();
  wires.forEach((w,i)=>{for(const e of [w.from,w.to])if('piece' in e){const k=portKey(e.piece,e.port);if(socket.has(k))join(i,socket.get(k)!);else socket.set(k,i);}});
  // Only the two visible end collars conduct between wires. Test their actual
  // convex shapes, not a radius around the whole route or endpoint center.
  // The 0.006 clearance includes the placement surface's 0.005 offset.
  const buckets=new Map<string,{i:number;part:WirePart}[]>();
  wires.forEach((wire,i)=>{for(const part of wireEndParts(wire,wirePath(wire,pieces))){
   const bounds=wirePartBounds(part).expandByScalar(.006),lo=bounds.min.clone().divideScalar(2).floor(),hi=bounds.max.clone().divideScalar(2).floor(),visited=new Set<WirePart>();
   const keys:string[]=[];
   for(let x=lo.x;x<=hi.x;x++)for(let y=lo.y;y<=hi.y;y++)for(let z=lo.z;z<=hi.z;z++){
    const key=`${x},${y},${z}`;keys.push(key);
    for(const other of buckets.get(key)??[]){if(root(other.i)===root(i)||visited.has(other.part))continue;visited.add(other.part);
     if(solidsOverlap(wirePartSolid(part),wirePartSolid(other.part),-.006))join(i,other.i);
    }
   }
   for(const key of keys){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push({i,part});}
  }});
  const groups=new Map<number,number[]>();wires.forEach((_,i)=>{const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(i);});return [...groups.values()];
}

/** Retain routes attached to selected sockets, including end-connected free
 * wires. A lead into an unselected device is not part of the copied assembly. */
export function wiresWithinSelection(wires:Wire[],pieces:Map<string,Piece>,selected:ReadonlySet<string>):Wire[]{
 const candidates=wires.filter(w=>[w.from,w.to].every(e=>!('piece' in e)||selected.has(e.piece)));
 const portCounts=new Map<string,number>();
 for(const w of candidates)for(const e of [w.from,w.to])if('piece' in e){const key=portKey(e.piece,e.port);portCounts.set(key,(portCounts.get(key)??0)+1);}
 const retained=candidates.filter(w=>{
  const path=wirePath(w,pieces);if(path.some(p=>new Vector3(...p).distanceToSquared(new Vector3(...path[0]))>1e-10))return true;
  // A clipped zero-length leg adds nothing if another retained wire already
  // carries its socket. Keep the leg if it is the socket's only connection.
  return [w.from,w.to].some(e=>'piece' in e&&portCounts.get(portKey(e.piece,e.port))===1);
 });
 return wireGroups(retained,pieces).filter(group=>group.some(i=>[retained[i].from,retained[i].to].some(e=>'piece' in e))).flatMap(group=>group.map(i=>retained[i]));
}
