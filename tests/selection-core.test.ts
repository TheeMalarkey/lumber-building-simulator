import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { World, type Piece } from "../src/world";
import { selectionBounds, translateSelection, placeSelectionOnSurface, selectInRectangle } from "../src/selection";

const piece = (id: string, x: number, z = 0): Piece => ({id,item:"small-floor",wood:id === "a" ? "oak" : "birch",position:[x,.5,z],rotation:[0,id === "a" ? 1 : 0,0]});
describe("group selection", () => {
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
