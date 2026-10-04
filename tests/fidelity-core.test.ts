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
  expect(CATALOG.length).toBe(reference.entries.length);
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
