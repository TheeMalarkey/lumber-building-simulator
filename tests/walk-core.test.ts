import { describe, expect, it } from "vitest";
import { Group, Mesh, Vector3 } from "three";
import { WalkController, WalkPhysics, WALK_HEIGHT, WALK_RADIUS } from "../src/walk";
import { World, type Piece } from "../src/world";

const still = new Vector3();
const piece = (id: string, item: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): Piece => ({ id, item, position, rotation, wood: "oak" });
function setup(pieces: Piece[] = []) {
  const world = new World(); world.load(pieces);
  return new WalkPhysics(world);
}
function run(walker: WalkPhysics, seconds: number, direction = still, fast = false) {
  for (let i = 0; i < Math.round(seconds * 120); i++) walker.update(1 / 120, direction, fast);
}

describe("jump animation", () => {
  it.each([
    { turn: 0, forward: [0, 0, -1] },
    { turn: 1, forward: [-1, 0, 0] },
    { turn: 2, forward: [0, 0, 1] },
    { turn: 3, forward: [1, 0, 0] },
  ])("raises hands forward and trails feet behind when facing quarter-turn $turn", ({ turn, forward }) => {
    const walker = new WalkController(new World());
    walker.spawn(new Vector3());
    walker.avatar.rotation.y = turn * Math.PI / 2;
    const limbs = walker.avatar.children.filter((part): part is Group => part instanceof Group);
    const facing = new Vector3(...forward);
    walker.update(.1, still, false, true);
    for (const phase of ["rising", "falling"]) {
      if (phase === "falling") run(walker, .25);
      expect(walker.grounded).toBe(false);
      expect(Math.sign(walker.velocity.y)).toBe(phase === "rising" ? 1 : -1);
      walker.animate(.1, still);
      walker.avatar.updateMatrixWorld(true);
      for (const limb of limbs) {
        const mesh = limb.children[0] as Mesh;
        mesh.geometry.computeBoundingBox();
        const end = mesh.localToWorld(new Vector3(0, mesh.geometry.boundingBox!.min.y, 0));
        const offset = end.sub(limb.getWorldPosition(new Vector3()));
        if (limb.position.y > 3) {
          expect.soft(offset.dot(facing), `${phase} hand faces forward`).toBeGreaterThan(.5);
          expect.soft(offset.y, `${phase} hand rises above shoulder`).toBeGreaterThan(0);
        } else {
          expect.soft(offset.dot(facing), `${phase} foot trails behind`).toBeLessThan(-.1);
        }
      }
    }
    run(walker, 1);
    walker.animate(.1, still);
    expect(walker.grounded).toBe(true);
    for (const limb of limbs) expect(limb.rotation.x).toBeCloseTo(0);
  });
});

describe("walk physics", () => {
  it("walks up the actual wedge slope and down again", () => {
    const walker = setup([piece("ramp", "4-4-wedge", [0,2,0])]);
    walker.spawn(new Vector3(0,0,4));
    run(walker,.23,new Vector3(0,0,-1));
    expect(walker.position.z).toBeLessThan(1);
    expect(walker.position.y).toBeGreaterThan(1);
    expect(walker.position.y).toBeLessThan(4);
    expect(walker.canOccupy(walker.position)).toBe(true);
    run(walker,.4,new Vector3(0,0,1));run(walker,.5);
    expect(walker.position.y).toBe(0);
  });
  it("walks through space below a raised tabletop but blocks its legs", () => {
    const walker = setup([piece("table", "long-table", [0,5,0])]);
    walker.spawn(new Vector3(0,0,8));
    run(walker,.7,new Vector3(0,0,-1));
    expect(walker.position.z).toBeLessThan(-2);
    expect(walker.position.y).toBe(0);
    expect(walker.canOccupy(new Vector3(3.75,2,1.75))).toBe(false);
  });
  it("keeps the follow camera in empty space above a slope", () => {
    const walker = setup([piece("ramp","4-4-wedge",[0,2,0])]);
    const camera=walker.cameraPosition(new Vector3(0,3.5,5),new Vector3(0,3.5,1));
    expect(camera.z).toBeCloseTo(1);
  });
  it("does not step onto raised land when a ceiling leaves no standing clearance", () => {
    const world = new World();
    world.load([piece("roof", "large-floor", [-16, 5.7, 0])], [12]);
    const walker = new WalkPhysics(world); walker.position.set(-20.1, -.1, 0); walker.grounded = true;
    run(walker, .1, new Vector3(1, 0, 0));
    expect(walker.position.x).toBeLessThan(-20);
    expect(walker.canOccupy(walker.position)).toBe(true);
  });
  it("walks between raised plot tops and grass one tenth of a stud below", () => {
    const world = new World(); world.load([], [12]);
    const walker = new WalkPhysics(world);
    walker.spawn(new Vector3(22, 8, 0));
    expect(walker.position.y).toBeCloseTo(-.1);
    run(walker, .3, new Vector3(-1, 0, 0));
    expect(walker.position.y).toBe(0);
    run(walker, .4, new Vector3(1, 0, 0));
    run(walker, .3);
    expect(walker.position.y).toBeCloseTo(-.1);
    expect(walker.grounded).toBe(true);
  });
  it("rejects a spawn where the classic head mesh would enter the ceiling", () => {
    // A floor is one stud thick: its underside is at 5.25, just below the head top.
    const walker = setup([piece("roof", "floor", [0, 5.75, 0])]);
    expect(walker.canOccupy(new Vector3())).toBe(false);
  });
  it("spawns on ground beneath the freecam and moves at 16 or 24 studs per second", () => {
    const walker = setup();
    expect(walker.spawn(new Vector3(40, 30, 44))).toBe(true);
    expect(walker.position.toArray()).toEqual([40, 0, 44]);
    run(walker, 1, new Vector3(1, 0, 0));
    expect(walker.position.x).toBeCloseTo(56, 5);
    run(walker, 1, new Vector3(1, 0, 0), true);
    expect(walker.position.x).toBeCloseTo(80, 5);
    expect(walker.grounded).toBe(true);
  });
  it("blocks walls while sliding parallel to them", () => {
    const walker = setup([piece("wall", "smooth-wall", [0, 4, 0])]);
    walker.spawn(new Vector3(0, 0, 5));
    run(walker, 0.5, new Vector3(0.25, 0, -1));
    expect(walker.position.z).toBeGreaterThanOrEqual(0.5 + WALK_RADIUS - 0.001);
    expect(walker.position.x).toBeGreaterThan(1);
    expect(walker.canOccupy(walker.position)).toBe(true);
  });
  it("jumps once, falls, and lands without passing through the ground", () => {
    const walker = setup(); walker.spawn(new Vector3());
    walker.update(1 / 120, still, false, true);
    expect(walker.velocity.y).toBeGreaterThan(0);
    run(walker, 0.15);
    const airborneVelocity = walker.velocity.y;
    walker.update(1 / 120, still, false, true);
    expect(walker.velocity.y).toBeLessThan(airborneVelocity);
    run(walker, 1);
    expect(walker.position.y).toBe(0);
    expect(walker.grounded).toBe(true);
  });
  it("stops the head at a ceiling", () => {
    const walker = setup([piece("roof", "smooth-wall", [0, 6.5, 0], [1, 0, 0])]);
    walker.spawn(new Vector3());
    walker.update(1 / 120, still, false, true);
    let peak = walker.position.y;
    for (let i = 0; i < 120; i++) { walker.update(1 / 120, still); peak = Math.max(peak, walker.position.y); }
    expect(peak).toBeGreaterThan(0.3);
    expect(peak + WALK_HEIGHT).toBeLessThanOrEqual(6.001);
    expect(walker.grounded).toBe(true);
  });
  it("walks up actual steep stair treads and back down", () => {
    const walker = setup([piece("stairs", "steep-stairs", [0, 2, 0])]);
    walker.spawn(new Vector3(0, 0, 4));
    run(walker, 0.3, new Vector3(0, 0, -1));
    expect(walker.position.z).toBeLessThan(0);
    expect(walker.position.y).toBeGreaterThanOrEqual(3);
    expect(walker.canOccupy(walker.position)).toBe(true);
    run(walker, 0.5, new Vector3(0, 0, 1));
    run(walker, 0.5);
    expect(walker.position.y).toBe(0);
  });
  it("climbs stairs rotated around Y", () => {
    const walker = setup([piece("stairs", "steep-stairs", [0, 2, 0], [0, 1, 0])]);
    walker.spawn(new Vector3(4, 0, 0));
    run(walker, 0.3, new Vector3(-1, 0, 0));
    expect(walker.position.x).toBeLessThan(0);
    expect(walker.position.y).toBeGreaterThanOrEqual(3);
  });
  it("finds clear support when a wall occupies the spawn point", () => {
    const walker = setup([piece("wall", "smooth-wall", [0, 4, 0])]);
    expect(walker.spawn(new Vector3(0, 30, 0))).toBe(true);
    expect(walker.canOccupy(walker.position)).toBe(true);
    expect(walker.position.y).toBeCloseTo(8, 8);
    expect(walker.grounded).toBe(true);
  });
  it("does not step through a low ceiling", () => {
    const walker = setup([
      piece("step", "smooth-wall", [0, 0.5, 0], [1, 0, 0]),
      piece("roof", "smooth-wall", [0, 6, 0], [1, 0, 0]),
    ]);
    walker.spawn(new Vector3(0, 0, 6));
    run(walker, 0.5, new Vector3(0, 0, -1));
    expect(walker.position.z).toBeGreaterThanOrEqual(4 + WALK_RADIUS - 0.001);
    expect(walker.position.y).toBe(0);
  });
  it("bounds tab-resume frame time and keeps falling without movement input", () => {
    const walker = setup(); walker.position.set(0, 20, 0);
    walker.update(60, new Vector3(1, 0, 0));
    expect(walker.position.x).toBeCloseTo(1.6, 5);
    expect(walker.position.y).toBeGreaterThan(18);
    run(walker, 1);
    expect(walker.position.y).toBe(0);
  });
  it("keeps the camera in front of walls and above ground", () => {
    const walker = setup([piece("wall", "smooth-wall", [0, 4, 0])]);
    const camera = walker.cameraPosition(new Vector3(0, 4.6, 5), new Vector3(0, 4.6, -10));
    expect(camera.z).toBeGreaterThan(0.5);
    const ground = walker.cameraPosition(new Vector3(10, 4.6, 5), new Vector3(10, -4, 5));
    expect(ground.y).toBeCloseTo(0.3, 4);
  });
});

it("keeps walking collision solid while blueprint overlaps are allowed", () => {
  const walker=setup([piece("wall","smooth-wall",[0,4,0])]);
  walker.world.allowOverlaps=true;
  expect(walker.spawn(new Vector3(0,0,4))).toBe(true);
  run(walker,.5,new Vector3(0,0,-1));
  expect(walker.position.z).toBeGreaterThanOrEqual(.5+WALK_RADIUS-.001);
  expect(walker.canOccupy(new Vector3(0,0,0))).toBe(false);
});
