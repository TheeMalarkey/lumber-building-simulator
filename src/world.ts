import { ITEMS, type Vec3 } from "./catalog";
import { rotatedSize } from "./placement";
import { connectedPlots, coveredByPlots, touchesPlot, validatePlots } from "./plots";
import { solidOverlap } from "./collision";
export interface Piece {
  id: string;
  item: string;
  wood: string;
  position: Vec3;
  rotation: Vec3;
}
export interface Change {
  before: Piece | null;
  after: Piece | null;
}
type HistoryEntry = Change[] | { beforePlots: number[]; afterPlots: number[] };
export const CHUNK = 64;
export const chunkKey = (p: Vec3) =>
  p.map((n) => Math.floor(n / CHUNK)).join(",");
export function pieceBounds(p: Piece) {
  const s = rotatedSize(ITEMS.get(p.item)!.size, p.rotation);
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
  chunks = new Map<string, Set<string>>();
  spatial = new Map<string, Set<string>>();
  bounds = new Map<string, ReturnType<typeof pieceBounds>>();
  dirty = new Set<string>();
  // Null is used by standalone spatial/benchmark fixtures; the editor always loads land.
  plots: number[] | null = null;
  allowOverlaps = false;
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  revision = 0;
  onChange = () => {};
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  private put(p: Piece | null, id: string) {
    const old = this.pieces.get(id);
    if (old) {
      const k = chunkKey(old.position);
      this.chunks.get(k)?.delete(id);
      if (!this.chunks.get(k)?.size) this.chunks.delete(k);
      this.dirty.add(k);
      for (const key of keys(old)) {
        this.spatial.get(key)?.delete(id);
        if (!this.spatial.get(key)?.size) this.spatial.delete(key);
      }
    }
    this.pieces.delete(id);
    this.bounds.delete(id);
    if (p) {
      const copy = structuredClone(p);
      this.pieces.set(id, copy);
      this.bounds.set(id, pieceBounds(copy));
      const k = chunkKey(copy.position);
      if (!this.chunks.has(k)) this.chunks.set(k, new Set());
      this.chunks.get(k)!.add(id);
      this.dirty.add(k);
      for (const key of keys(copy)) {
        if (!this.spatial.has(key)) this.spatial.set(key, new Set());
        this.spatial.get(key)!.add(id);
      }
    }
  }
  private apply(changes: HistoryEntry, reverse = false) {
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
  execute(changes: Change[]) {
    if (!changes.length) return;
    this.apply(changes);
    this.past.push(structuredClone(changes));
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
  load(pieces: Piece[], plots: number[] | null = this.plots) {
    const nextPlots = plots === null ? null : validatePlots(plots);
    for (const key of this.chunks.keys()) this.dirty.add(key);
    this.pieces.clear();
    this.chunks.clear();
    this.spatial.clear();
    this.bounds.clear();
    this.past = [];
    this.future = [];
    this.plots = nextPlots;
    for (const p of pieces) this.put(p, p.id);
    this.revision++;
    this.onChange();
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
  placementIssue(
    piece: Piece,
    ignoreId?: string | ReadonlySet<string> | null,
  ): "below-ground" | "outside-plots" | "overlap" | null {
    const candidate = pieceBounds(piece);
    // Check the rotated footprint, not just the center. Allow only roundoff.
    if (candidate.min[1] < -1e-8) return "below-ground";
    if (this.plots && !coveredByPlots(candidate, this.plots)) return "outside-plots";
    if (this.allowOverlaps) return null;
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
          return "overlap";
      }
    }
    return null;
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
