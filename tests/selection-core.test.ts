import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { World, type Piece } from "../src/world";
import { selectionBounds, translateSelection, placeSelectionOnSurface, selectInRectangle, rotateSelection } from "../src/selection";
import { quaternionRotation } from "../src/placement";

const piece = (id: string, x: number, z = 0): Piece => ({id,item:"small-floor",wood:id === "a" ? "oak" : "birch",position:[x,.5,z],rotation:[0,id === "a" ? 1 : 0,0]});
describe("group selection", () => {
  const assembly: Piece[] = [
    {id:"ramp-a",item:"4-4-wedge",wood:"oak",position:[-3,8,1],rotation:[1,0,0]},
    {id:"ramp-b",item:"4-4-wedge",wood:"birch",position:[3,8,-1],rotation:[0,1,0]},
  ];
  it.each([
    [0,[[-3,7,0],[3,9,0]]],
    [1,[[1,8,3],[-1,8,-3]]],
    [2,[[0,5,1],[0,11,-1]]],
  ])("turns the assembly around its shared center on axis %i", (axis, positions) => {
    const turned = rotateSelection(assembly,axis as number);
    expect(turned.map(p=>p.position)).toEqual((positions as number[][]).map(p=>p.map(v=>v===0?0:v)));
    expect(turned.map(p=>[p.id,p.item,p.wood])).toEqual(assembly.map(p=>[p.id,p.item,p.wood]));
    const unit=new Vector3().setComponent(axis as number,1);
    for (let i=0;i<2;i++) {
      const before=new Vector3(0,0,-1).applyEuler(quaternionRotation(assembly[i].rotation)).applyAxisAngle(unit,Math.PI/2);
      const after=new Vector3(0,0,-1).applyEuler(quaternionRotation(turned[i].rotation));
      expect(after.distanceTo(before)).toBeLessThan(1e-8);
    }
    expect(assembly.map(p=>p.position)).toEqual([[-3,8,1],[3,8,-1]]);
  });
  it("restores fractional offsets and every member's orientation after four group turns", () => {
    const original=translateSelection(assembly,[.5,.1,-.5]);
    for (const axis of [0,1]) {
      let rotated=original;
      for (let n=0;n<4;n++) rotated=rotateSelection(rotated,axis);
      expect(rotated.map(p=>p.position)).toEqual(original.map(p=>p.position));
      for (let i=0;i<2;i++) {
        for (const point of [[0,0,-1],[1,0,0]]) {
          const before=new Vector3(...point).applyEuler(quaternionRotation(original[i].rotation));
          const after=new Vector3(...point).applyEuler(quaternionRotation(rotated[i].rotation));
          expect(after.distanceTo(before)).toBeLessThan(1e-8);
        }
      }
    }
  });
  it("keeps relative offsets, rotations and finishes when moving mixed pieces", () => {
    const original = [piece("a",-3), {...piece("b",3),item:"tiny-tile",position:[3,.1,0] as [number,number,number]}];
    const moved = translateSelection(original,[7,2,-5]);
    expect(moved.map(p=>p.position)).toEqual([[4,2.5,-5],[10,2.1,-5]]);
    expect(moved.map(p=>[p.id,p.item,p.wood,p.rotation])).toEqual(original.map(p=>[p.id,p.item,p.wood,p.rotation]));
    expect(original[0].position).toEqual([-3,.5,0]);
  });
  it("snaps a whole group's translation in studs and keeps its lowest piece flush", () => {
    const original=[piece("a",-.5), {...piece("b",4.5),position:[4.5,2.5,0] as [number,number,number]}];
    const first=placeSelectionOnSurface(original,[8.2,0,6.2],[0,1,0],0);
    const next=placeSelectionOnSurface(original,[9.2,0,6.2],[0,1,0],0);
    expect(selectionBounds(first).min[1]).toBeCloseTo(0);
    expect(first[1].position[1]-first[0].position[1]).toBe(2);
    for(let i=0;i<2;i++) expect(next[i].position[0]-first[i].position[0]).toBe(1);
    expect(first[0].position[0]-original[0].position[0]).toBe(Math.round(first[0].position[0]-original[0].position[0]));
  });
  it("ignores all moving originals but checks every candidate against outsiders", () => {
    const world=new World(), original=[piece("a",-3),piece("b",3)];world.load([...original,piece("obstacle",9)]);
    const ids=new Set(original.map(p=>p.id));
    const moved=translateSelection(original,[6,0,0]);
    expect(world.placementIssue(moved[0],ids)).toBeNull();
    expect(world.placementIssue(moved[1],ids)).toBe("overlap");
    expect(world.placementIssue(original[0])).toBe("overlap");
  });
  it("checks every member against ground and plot limits", () => {
    const world=new World();world.load([], [12]);
    const moved=translateSelection([piece("a",0),piece("b",6)],[14,0,0]);
    expect(world.placementIssue(moved[0])).toBeNull();
    expect(world.placementIssue(moved[1])).toBe("outside-plots");
    expect(world.placementIssue({...moved[0],position:[14,.4,0]})).toBe("below-ground");
  });
  it("selects intersecting projected bounds in either drag direction, excluding behind-camera pieces", () => {
    const world=new World();world.load([piece("a",-3),piece("b",3),piece("c",15),{...piece("behind",0),position:[0,.5,30]}]);
    const camera=new PerspectiveCamera(45,1,.1,100);camera.position.set(0,10,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const viewport={left:0,top:0,width:1000,height:1000};
    const project=(p:number[])=>{const v=new Vector3(...p).project(camera);return [(v.x+1)*500,(1-v.y)*500] as [number,number]};
    const a=project([-5,3,0]),b=project([5,-2,0]);
    expect(selectInRectangle(world,camera,viewport,a,b,100).sort()).toEqual(["a","b"]);
    expect(selectInRectangle(world,camera,viewport,b,a,100).sort()).toEqual(["a","b"]);
  });
});
