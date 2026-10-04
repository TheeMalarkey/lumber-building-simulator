import { describe, expect, it } from "vitest";
import { World, type Piece } from "../src/world";
import { Vector3 } from "three";
import { quaternionRotation } from "../src/placement";
import { snapBlueprintOnSurface } from "../src/collision";
import { placeSelectionOnSurface } from "../src/selection";

const piece = (id: string, item: string, position: Piece["position"], rotation: Piece["rotation"] = [0,0,0]): Piece =>
  ({id,item,position,rotation,wood:"oak"});

describe("blueprint solid collision", () => {
  it("snaps a complementary wedge directly onto the slope without an invisible box gap", () => {
    const n: Piece["position"]=[0,Math.SQRT1_2,Math.SQRT1_2];
    const pos=snapBlueprintOnSurface([0,2,0],n,"4-4-wedge",[2,0,0]);
    expect(pos).toEqual([0,2,0]);
    expect(placeSelectionOnSurface([piece("upper","4-4-wedge",[0,10,0],[2,0,0])],[0,2,0],n)[0].position).toEqual(pos);
    const world=new World();world.load([piece("lower","4-4-wedge",[0,2,0])]);
    expect(world.placementIssue(piece("upper","4-4-wedge",pos,[2,0,0]))).toBeNull();
  });
  it("leaves table legs and corner openings available for other blueprints", () => {
    const world=new World();world.load([piece("table","long-table",[0,2,0])]);
    expect(world.placementIssue(piece("tile","tiny-tile",[0,.1,0]))).toBeNull();
    expect(world.placementIssue(piece("tile","tiny-tile",[3.5,.1,1.5]))).toBe("overlap");
    world.load([piece("corner","smooth-wall-corner",[0,4,0])]);
    expect(world.placementIssue(piece("tile","tiny-tile",[.5,.1,.5]))).toBeNull();
    expect(world.placementIssue(piece("tile","tiny-tile",[-.5,.1,-.5]))).toBe("overlap");
  });
  it("allows touching treads inside the stairs' outer box but rejects penetration", () => {
    const world = new World(); world.load([piece("stairs","stairs",[0,1,0])]);
    expect(world.placementIssue(piece("step","small-floor",[0,1.5,1]))).toBeNull();
    expect(world.placementIssue(piece("step","small-floor",[0,1.49,1]))).toBe("overlap");
    expect(world.placementIssue(piece("step","small-floor",[0,2.5,-1]))).toBeNull();
  });
  it.each([0,1,2,3])("uses the wedge slope after yaw %i instead of a solid cuboid", yaw => {
    const rotation: Piece["rotation"] = [0,yaw,0];
    const turn = (v: Piece["position"]) => new Vector3(...v).applyEuler(quaternionRotation(rotation)).toArray() as Piece["position"];
    const world = new World(); world.load([piece("ramp","4-4-wedge",[0,2,0],rotation)]);
    expect(world.placementIssue(piece("tile","tiny-tile",turn([0,1.6,1]),rotation))).toBeNull();
    expect(world.placementIssue(piece("tile","tiny-tile",turn([0,1.5,1]),rotation))).toBe("overlap");
  });
  it("allows complementary tilted wedges to share a diagonal face", () => {
    const world = new World(); world.load([piece("lower","4-4-wedge",[0,6,0])]);
    expect(world.placementIssue(piece("upper","4-4-wedge",[0,6,0],[2,0,0]))).toBeNull();
    expect(world.placementIssue(piece("upper","4-4-wedge",[0,5.99,0],[2,0,0]))).toBe("overlap");
    expect(world.placementIssue(piece("same","4-4-wedge",[0,6,0]))).toBe("overlap");
  });
});
