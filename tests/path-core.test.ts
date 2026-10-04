import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { quaternionRotation, turnRotation } from "../src/placement";
import { parseProject } from "../src/project";
import { World, pieceBounds, type Piece } from "../src/world";
import * as paths from "../src/build-path";
import { CATALOG, ITEMS } from "../src/catalog";
import { snapBlueprintOnSurface } from "../src/collision";

const template = (extra: Partial<Piece> = {}): Piece => ({
  id: "path-piece", item: "small-floor", wood: "oak",
  position: [0, .5, 0], rotation: [0, 0, 0], ...extra,
});

describe("blueprint paths", () => {
  it("lays out touching straight pieces in either direction, without duplicates", () => {
    const run = paths.buildPath(template(), [[0,.5,0],[8,.5,0]], {mode:"line",fill:false});
    expect(run.pieces.map(p=>p.position)).toEqual([[0,.5,0],[2,.5,0],[4,.5,0],[6,.5,0],[8,.5,0]]);
    const back = paths.buildPath(template(), [[8,.5,0],[0,.5,0]], {mode:"line",fill:false});
    expect(back.pieces.map(p=>p.position)).toEqual([...run.pieces].reverse().map(p=>p.position));
    expect(run.pieces.every(p=>p.item==="small-floor" && p.wood==="oak" && p.rotation.join() === "0,0,0")).toBe(true);
  });
  it("fills the span on a one-stud lattice including both endpoints", () => {
    const run = paths.buildPath(template(), [[.5,.6,.5],[5.5,.6,.5]], {mode:"line",fill:true});
    expect(run.pieces.map(p=>p.position)).toEqual(Array.from({length:6},(_,i)=>[i+.5,.6,.5]));
    expect(paths.buildPath(template(), [[0,.5,0],[0,.5,0],[0,.5,0]], {mode:"curve",fill:false}).pieces).toHaveLength(1);
  });
  it("bends through multiple points with smooth tangent orientations and stud movements", () => {
    const wall = template({item:"smooth-wall",position:[0,4,0]});
    const run = paths.buildPath(wall, [[-12,4,0],[0,4,-10],[12,4,0]], {mode:"curve",fill:false});
    expect(run.pieces.length).toBeGreaterThan(6);
    expect(run.pieces.some(p=>p.position[2]<-8)).toBe(true);
    expect(run.pieces.some(p=>p.rotation.some(v=>!Number.isInteger(v)))).toBe(true);
    expect(run.pieces.every(p=>p.position.every((v,i)=>Number.isInteger(v-[-12,4,0][i])))).toBe(true);
    expect(new Set(run.pieces.map(p=>p.position.join())).size).toBe(run.pieces.length);
    expect(run.pieces.every(p=>p.rotation.every(Number.isFinite))).toBe(true);
  });
  it("raises ramp points by the chosen wedge grade and aligns the real slope", () => {
    expect(paths.nextRampPoint([0,.5,0],[8,.5,0],"1-4-wedge")).toEqual([8,2.5,0]);
    const run = paths.buildPath(template({item:"1-4-wedge"}), [[0,.5,0],[8,2.5,0]], {mode:"wedge",wedge:"ramp",fill:false});
    expect(run.pieces.length).toBeGreaterThan(1);
    for (const p of run.pieces) {
      expect(ITEMS.get(p.item)?.shape).toBe("wedge");
      const slope = new Vector3(0,1,-4).applyEuler(quaternionRotation(p.rotation)).normalize();
      expect(slope.dot(new Vector3(8,2,0).normalize())).toBeCloseTo(1,5);
    }
  });
  it("joins selected-grade ramp wedges without gaps or changes in rise", () => {
    const run=paths.buildPath(template({item:"1-4-wedge"}),[[0,.5,0],[16,4.5,0]],{mode:"wedge",wedge:"ramp",fill:false});
    expect(run.pieces.map(p=>p.position)).toEqual([[0,.5,0],[4,1.5,0],[8,2.5,0],[12,3.5,0],[16,4.5,0]]);
    expect(new World().placementBatchIssue(run.pieces)).toBe(null);
  });
  it("turns wedge faces into horizontal walls or vertical arches using catalog variants", () => {
    for (const points of [ [[-12,2,0],[0,2,-10],[12,2,0]], [[-12,4,0],[0,14,0],[12,4,0]] ] as [number,number,number][][]) {
      const run = paths.buildPath(template({item:"1-4-wedge"}), points, {mode:"wedge",wedge:"wall-arch",fill:false});
      const expectedNormal = new Vector3(0,points[1][2] ? 1 : 0,points[1][2] ? 0 : 1);
      expect(run.pieces.length).toBeGreaterThan(4);
      for (const p of run.pieces) {
        expect(CATALOG.some(c=>c.id===p.item && c.shape==="wedge")).toBe(true);
        const extrusion = new Vector3(1,0,0).applyEuler(quaternionRotation(p.rotation));
        expect(Math.abs(extrusion.dot(expectedNormal))).toBeCloseTo(1,5);
        expect(p.rotation.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe("atomic path validation", () => {
  it("checks internal and existing collisions without committing any candidates", () => {
    const world = new World(); world.load([template({id:"existing",position:[8,.5,0]})],[12]);
    const touching = [template({id:"one"}),template({id:"two",position:[2,.5,0]})];
    expect(world.placementBatchIssue(touching)).toBe(null);
    expect(world.placementBatchIssue([...touching,template({id:"overlap",position:[1,.5,0]})])).toBe("overlap");
    expect(world.placementBatchIssue([template({id:"outside-collision",position:[8,.5,0]})])).toBe("overlap");
    expect(world.pieces.size).toBe(1); expect(world.canUndo).toBe(false);
    world.allowOverlaps=true;
    expect(world.placementBatchIssue([...touching,template({id:"overlap",position:[1,.5,0]})])).toBe(null);
    expect(world.placementBatchIssue([template({position:[0,-.5,0]})])).toBe("below-ground");
    expect(world.placementBatchIssue([template({position:[20,.5,0]})])).toBe("outside-plots");
  });
});

describe("continuous blueprint poses", () => {
  it("round-trips finite curve orientations alongside old project poses", () => {
    const pieces = [template({rotation:[.125, .375, 3.75]}), template({id:"old", position:[6, .5, 0]})];
    const parsed = parseProject(JSON.stringify({version:1,name:"Curved build",plots:[12],pieces}));
    expect(parsed.pieces).toEqual(pieces);
    for (const rotation of [[0,4,0],[-.1,0,0],[0,null,0]])
      expect(() => parseProject(JSON.stringify({version:1,name:"Bad pose",pieces:[template({rotation:rotation as any})]}))).toThrow("rotation");
  });
  it("composes R and T on fractional poses without losing their orientation", () => {
    const rotation: [number,number,number] = [.21, .38, 3.65];
    for (const axis of [0,1]) {
      const actual = new Quaternion().setFromEuler(quaternionRotation(turnRotation(rotation,axis)));
      const expected = new Quaternion().setFromEuler(quaternionRotation(rotation))
        .premultiply(new Quaternion().setFromAxisAngle(new Vector3().setComponent(axis,1),Math.PI/2));
      expect(Math.abs(actual.dot(expected))).toBeCloseTo(1,8);
      let cycle = rotation;
      for (let i=0;i<4;i++) cycle = turnRotation(cycle,axis);
      expect(Math.abs(new Quaternion().setFromEuler(quaternionRotation(cycle))
        .dot(new Quaternion().setFromEuler(quaternionRotation(rotation))))).toBeCloseTo(1,8);
    }
  });
  it("allows separated diagonal boxes whose outer bounds overlap", () => {
    const world = new World();
    world.load([template({item:"smooth-wall",position:[0,4,0],rotation:[0,.5,0]})]);
    expect(world.canPlace(template({id:"second",item:"smooth-wall",position:[Math.SQRT2,4,Math.SQRT2],rotation:[0,.5,0]}))).toBe(true);
    expect(world.canPlace(template({id:"third",item:"smooth-wall",position:[.2,4,.2],rotation:[0,.5,0]}))).toBe(false);
  });
  it("uses the actual turned wedge bounds for ground clearance", () => {
    const turned=template({item:"4-4-wedge",position:[0,.1,0],rotation:[1.5,0,0]});
    expect(pieceBounds(turned).min[1]).toBeCloseTo(.1,5);
    expect(new World().canPlace(turned)).toBe(true);
    expect(new World().canPlace({...turned,position:[0,-.1,0]})).toBe(false);
  });
  it("accepts a continuously tilted box resting flush on the ground", () => {
    for(let i=1;i<=16;i++) {
      const rotation:[number,number,number]=[i/19,i/31,0];
      const position=snapBlueprintOnSurface([0,0,0],[0,1,0],"smooth-wall",rotation);
      expect(new World().canPlace(template({item:"smooth-wall",rotation,position})),`${rotation}`).toBe(true);
    }
    expect(snapBlueprintOnSurface([0,0,0],[0,1,0],"tiny-tile",[0,0,0])).toEqual([.5,.1,.5]);
  });
});
