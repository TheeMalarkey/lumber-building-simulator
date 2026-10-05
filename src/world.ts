import {Quaternion,Vector3} from "three";
import {quaternionRotation} from "./placement";
import {type Wire,type Endpoint,endpointPosition,validateWires,wireGroups,wirePath,wiresWithinSelection} from "./logic-ports";
import { ITEMS, type Vec3 } from "./catalog";
import { rotatedSize } from "./placement";
import { connectedPlots, coveredByPlots, touchesPlot, validatePlots } from "./plots";
import { placementSolids, solidOverlap } from "./collision";
import {wireLength,wireLimit,wireSpaceIssue,wireTouchesPlot,wireRouteIssue} from './wire-design';
import {WireCollisionIndex} from './wire-collision';
import type {WireFrame} from './wire-shape';
export interface Piece {
  id: string;
  item: string;
  wood: string;
  position: Vec3;
  rotation: Vec3;
  lightOn?: boolean;
  logicOn?: boolean;
  timing?: number;
  /** Import-only exception for an unchanged, valid first-version plot edge. */
  legacyLeverBounds?: true;
}
export interface Change {
  before: Piece | null;
  after: Piece | null;
}
type HistoryEntry = Change[] | { changes: Change[]; beforeWires: Wire[]; afterWires: Wire[] } | { beforePlots: number[]; afterPlots: number[] };
export const CHUNK = 64;
export const chunkKey = (p: Vec3) =>
  p.map((n) => Math.floor(n / CHUNK)).join(",");
export function pieceBounds(p: Piece) {
  // A turned triangle does not occupy every corner of its original box.
  // Reserve the actual two lever poses for placement/land bounds. Snapping
  // uses this same envelope; walking collisions keep the current pose only.
  if (!p.rotation.every(Number.isInteger) || p.item==='lever') {
    const solids=placementSolids(p,p.item==='lever');
    return {
      min:[0,1,2].map(i=>Math.min(...solids.map(s=>s.bounds.min.getComponent(i)))) as Vec3,
      max:[0,1,2].map(i=>Math.max(...solids.map(s=>s.bounds.max.getComponent(i)))) as Vec3,
    };
  }
  const item=ITEMS.get(p.item)!;
  const s = rotatedSize(item.boundsSize ?? item.size, p.rotation);
  return {
    min: p.position.map((v, i) => v - s[i] / 2) as Vec3,
    max: p.position.map((v, i) => v + s[i] / 2) as Vec3,
  };
}
function keys(p: Piece) {
  const b = pieceBounds(p),
    out: string[] = [];
  for (
    let x = Math.floor(b.min[0] / CHUNK);
    x <= Math.floor(b.max[0] / CHUNK);
    x++
  )
    for (
      let y = Math.floor(b.min[1] / CHUNK);
      y <= Math.floor(b.max[1] / CHUNK);
      y++
    )
      for (
        let z = Math.floor(b.min[2] / CHUNK);
        z <= Math.floor(b.max[2] / CHUNK);
        z++
      )
        out.push(`${x},${y},${z}`);
  return out;
}
export class World {
  pieces = new Map<string, Piece>();
  wires: Wire[]=[];
  logicIds=new Set<string>();
  lightStates=new Map<string,boolean>();
  lightChunks = new Map<string, Set<string>>();
  chunks = new Map<string, Set<string>>();
  spatial = new Map<string, Set<string>>();
  bounds = new Map<string, ReturnType<typeof pieceBounds>>();
  dirty = new Set<string>();
  // Null is used by standalone spatial/benchmark fixtures; the editor always loads land.
  plots: number[] | null = null;
  allowOverlaps = false;
  private wireIndex?:WireCollisionIndex;
  private indexedWires?:Wire[];
  get wireCollisions(){
    if(!this.wireIndex||this.indexedWires!==this.wires){this.wireIndex=new WireCollisionIndex(this.wires,this.pieces);this.indexedWires=this.wires;}
    return this.wireIndex;
  }
  wirePlacementIssue(wire:Wire){
    return wireRouteIssue(wirePath(wire,this.pieces),wire,this.plots)??this.wireCollisions.issue(wire,this.pieces);
  }
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  revision = 0;
  generation = 0;
  onChange = () => {};
  onReject = (_message:string) => {};
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  private put(p: Piece | null, id: string) {
    const old = this.pieces.get(id);
    if((old&&this.logicIds.has(id)||p&&["logic","lighting"].includes(ITEMS.get(p.item)!.fixedMaterial??""))&&
       (!p||!old||p.item!==old.item||p.position.some((v,i)=>v!==old.position[i])||p.rotation.some((v,i)=>v!==old.rotation[i])))this.wireIndex=undefined;
    if (old) {
      const k = chunkKey(old.position);
      this.chunks.get(k)?.delete(id);
      this.lightChunks.get(k)?.delete(id);
      if (!this.lightChunks.get(k)?.size) this.lightChunks.delete(k);
      if (!this.chunks.get(k)?.size) this.chunks.delete(k);
      this.dirty.add(k);
      for (const key of keys(old)) {
        this.spatial.get(key)?.delete(id);
        if (!this.spatial.get(key)?.size) this.spatial.delete(key);
      }
    }
    this.pieces.delete(id);
    this.logicIds.delete(id);
    if(!p)this.lightStates.delete(id);
    this.bounds.delete(id);
    if (p) {
      const copy = structuredClone(p);
      this.pieces.set(id, copy);
      if(["logic","lighting"].includes(ITEMS.get(copy.item)!.fixedMaterial??""))this.logicIds.add(id);
      this.bounds.set(id, pieceBounds(copy));
      const k = chunkKey(copy.position);
      if (!this.chunks.has(k)) this.chunks.set(k, new Set());
      this.chunks.get(k)!.add(id);
      if(ITEMS.get(copy.item)!.fixedMaterial==='lighting') {
        if(!this.lightChunks.has(k)) this.lightChunks.set(k,new Set());
        this.lightChunks.get(k)!.add(id);
      }
      this.dirty.add(k);
      for (const key of keys(copy)) {
        if (!this.spatial.has(key)) this.spatial.set(key, new Set());
        this.spatial.get(key)!.add(id);
      }
    }
  }
  private apply(changes: HistoryEntry, reverse = false) {
    if (!Array.isArray(changes) && "changes" in changes) {
      this.wires=structuredClone(reverse?changes.beforeWires:changes.afterWires);
      this.apply(changes.changes,reverse);return;
    }
    if (!Array.isArray(changes)) {
      this.plots = [...(reverse ? changes.beforePlots : changes.afterPlots)];
      this.revision++;
      return;
    }
    for (const c of changes) {
      const p = reverse ? c.before : c.after;
      this.put(p, (c.before ?? c.after)!.id);
    }
    this.revision++;
  }
  execute(changes: Change[], wires?: Wire[]) {
    if (!changes.length && wires===undefined) return false;
    const deleted=new Set(changes.filter(c=>!c.after).map(c=>c.before!.id));
    let nextWires=wires??this.moveWireRoutes(changes);
    if(deleted.size){
      // A removed device leaves its leads in place. Resolve the socket before
      // applying piece changes, so rotated sockets and undo keep the same route.
      const detach=(end:Endpoint):Endpoint=>'piece' in end&&deleted.has(end.piece)?{point:endpointPosition(end,this.pieces)}:end;
      nextWires=nextWires.map(w=>{const from=detach(w.from),to=detach(w.to);return from===w.from&&to===w.to?w:{...w,from,to};});
    }
    // New typed wires cannot be stretched by moving a single connected device.
    // Legacy routes remain editable; an imported oversized typed route may be
    // shortened or moved rigidly, but cannot be stretched farther.
    if(nextWires!==this.wires||changes.some(c=>c.before&&c.after&&(c.before.position.some((v,i)=>v!==c.after!.position[i])||c.before.rotation.some((v,i)=>v!==c.after!.rotation[i])))){
      const next=new Map(this.pieces),old=new Map(this.wires.map(w=>[w.id,w]));
      for(const c of changes)if(c.after)next.set(c.after.id,c.after);else if(c.before)next.delete(c.before.id);
      const changed=nextWires.filter(w=>{
        const before=old.get(w.id);if(!before||before.kind!==w.kind||JSON.stringify(before.frame)!==JSON.stringify(w.frame))return true;
        const a=wirePath(before,this.pieces),b=wirePath(w,next);
        return a.length!==b.length||a.some((p,i)=>p.some((v,k)=>Math.abs(v-b[i][k])>1e-9));
      });
      const nextIds=new Set(nextWires.map(w=>w.id));
      const ignored=new Set([...this.wires.filter(w=>!nextIds.has(w.id)).map(w=>w.id),...changed.map(w=>w.id)]);
      const batch=new WireCollisionIndex(changed,next);
      for(const w of changed)if(w.kind){
        const previous=old.get(w.id),limit=Math.max(wireLimit(w),previous?wireLength(wirePath(previous,this.pieces)):0);
        if(wireLength(wirePath(w,next))>limit+1e-6){this.onReject(`Cannot move: ${w.kind==='neon'?'neon wire':'wire'} exceeds its ${wireLimit(w)}-stud limit. Reroute or disconnect it first.`);return false;}
        const issue=wireSpaceIssue(wirePath(w,next),w,this.plots);
        if(issue&&(!previous||!wireSpaceIssue(wirePath(previous,this.pieces),previous,this.plots))){this.onReject(issue);return false;}
        const collision=this.wireCollisions.issue(w,next,ignored)??batch.issue(w,next,undefined,false);
        if(collision){this.onReject(collision);return false;}
      }
    }
    const entry:HistoryEntry=nextWires!==this.wires ? {changes,beforeWires:this.wires,afterWires:nextWires} : changes;
    const saved=structuredClone(entry);this.apply(entry);
    this.past.push(saved);
    this.future = [];
    let count = 0;
    for (let i = this.past.length - 1; i >= 0; i--) {
      const entry = this.past[i];
      count += Array.isArray(entry) ? entry.length : 1;
      if (count > 50000 && i > 0) {
        this.past.splice(0, i);
        break;
      }
    }
    this.onChange();
    return true;
  }
  undo() {
    const c = this.past.pop();
    if (c) {
      this.apply(c, true);
      this.future.push(c);
      this.onChange();
    }
  }
  redo() {
    const c = this.future.pop();
    if (c) {
      this.apply(c);
      this.past.push(c);
      this.onChange();
    }
  }
  plotIssue(id: number): "invalid" | "center" | "disconnected" | "occupied" | null {
    if (!Number.isInteger(id) || id < 0 || id >= 25) return "invalid";
    if (id === 12) return "center";
    const current = this.plots ?? [12];
    const removing = current.includes(id);
    const next = removing ? current.filter(p => p !== id) : [...current, id];
    if (!connectedPlots(next)) return "disconnected";
    if (removing && [...this.bounds.values()].some(b => touchesPlot(b, id))) return "occupied";
    if(removing&&this.wires.some(w=>w.kind&&wireTouchesPlot(wirePath(w,this.pieces),w,id)))return 'occupied';
    return null;
  }
  togglePlot(id: number) {
    const issue = this.plotIssue(id);
    if (issue) return issue;
    const beforePlots = [...(this.plots ?? [12])];
    const afterPlots = beforePlots.includes(id) ? beforePlots.filter(p => p !== id) : [...beforePlots, id].sort((a, b) => a - b);
    const entry = { beforePlots, afterPlots };
    this.apply(entry); this.past.push(entry); this.future = []; this.onChange();
    return null;
  }
  load(pieces: Piece[], plots: number[] | null = this.plots, wires: Wire[] = []) {
    const nextWires=validateWires(wires,pieces);
    const nextPlots = plots === null ? null : validatePlots(plots);
    for (const key of this.chunks.keys()) this.dirty.add(key);
    this.pieces.clear();
    this.logicIds.clear();this.lightStates.clear();this.wires=nextWires;
    this.chunks.clear();
    this.lightChunks.clear();
    this.spatial.clear();
    this.bounds.clear();
    this.past = [];
    this.future = [];
    this.plots = nextPlots;
    for (const p of pieces) this.put(p, p.id);
    this.generation++;
    this.revision++;
    this.onChange();
  }
  lightEnabled(p:Piece){return this.lightStates.get(p.id)??(p.lightOn!==false);}
  copyWires(source:Piece[],copies:Piece[]):Wire[]{
    const ids=new Map(source.map((p,i)=>[p.id,copies[i].id]));
    const a=source[0],b=copies[0];
    // Copy the routing in the assembly's rigid frame, including group turns.
    const q0=new Quaternion().setFromEuler(quaternionRotation(a.rotation)).invert();
    const q1=new Quaternion().setFromEuler(quaternionRotation(b.rotation));
    const turn=q1.clone().multiply(q0);
    const move=(p:Vec3)=>new Vector3(...p).sub(new Vector3(...a.position)).applyQuaternion(q0).applyQuaternion(q1).add(new Vector3(...b.position)).toArray() as Vec3;
    return wiresWithinSelection(this.wires,this.pieces,new Set(ids.keys())).map(w=>({...w,id:crypto.randomUUID(),frame:turn.clone().multiply(new Quaternion(...(w.frame??[0,0,0,1]))).normalize().toArray() as WireFrame,
      from:'piece' in w.from?{piece:ids.get(w.from.piece)!,port:w.from.port}:{point:move(w.from.point)},
      to:'piece' in w.to?{piece:ids.get(w.to.piece)!,port:w.to.port}:{point:move(w.to.point)},points:w.points.map(move)}));
  }

  private moveWireRoutes(changes:Change[]):Wire[]{
    if(!this.wires.length)return this.wires;
    const moved=new Map(changes.filter(c=>c.before&&c.after&&[...c.before.position,...c.before.rotation].some((v,i)=>v!==[...c.after!.position,...c.after!.rotation][i])).map(c=>[c.before!.id,c]));
    if(!moved.size)return this.wires;
    const replacements=new Map<number,Wire>();
    const groups=wireGroups(this.wires,this.pieces);
    for(const group of groups){
      const ids=new Set(group.flatMap(i=>[this.wires[i].from,this.wires[i].to]).flatMap(e=>'piece' in e?[e.piece]:[]));
      if(!ids.size||[...ids].some(id=>!moved.has(id)))continue;
      const first=moved.get(ids.values().next().value!)!,a=first.before!,b=first.after!;
      const q=new Quaternion().setFromEuler(quaternionRotation(b.rotation)).multiply(new Quaternion().setFromEuler(quaternionRotation(a.rotation)).invert());
      const move=(point:Vec3)=>new Vector3(...point).sub(new Vector3(...a.position)).applyQuaternion(q).add(new Vector3(...b.position));
      if([...ids].some(id=>{const c=moved.get(id)!;return move(c.before!.position).distanceToSquared(new Vector3(...c.after!.position))>1e-8||q.clone().multiply(new Quaternion().setFromEuler(quaternionRotation(c.before!.rotation))).angleTo(new Quaternion().setFromEuler(quaternionRotation(c.after!.rotation)))>1e-6;}))continue;
      const point=(p:Vec3)=>move(p).toArray() as Vec3;
      for(const i of group){const w=this.wires[i];replacements.set(i,{...w,frame:q.clone().multiply(new Quaternion(...(w.frame??[0,0,0,1]))).normalize().toArray() as WireFrame,from:'point' in w.from?{point:point(w.from.point)}:w.from,to:'point' in w.to?{point:point(w.to.point)}:w.to,points:w.points.map(point)});}
    }
    return replacements.size?this.wires.map((w,i)=>replacements.get(i)??w):this.wires;
  }

  query(point: Vec3, radius: number) {
    const ids = new Set<string>();
    for (
      let x = Math.floor((point[0] - radius) / CHUNK);
      x <= Math.floor((point[0] + radius) / CHUNK);
      x++
    )
      for (
        let y = Math.floor((point[1] - radius) / CHUNK);
        y <= Math.floor((point[1] + radius) / CHUNK);
        y++
      )
        for (
          let z = Math.floor((point[2] - radius) / CHUNK);
          z <= Math.floor((point[2] + radius) / CHUNK);
          z++
        )
          for (const id of this.spatial.get(`${x},${y},${z}`) ?? [])
            ids.add(id);
    return [...ids].map((id) => this.pieces.get(id)!);
  }
  duplicateAt(p: Piece, position: Vec3) {
    return { ...structuredClone(p), id: crypto.randomUUID(), position };
  }
  canPlace(piece: Piece, ignoreId?: string | ReadonlySet<string> | null) {
    return this.placementIssue(piece, ignoreId) === null;
  }
  /** Internal intersections are unchanged by a shared translation of the group. */
  hasInternalOverlaps(pieces: readonly Piece[]) {
    const batch=new World();
    for(const piece of pieces) {
      if(batch.overlaps(piece)) return true;
      batch.put(piece,piece.id);
    }
    return false;
  }
  /** Validate a new run against existing pieces and itself without touching world/history. */
  placementBatchIssue(pieces: readonly Piece[], ignoreIds?: ReadonlySet<string>) {
    const batch = new World();
    batch.plots = this.plots;
    for (const piece of pieces) {
      const issue = this.placementIssue(piece,ignoreIds);
      if (issue) return issue;
      if (!this.allowOverlaps) {
        if (batch.overlaps(piece)) return "overlap";
        batch.put(piece,piece.id);
      }
    }
    return null;
  }
  placementIssue(
    piece: Piece,
    ignoreId?: string | ReadonlySet<string> | null,
  ): "below-ground" | "outside-plots" | "overlap" | null {
    const candidate = pieceBounds(piece);
    // Check the rotated footprint, not just the center. Allow only roundoff.
    if (candidate.min[1] < -1e-8) return "below-ground";
    if (this.plots && !coveredByPlots(candidate, this.plots)) return "outside-plots";
    if (this.allowOverlaps) return null;
    return this.overlaps(piece,ignoreId,candidate) ? "overlap" : null;
  }
  private overlaps(piece: Piece, ignoreId?: string | ReadonlySet<string> | null, candidate=pieceBounds(piece)) {
    const visited = new Set<string>();
    // Use cells touched by the proposed bounds, independent of item size.
    for (const key of keys(piece)) {
      for (const id of this.spatial.get(key) ?? []) {
        if ((typeof ignoreId === "string" ? id === ignoreId : ignoreId?.has(id)) || visited.has(id)) continue;
        visited.add(id);
        const other = this.bounds.get(id)!;
        if (
          candidate.min.every(
            (min, axis) =>
              min < other.max[axis] - 0.0001 &&
              candidate.max[axis] > other.min[axis] + 0.0001,
          ) && solidOverlap(piece, this.pieces.get(id)!)
        )
          return true;
      }
    }
    return false;
  }
  // Grid traversal and cached bounds keep exact mesh tests off unrelated pieces.
  // Direction is a normalized world-space vector; distances are in studs.
  rayCandidates(origin: Vec3, direction: Vec3, distance: number) {
    const cell = origin.map((v) => Math.floor(v / CHUNK));
    const step = direction.map(Math.sign);
    const delta = direction.map((v) =>
      v === 0 ? Infinity : CHUNK / Math.abs(v),
    );
    const next = direction.map((v, i) =>
      v === 0
        ? Infinity
        : ((cell[i] + (v > 0 ? 1 : 0)) * CHUNK - origin[i]) / v,
    );
    const ids = new Set<string>();
    while (true) {
      for (const id of this.spatial.get(cell.join(",")) ?? []) ids.add(id);
      const axis = next.indexOf(Math.min(...next));
      if (next[axis] > distance) break;
      cell[axis] += step[axis];
      next[axis] += delta[axis];
    }
    const hits: { piece: Piece; distance: number }[] = [];
    for (const id of ids) {
      const box = this.bounds.get(id)!;
      let near = 0,
        far = distance;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(direction[i]) < 1e-12) {
          if (origin[i] < box.min[i] || origin[i] > box.max[i]) {
            far = -1;
            break;
          }
          continue;
        }
        const a = (box.min[i] - origin[i]) / direction[i],
          b = (box.max[i] - origin[i]) / direction[i];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) break;
      }
      if (near <= far)
        hits.push({ piece: this.pieces.get(id)!, distance: near });
    }
    return hits.sort((a, b) => a.distance - b.distance);
  }
}
