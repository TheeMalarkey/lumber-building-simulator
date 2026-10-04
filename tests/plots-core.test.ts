import { expect, it } from "vitest";
import { World, pieceBounds, type Piece } from "../src/world";
import { createDemo } from "../src/demo";
import { coveredByPlots } from "../src/plots";
import { parseProject } from "../src/project";
const piece = (x: number, z = 0): Piece => ({ id: "p", item: "large-floor", wood: "oak", position: [x, .5, z], rotation: [0, 0, 0] });
const setup = () => { const w = new World(); w.load([], [12]); return w; };
it("keeps the entire starter studio on its single center plot", () => {
  expect(createDemo().filter(p => !coveredByPlots(pieceBounds(p), [12]))).toEqual([]);
});

it("starts at center, permits edge expansion, and rejects diagonal or disconnected land", () => {
  const w = setup();
  expect(w.togglePlot(18)).toBe("disconnected");
  expect(w.togglePlot(13)).toBe(null);
  expect(w.togglePlot(14)).toBe(null);
  expect(w.togglePlot(13)).toBe("disconnected");
  expect(w.togglePlot(12)).toBe("center");
  expect(w.togglePlot(25)).toBe("invalid");
});
it("checks the entire rotated footprint and accepts shared plot seams", () => {
  const w = setup();
  expect(w.canPlace(piece(16))).toBe(true);
  expect(w.placementIssue(piece(16.001))).toBe("outside-plots");
  w.togglePlot(13);
  expect(w.canPlace(piece(20))).toBe(true);
  expect(w.canPlace(piece(100))).toBe(false);
  const long = { ...piece(18), item: "post", position: [18, 2, 0] as [number, number, number] };
  w.togglePlot(13);
  expect(w.canPlace(long)).toBe(true);
  expect(w.canPlace({ ...long, rotation: [0, 0, 1] })).toBe(true);
  expect(w.canPlace({ ...long, position: [19, 2, 0], rotation: [0, 0, 1] })).toBe(false);
});
it("rejects a footprint crossing an inactive interior hole", () => {
  const w = setup();
  w.load([], [12, 7, 8, 9, 14, 19, 18, 17]);
  expect(w.canPlace(piece(40, 0))).toBe(false);
  expect(w.canPlace(piece(20, 0))).toBe(false);
});
it("protects occupied land and interleaves plot and blueprint undo/redo", () => {
  const w = setup(); w.togglePlot(13);
  const p = piece(40); w.execute([{ before: null, after: p }]);
  expect(w.togglePlot(13)).toBe("occupied");
  w.undo(); expect(w.pieces.size).toBe(0);
  w.undo(); expect(w.plots).toEqual([12]);
  w.redo(); expect(w.plots).toEqual([12, 13]);
  w.redo(); expect(w.canPlace(p, p.id)).toBe(true);
});
it("validates saved land and migrates legacy builds without moving pieces", () => {
  const base = { version: 1, name: "land", pieces: [] };
  for (const plots of [[], [0], [12, 0], [12, 12], [12, 25], [12, "13"]])
    expect(() => parseProject(JSON.stringify({ ...base, plots }))).toThrow(/plot/i);
  expect(parseProject(JSON.stringify(base)).plots).toEqual([12]);
  expect(() => parseProject(JSON.stringify({ ...base, plots: [12], pieces: [piece(80)] }))).toThrow(/active plots/i);
  const p = piece(80);
  const old = parseProject(JSON.stringify({ ...base, pieces: [p] }));
  expect(old.plots).toEqual([12, 13, 14]);
  expect(old.pieces).toEqual([p]);
});
