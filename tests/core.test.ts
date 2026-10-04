import { describe, it, expect } from "vitest";
import { CATALOG } from "../src/catalog";
import { World } from "../src/world";
import { snapOnSurface, rotatedSize, turnRotation, quaternionRotation } from "../src/placement";
import { parseProject } from "../src/project";
import type { Piece } from "../src/world";
import { geometryFor } from "../src/geometry";
import { Vector3 } from "three";
const piece = (id = "a"): Piece => ({
  id,
  item: "smooth-wall",
  wood: "oak",
  position: [0, 4, 0],
  rotation: [0, 0, 0],
});
describe("catalog", () => {
  it("covers the 69 individually listed obtainable blueprints without duplicate ids", () => {
    expect(CATALOG.filter(p=>!p.fixedMaterial)).toHaveLength(69);
    expect(CATALOG).toHaveLength(74);
    expect(new Set(CATALOG.map((x) => x.id)).size).toBe(74);
  });
  it("preserves thin tile dimensions", () =>
    expect(CATALOG.find((x) => x.id === "tiny-tile")?.size).toEqual([
      1, 0.2, 1,
    ]));
  it("every geometry fits its reference footprint and has finite vertices", () => {
    for (const c of CATALOG) {
      const g = geometryFor(c.id);
      const s = g.boundingBox!.getSize(new Vector3()).toArray();
      for (let i = 0; i < 3; i++) {
        expect(s[i], `${c.id} axis ${i}`).toBeLessThanOrEqual(
          (c.boundsSize ?? c.size)[i] + 0.001,
        );
        expect(s[i]).toBeGreaterThan(0);
      }
      expect([...g.getAttribute("position").array].every(Number.isFinite)).toBe(
        true,
      );
    }
  });
});
describe("placement", () => {
  it("tilts a rotated blueprint sideways instead of reusing its local pitch", () => {
    const facingEast = turnRotation([0, 0, 0], 1);
    const sideways = turnRotation(facingEast, 0);
    expect(rotatedSize([2, 4, 6], sideways)).toEqual([6, 2, 4]);
    const forward = new Vector3(0, 0, 1).applyEuler(quaternionRotation(sideways));
    expect(forward.x).toBeCloseTo(1);
    expect(forward.y).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(0);
    expect(rotatedSize([2, 4, 6], turnRotation(turnRotation([0, 0, 0], 0), 1))).toEqual([4, 6, 2]);
  });
  it("reaches all 24 orientations and four repeated turns restore the same pose", () => {
    const queue: [number, number, number][] = [[0, 0, 0]];
    const seen = new Set(["0,0,0"]);
    for (let i = 0; i < queue.length; i++) for (const axis of [0, 1]) {
      const next = turnRotation(queue[i], axis), key = next.join(",");
      if (!seen.has(key)) { seen.add(key); queue.push(next); }
      let cycle = queue[i];
      for (let j = 0; j < 4; j++) cycle = turnRotation(cycle, axis);
      expect(rotatedSize([2, 4, 6], cycle)).toEqual(rotatedSize([2, 4, 6], queue[i]));
      const a = new Vector3(1, 2, 3).applyEuler(quaternionRotation(cycle));
      const b = new Vector3(1, 2, 3).applyEuler(quaternionRotation(queue[i]));
      expect(a.distanceTo(b)).toBeLessThan(1e-8);
    }
    expect(seen.size).toBe(24);
  });
  it("fits one-stud pieces inside floor-grid cells instead of across their lines", () => {
    expect(snapOnSurface([0.26, 0, 0.26], [0, 1, 0], [1, 0.2, 1], 1)).toEqual([
      0.5, 0.1, 0.5,
    ]);
    expect(snapOnSurface([-0.26, 0, -0.26], [0, 1, 0], [1, 1, 1], 1)).toEqual([
      -0.5, 0.5, -0.5,
    ]);
  });
  it("aligns catalog footprint edges to the grid across rotations and distant coordinates", () => {
    for (const item of CATALOG) {
      for (const rotation of [
        [0, 0, 0],
        [0, 1, 0],
        [1, 0, 0],
      ] as [number, number, number][]) {
        const size = rotatedSize(item.size, rotation);
        for (const x of [0.26, -2.76, 4096.26, -4096.76]) {
          const position = snapOnSurface([x, 8, x], [0, 1, 0], size, 1);
          for (const axis of [0, 2]) {
            const edge = position[axis] - size[axis] / 2;
            expect(edge, `${item.id} axis ${axis}`).toBeCloseTo(
              Math.round(edge),
              6,
            );
          }
          expect(position[1] - size[1] / 2).toBeCloseTo(8, 6);
        }
      }
    }
  });
  it("places thin tiles flush on a raised surface without rounding the height", () =>
    expect(snapOnSurface([1.26, 8, 2.26], [0, 1, 0], [4, 0.2, 4], 0.5)).toEqual(
      [1.5, 8.1, 2.5],
    ));
  it("preserves negative face support and half-width alignment", () =>
    expect(snapOnSurface([4, 3.2, -2], [1, 0, 0], [1, 8, 4], 1)).toEqual([
      4.5, 3, -2,
    ]));
  it("swaps vertical bounds when tilted", () =>
    expect(rotatedSize([4, 8, 1], [1, 0, 0])).toEqual([4, 1, 8]));
  it("keeps a box above an oblique support plane", () =>
    expect(
      snapOnSurface([0, 0, 0], [0, Math.SQRT1_2, Math.SQRT1_2], [2, 2, 2], 1),
    ).toEqual([0, 2, 0]));
});
describe("world and history", () => {
  it("keeps stable ids after middle deletion and restores by undo", () => {
    const w = new World();
    w.execute([
      { before: null, after: piece("a") },
      { before: null, after: piece("b") },
      { before: null, after: piece("c") },
    ]);
    w.execute([{ before: w.pieces.get("b")!, after: null }]);
    expect([...w.pieces.keys()]).toEqual(["a", "c"]);
    w.undo();
    expect(w.pieces.get("b")).toEqual(piece("b"));
    w.redo();
    expect(w.pieces.has("b")).toBe(false);
  });
  it("invalidates redo on a new edit and restores move positions", () => {
    const w = new World();
    w.execute([{ before: null, after: piece() }]);
    w.execute([
      { before: piece(), after: { ...piece(), position: [100, 4, 0] } },
    ]);
    w.undo();
    expect(w.pieces.get("a")?.position).toEqual([0, 4, 0]);
    w.execute([{ before: null, after: piece("b") }]);
    expect(w.canRedo).toBe(false);
  });
  it("queries pieces spanning negative chunk boundaries", () => {
    const w = new World();
    w.execute([{ before: null, after: { ...piece(), position: [-64, 4, 0] } }]);
    expect(w.query([-65, 4, 0], 2).map((p) => p.id)).toContain("a");
  });
  it("notifies UI only after undo and redo availability changes", () => {
    const w = new World(),
      states: boolean[][] = [];
    w.onChange = () => states.push([w.canUndo, w.canRedo]);
    w.execute([{ before: null, after: piece() }]);
    w.undo();
    w.redo();
    expect(states).toEqual([
      [true, false],
      [false, true],
      [true, false],
    ]);
  });
});
describe("ray broad phase", () => {
  it("visits ray cells and orders only intersected footprints", () => {
    const w = new World();
    w.load([
      piece("near"),
      { ...piece("far"), position: [0, -10, 0] },
      { ...piece("miss"), position: [20, 4, 0] },
    ]);
    expect(
      w
        .rayCandidates([0, 20, 0], [0, -1, 0], 100)
        .map((x) => [x.piece.id, x.distance]),
    ).toEqual([
      ["near", 12],
      ["far", 26],
    ]);
  });
  it("finds boundary-spanning pieces in negative cells and respects range", () => {
    const w = new World();
    w.load([{ ...piece("edge"), position: [-64, 4, 0] }]);
    expect(w.rayCandidates([-70, 4, 0], [1, 0, 0], 3)).toEqual([]);
    expect(
      w.rayCandidates([-70, 4, 0], [1, 0, 0], 10).map((x) => x.piece.id),
    ).toEqual(["edge"]);
    w.execute([{ before: w.pieces.get("edge")!, after: null }]);
    expect(w.rayCandidates([-70, 4, 0], [1, 0, 0], 10)).toEqual([]);
    expect(w.chunks.size).toBe(0);
  });
});
describe("collision checks", () => {
  it("allows blueprint intersections only while the overlap option is enabled", () => {
    const w=new World();w.load([piece("a")],[12]);
    expect(w).toHaveProperty("allowOverlaps",false);
    expect(w.placementIssue(piece("new"))).toBe("overlap");
    w.allowOverlaps=true;
    expect(w.canPlace(piece("new"))).toBe(true);
    w.execute([{before:null,after:piece("new")}]);
    w.allowOverlaps=false;
    expect(w.pieces.size).toBe(2);
    expect(w.placementIssue(piece("another"))).toBe("overlap");
    w.undo();expect(w.pieces.size).toBe(1);
  });
  it("keeps ground and active-land checks enabled when overlaps are allowed", () => {
    const w=new World();w.load([piece("a")],[12]);
    w.allowOverlaps=true;
    expect(w.placementIssue({...piece("new"),position:[0,3,0]})).toBe("below-ground");
    expect(w.placementIssue({...piece("new"),position:[20,4,0]})).toBe("outside-plots");
  });
  it("rejects fully and partly underground pieces even when their centers are above ground", () => {
    const w = new World();
    expect(w.canPlace({ ...piece(), position: [0, -5, 0] })).toBe(false);
    expect(w.canPlace({ ...piece(), position: [0, 3, 0] })).toBe(false);
    expect(w.canPlace({ ...piece(), position: [0, 4, 0] })).toBe(true);
    w.load([piece()]);
    expect(w.canPlace({ ...piece(), position: [0, 3, 0] }, "a")).toBe(false);
  });
  it("allows ground contact but rejects penetration for every catalog footprint and tilt", () => {
    const w = new World();
    for (const item of CATALOG) {
      for (const rotation of [
        [0, 0, 0],
        [1, 0, 0],
        [0, 0, 1],
      ] as [number, number, number][]) {
        const height = rotatedSize(item.boundsSize ?? item.size, rotation)[1];
        const p: Piece = {
          ...piece(),
          item: item.id,
          rotation,
          position: [-64, height / 2, -64],
        };
        expect(w.canPlace(p), item.id).toBe(true);
        p.position[1] -= 0.0001;
        expect(w.canPlace(p), item.id).toBe(false);
      }
    }
  });
  it("rejects full and partial overlap but allows touching and stacking", () => {
    const w = new World();
    w.load([piece("existing")]);
    expect(w.canPlace(piece("new"))).toBe(false);
    expect(w.canPlace({ ...piece("new"), position: [3.5, 4, 0] })).toBe(false);
    expect(w.canPlace({ ...piece("new"), position: [4, 4, 0] })).toBe(true);
    expect(w.canPlace({ ...piece("new"), position: [0, 12, 0] })).toBe(true);
  });
  it("ignores only the moved piece and checks rotated extents", () => {
    const w = new World();
    w.load([piece("moving"), { ...piece("blocker"), position: [0, 4, 2] }]);
    expect(w.canPlace(piece("moving"), "moving")).toBe(true);
    expect(
      w.canPlace({ ...piece("moving"), rotation: [0, 1, 0] }, "moving"),
    ).toBe(false);
    expect(
      w.canPlace({ ...piece("moving"), position: [0, 4, 2] }, "moving"),
    ).toBe(false);
  });
  it("checks thin pieces across negative chunk boundaries", () => {
    const w = new World();
    w.load([{ ...piece("tile"), item: "large-tile", position: [-64, 0.1, 0] }]);
    expect(
      w.canPlace({
        ...piece("new"),
        item: "tiny-tile",
        position: [-65, 0.15, 0],
      }),
    ).toBe(false);
    expect(
      w.canPlace({
        ...piece("new"),
        item: "tiny-tile",
        position: [-65, 0.3, 0],
      }),
    ).toBe(true);
  });
});
describe("project files", () => {
  it("round trips exact transforms", () => {
    const p = { version: 1, name: "Cabin", pieces: [piece()], plots: [12] };
    expect(parseProject(JSON.stringify(p))).toEqual(p);
  });
  it.each([
    { version: 99, name: "x", pieces: [] },
    { version: 1, name: "x", pieces: [{ ...piece(), item: "missing" }] },
    { version: 1, name: "x", pieces: [piece(), piece()] },
    { version: 1, name: "x", pieces: [{ ...piece(), position: [0, null, 0] }] },
  ])("rejects unsupported or malformed data", (p) =>
    expect(() => parseProject(JSON.stringify(p))).toThrow(),
  );
});
