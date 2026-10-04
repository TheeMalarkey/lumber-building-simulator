import type { Piece } from "./world";
import type { Vec3 } from "./catalog";
export function createDemo(): Piece[] {
  const pieces: Piece[] = [];
  const add = (
    item: string,
    wood: string,
    position: Vec3,
    rotation: Vec3 = [0, 0, 0],
  ) =>
    pieces.push({
      id: `demo-${pieces.length}`,
      item,
      wood,
      position,
      rotation,
    });
  // A small studio cabin, entirely built from catalog pieces, is editable like any project.
  for (let x = -8; x <= 8; x += 8)
    for (let z = -8; z <= 8; z += 8) add("large-floor", "walnut", [x, 0.5, z]);
  for (let x = -8; x <= 8; x += 8)
    for (let z = -8; z <= 0; z += 8) add("large-tile", "fir", [x, 1.1, z]);
  // Back wall and two side walls. Low sills and lintels form open windows.
  for (let x = -10; x <= 10; x += 4) add("smooth-wall", "elm", [x, 5, -11.5]);
  for (const x of [-11.5, 11.5]) {
    for (let z = -8; z <= 0; z += 4) {
      if (z === -4) {
        add("short-smooth-wall", "elm", [x, 3, z], [0, 1, 0]);
        add("smooth-wall-stub", "elm", [x, 8, z], [0, 1, 0]);
      } else add("smooth-wall", "elm", [x, 5, z], [0, 1, 0]);
    }
  }
  for (const x of [-10, 10]) add("smooth-wall", "elm", [x, 5, 3.5]);
  for (const x of [-6, 6]) {
    add("short-smooth-wall", "elm", [x, 3, 3.5]);
    add("smooth-wall-stub", "elm", [x, 8, 3.5]);
  }
  add("basic-door", "walnut", [-2, 5, 3.5]);
  add("smooth-wall", "elm", [2, 5, 3.5]);
  // Exposed corner beams and lintels.
  for (const x of [-11.57, 11.57])
    for (const z of [-11.57, 3.57])
      for (const y of [3, 7]) add("post", "walnut", [x, y, z]);
  for (let x = -10; x <= 10; x += 4) {
    add("post", "walnut", [x, 9.5, 3.5], [0, 0, 1]);
    add("post", "walnut", [x, 9.5, -11.5], [0, 0, 1]);
  }
  // Stepped gabled roof, with shallow wedges creating the two pitches.
  for (let x = -10; x <= 10; x += 4)
    for (let z = -10; z <= 2; z += 4) {
      const rear = z < -4;
      const y = rear ? (z === -10 ? 10 : 12) : z === 2 ? 10 : 12;
      add("2-4-wedge", "walnut", [x, y, z], rear ? [0, 2, 0] : [0, 0, 0]);
    }
  // Porch and a slim pergola.
  for (const x of [-11.5, 11.5])
    for (const y of [3, 7]) add("post", "walnut", [x, y, 11.5]);
  for (let x = -10; x <= 10; x += 4)
    add("post", "walnut", [x, 9, 11.5], [0, 0, 1]);
  for (let x = -10; x <= 10; x += 4)
    for (const z of [5.5, 9.5]) add("post", "fir", [x, 9.5, z], [1, 0, 0]);
  for (const x of [-11.5, 11.5])
    for (const z of [6, 10]) add("short-fence", "walnut", [x, 3, z], [0, 1, 0]);
  for (const x of [-10, -6, 6, 10]) add("short-fence", "walnut", [x, 3, 11.5]);
  add("stairs", "walnut", [0, 1, 13.5]);
  for (const x of [-4, 0, 4]) add("tile", "birch", [x, 0.1, 17]);
  add("square-table", "oak", [6, 3, 7.5]);
  add("mundane-chair", "birch", [6, 3.5, 10.5]);
  add("mundane-chair", "birch", [9, 3.5, 7.5], [0, 1, 0]);
  add("kitchen-cabinet", "birch", [-7, 2.2, -8.5]);
  add("kitchen-cabinet", "birch", [-3, 2.2, -8.5]);
  add("countertop", "walnut", [-7, 3.6, -8.5]);
  add("countertop-with-sink", "birch", [-3, 3.9, -8.5]);
  return pieces;
}
export function createBenchmark(count: number, mixed = false): Piece[] {
  const pieces: Piece[] = [];
  const ids = ["smooth-wall", "floor", "4-4-wedge", "short-fence", "post"];
  const woods = ["oak", "walnut", "birch", "elm", "cherry"];
  const width = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++)
    pieces.push({
      id: `bench-${i}`,
      item: mixed ? ids[i % ids.length] : "smooth-wall",
      wood: mixed ? woods[Math.floor(i / 7) % woods.length] : "oak",
      position: [(i % width) * 5, 4, Math.floor(i / width) * 5],
      rotation: [0, i % 4, 0],
    });
  return pieces;
}
