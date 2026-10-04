import { describe, expect, it } from "vitest";
import { buildPath } from "../src/build-path";
import { Quaternion, Vector3 } from "three";
import { quaternionRotation, turnRotation } from "../src/placement";
import { parseProject } from "../src/project";
import { snapBlueprintOnSurface } from "../src/collision";
import { World, pieceBounds, type Piece } from "../src/world";

const template = (extra: Partial<Piece> = {}): Piece => ({
  id: "path-piece", item: "small-floor", wood: "oak",
  position: [0, .5, 0], rotation: [0, 0, 0], ...extra,
});

describe("straight blueprint runs", () => {
  it("lays out touching pieces in either direction without duplicates", () => {
    const run = buildPath(template(), [[0,.5,0],[8,.5,0]], {fill:false});
    expect(run.pieces.map(p=>p.position)).toEqual([[0,.5,0],[2,.5,0],[4,.5,0],[6,.5,0],[8,.5,0]]);
    const back = buildPath(template(), [[8,.5,0],[0,.5,0]], {fill:false});
    expect(back.pieces.map(p=>p.position)).toEqual([...run.pieces].reverse().map(p=>p.position));
    expect(run.pieces.every(p=>p.item==="small-floor" && p.wood==="oak" && p.rotation.join()==="0,0,0")).toBe(true);
  });
  it("fills on the starting stud lattice, including both endpoints", () => {
    const run = buildPath(template(), [[.5,.6,.5],[5.5,.6,.5]], {fill:true});
    expect(run.pieces.map(p=>p.position)).toEqual(Array.from({length:6},(_,i)=>[i+.5,.6,.5]));
    expect(buildPath(template(), [[0,.5,0],[0,.5,0]], {fill:false}).pieces).toHaveLength(1);
    expect(buildPath(template(), [], {fill:false}).pieces).toHaveLength(0);
  });
  it("keeps the chosen pose and uses its rotated footprint for spacing", () => {
    const run = buildPath(template({item:"smooth-wall",wood:"pine",rotation:[0,1,0]}), [[0,4,0],[0,4,12]], {fill:false});
    expect(run.pieces.map(p=>p.position)).toEqual([[0,4,0],[0,4,4],[0,4,8],[0,4,12]]);
    expect(run.pieces.every(p=>p.wood==="pine" && p.rotation.join()==="0,1,0")).toBe(true);
    expect(new World().placementBatchIssue(run.pieces)).toBe(null);
  });
  it("keeps each repeated blueprint flush with a sloping starting face", () => {
    const run=buildPath(template({item:"tiny-tile"}),[[.5,1.1,1.5],[.5,1.6,-.5]],{fill:true,surfaceNormal:[0,4,1]});
    expect(run.pieces.map(p=>p.position)).toEqual([[.5,1.1,1.5],[.5,1.35,.5],[.5,1.6,-.5]]);
    expect(run.pieces.every(p=>p.rotation.join()==="0,0,0")).toBe(true);
  });
});

describe("atomic drag validation", () => {
  it("detects internal overlaps independently of the group's ground and plot positions", () => {
    const world=new World();world.plots=[12];
    const a=template({id:"a",position:[100,-4,100]});
    expect(world.hasInternalOverlaps([a,template({id:"b",position:[102,-4,100]})])).toBe(false);
    expect(world.hasInternalOverlaps([a,template({id:"b",position:[101,-4,100]})])).toBe(true);
    expect(world.pieces.size).toBe(0);expect(world.canUndo).toBe(false);
  });
  it("checks internal and existing collisions without committing candidates", () => {
    const world = new World(); world.load([template({id:"existing",position:[8,.5,0]})],[12]);
    const touching = [template({id:"one"}),template({id:"two",position:[2,.5,0]})];
    expect(world.placementBatchIssue(touching)).toBe(null);
    expect(world.placementBatchIssue([...touching,template({id:"overlap",position:[1,.5,0]})])).toBe("overlap");
    expect(world.placementBatchIssue([template({position:[8,.5,0]})])).toBe("overlap");
    expect(world.pieces.size).toBe(1); expect(world.canUndo).toBe(false);
    world.allowOverlaps=true;
    expect(world.placementBatchIssue([...touching,template({id:"overlap",position:[1,.5,0]})])).toBe(null);
    expect(world.placementBatchIssue([template({position:[0,-.5,0]})])).toBe("below-ground");
    expect(world.placementBatchIssue([template({position:[20,.5,0]})])).toBe("outside-plots");
  });
});

describe("compatibility with previously published project poses", () => {
  it("round-trips finite fractional orientations alongside integer poses", () => {
    const pieces=[template({rotation:[.125,.375,3.75],position:[0,4,0]}),template({id:"old",position:[6,.5,0]})];
    expect(parseProject(JSON.stringify({version:1,name:"Existing build",plots:[12],pieces})).pieces).toEqual(pieces);
    for(const rotation of [[0,4,0],[-.1,0,0],[0,null,0]])
      expect(()=>parseProject(JSON.stringify({version:1,name:"Bad pose",pieces:[template({rotation:rotation as any})]}))).toThrow("rotation");
  });
  it("composes quarter turns on existing fractional poses without losing orientation", () => {
    const rotation:[number,number,number]=[.21,.38,3.65];
    for(const axis of [0,1]) {
      const actual=new Quaternion().setFromEuler(quaternionRotation(turnRotation(rotation,axis)));
      const expected=new Quaternion().setFromEuler(quaternionRotation(rotation))
        .premultiply(new Quaternion().setFromAxisAngle(new Vector3().setComponent(axis,1),Math.PI/2));
      expect(Math.abs(actual.dot(expected))).toBeCloseTo(1,8);
    }
  });
  it("checks the real solids of existing diagonal boxes", () => {
    const world=new World();world.load([template({item:"smooth-wall",position:[0,4,0],rotation:[0,.5,0]})]);
    expect(world.canPlace(template({id:"second",item:"smooth-wall",position:[Math.SQRT2,4,Math.SQRT2],rotation:[0,.5,0]}))).toBe(true);
    expect(world.canPlace(template({id:"third",item:"smooth-wall",position:[.2,4,.2],rotation:[0,.5,0]}))).toBe(false);
  });
  it("uses actual turned wedge bounds for ground clearance", () => {
    const turned=template({item:"4-4-wedge",position:[0,.1,0],rotation:[1.5,0,0]});
    expect(pieceBounds(turned).min[1]).toBeCloseTo(.1,5);expect(new World().canPlace(turned)).toBe(true);
    expect(new World().canPlace({...turned,position:[0,-.1,0]})).toBe(false);
  });
  it("keeps existing tilted poses flush when snapping to the ground", () => {
    for(let i=1;i<=16;i++) {
      const rotation:[number,number,number]=[i/19,i/31,0];
      const position=snapBlueprintOnSurface([0,0,0],[0,1,0],"smooth-wall",rotation);
      expect(new World().canPlace(template({item:"smooth-wall",rotation,position})),`${rotation}`).toBe(true);
    }
  });
});
