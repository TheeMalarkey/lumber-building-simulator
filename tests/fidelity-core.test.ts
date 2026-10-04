import reference from "./fixtures/blueprint-table.json";
import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from "three";
import { CATALOG, ITEMS } from "../src/catalog";
import { geometryFor } from "../src/geometry";
// Visual-feature checks from the linked wiki thumbnails, not recipe part counts.
// Rays use centered local model coordinates, the same geometry used by picking.
function hit(id: string, origin: number[], direction: number[]) {
  const mesh = new Mesh(geometryFor(id), new MeshBasicMaterial({side:DoubleSide}));
  mesh.updateMatrixWorld();
  const hits = new Raycaster(new Vector3(...origin),new Vector3(...direction)).intersectObject(mesh);
  mesh.material.dispose();
  return hits[0]?.point;
}
describe("blueprint reference silhouettes", () => {
  it("uses solid vertical fence boards, not a rail fence", () => {
    for(const id of ["fence","thin-fence","short-fence","thin-short-fence"])
      expect(hit(id,[0.2,0,5],[0,0,-1]),id).toBeDefined();
  });
  it("has two normal and four steep stair treads", () => {
    for(const [id,count] of [["stairs",2],["steep-stairs",4]] as const) {
      const levels=new Set(Array.from({length:16},(_,i)=>hit(id,[0,10,1.875-i*.25],[0,-1,0])!.y.toFixed(4)));
      expect(levels.size,id).toBe(count);
    }
  });
  it("has a solid chair back rather than spindles", () => {
    expect(hit("mundane-chair",[.3,1.3,4],[0,0,-1])).toBeDefined();
  });
  it("keeps cabinet interiors open for separate countertops", () => {
    for(const id of ["thin-cabinet","kitchen-cabinet","kitchen-cabinet-corner"]) {
      const y=hit(id,[-.8,8,0],[0,-1,0])!.y;
      expect(y,id).toBeLessThan(-.8);
    }
  });
  it("leaves an inside notch in the wide L cabinet", () => {
    expect(hit("wide-kitchen-cabinet-corner",[2.5,8,2.5],[0,-1,0])).toBeUndefined();
    expect(hit("wide-kitchen-cabinet-corner",[-2,8,-2],[0,-1,0])).toBeDefined();
  });
  it("keeps a door face flat away from its round knob", () => {
    const z=hit("basic-door",[0,1.8,4],[0,0,-1])!.z;
    const lower=hit("basic-door",[0,0,4],[0,0,-1])!.z;
    expect(z).toBeCloseTo(lower,5);
  });
  it("places the sink bowl below its rim", () => {
    const rim=hit("countertop-with-sink",[1.8,8,0],[0,-1,0])!.y;
    const bowl=hit("countertop-with-sink",[.4,8,0],[0,-1,0])!.y;
    expect(rim-bowl).toBeGreaterThan(.3);
  });
});
describe("blueprint wood requirements", () => {
  it("does not inherit wall costs for fence variants", () => {
    const cases={"fence":8,"thin-fence":5,"fence-corner":6,"short-fence":5,"thin-short-fence":3,"short-fence-corner":4};
    for(const [id,cost] of Object.entries(cases)) expect(ITEMS.get(id)!.woodCost,id).toBe(cost);
  });
  it("fills the missing wedge requirements from the independent table", () => {
    const costs = [[4,8,3],[4,10,3],[4,12,4],[4,14,5],[3,6,2],[3,8,3],[3,10,3],[2,6,2],[2,8,3],[1,4,1]];
    const heights:Record<number,number>={};
    for(const [d,wide,thin] of costs) {
      const h=heights[d]=(heights[d]||0)+1;
      expect(ITEMS.get(h+"-"+d+"-wedge")!.woodCost).toBe(wide);
      expect(ITEMS.get(h+"-"+d+"-x-1-wedge")!.woodCost).toBe(thin);
    }
  });
});

it("matches every independently recorded name, dimension, and wood requirement", () => {
  expect(CATALOG.filter(p=>!p.fixedMaterial).length).toBe(reference.entries.length);
  for(const row of reference.entries) {
    const item=CATALOG.find(c=>c.name===row.name);
    expect(item,row.name).toBeDefined();
    expect(item!.size,row.name).toEqual(row.size);
    expect(item!.woodCost,row.name).toBe(row.woodCost);
  }
});
it("separates fixed door and sink hardware from the chosen wood", () => {
  expect(geometryFor("basic-door").groups.map(g=>g.materialIndex)).toContain(1);
  expect(geometryFor("countertop-with-sink").groups.map(g=>g.materialIndex)).toEqual([0,1,2,3]);
});

describe("close-up reference details", () => {
  it("joins corner boards without an open slit at the elbow", () => {
    for (const id of ["fence-corner", "short-fence-corner",
      "corrugated-wall-corner", "short-corrugated-wall-corner", "corrugated-wall-corner-stub"]) {
      for (const z of [-.4, -.2, -.06, .06])
        expect(hit(id, [-.75, 10, z], [0, -1, 0]), `${id} elbow ${z}`).toBeDefined();
    }
  });
  it("leaves a broad inside opening in the thin fence corner", () => {
    for (const id of ["fence-corner", "short-fence-corner"])
      expect(hit(id, [.5, 10, -.15], [0, -1, 0]), id).toBeUndefined();
  });
  it("places the half-door knob above center and the basic-door knob below center", () => {
    for (const [id, height] of [["half-door", 3], ["basic-door", 3], ["fat-door", 4]] as const) {
      const g = geometryFor(id), p = g.getAttribute("position");
      const group = g.groups.find(g => g.materialIndex === 1)!;
      const ys = Array.from({length:group.count}, (_, i) => p.getY(group.start + i));
      const center = (Math.min(...ys) + Math.max(...ys)) / 2 + ITEMS.get(id)!.size[1] / 2;
      expect(center, id).toBeCloseTo(height, 5);
      expect(Math.max(...ys) - Math.min(...ys), id).toBeGreaterThan(.6);
    }
  });
  it("uses full round ladder rungs with clear gaps between them", () => {
    expect(hit("ladder", [0, .22, 5], [0, 0, -1])).toBeDefined();
    expect(hit("ladder", [0, .375, 5], [0, 0, -1])).toBeUndefined();
  });
  it("smooths cylinder sides while keeping caps and box edges sharp", () => {
    const g = geometryFor("ladder"), p = g.getAttribute("position"), n = g.getAttribute("normal");
    const groups = new Map<string, number[][]>();
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) > 1.51 || Math.abs(p.getY(i)) > .26 || Math.abs(n.getX(i)) > .01) continue;
      const key = [p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(",");
      const list = groups.get(key) || []; list.push([n.getX(i),n.getY(i),n.getZ(i)]); groups.set(key,list);
    }
    expect(groups.size).toBeGreaterThan(10);
    for (const normals of groups.values()) for (const normal of normals)
      expect(new Vector3(...normal).distanceTo(new Vector3(...normals[0]))).toBeLessThan(1e-5);
  });
});
