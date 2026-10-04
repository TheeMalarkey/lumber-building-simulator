import type { Vec3 } from "./catalog";
export const PLOT_SIZE = 40;
export const CENTER_PLOT = 12;
export const GRASS_HEIGHT = -0.1;
export function landHeight(x: number, z: number, plots: readonly number[] | null) {
  if (plots === null) return 0;
  const col = Math.floor((x + 100) / 40), row = Math.floor((z + 100) / 40);
  return col >= 0 && col < 5 && row >= 0 && row < 5 && plots.includes(row * 5 + col) ? 0 : GRASS_HEIGHT;
}
export const ALL_PLOTS = Array.from({ length: 25 }, (_, i) => i);
export type Footprint = { min: Vec3; max: Vec3 };
export const plotCenter = (id: number): [number, number] => [(id % 5 - 2) * PLOT_SIZE, (Math.floor(id / 5) - 2) * PLOT_SIZE];
export function connectedPlots(plots: readonly number[]) {
  if (!plots.includes(CENTER_PLOT)) return false;
  const visited = new Set([CENTER_PLOT]), queue = [CENTER_PLOT];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of plots) {
      if (!visited.has(next) && Math.abs(next % 5 - id % 5) + Math.abs(Math.floor(next / 5) - Math.floor(id / 5)) === 1) {
        visited.add(next); queue.push(next);
      }
    }
  }
  return visited.size === plots.length;
}
export function validatePlots(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 25 || value.some(id => !Number.isInteger(id) || id < 0 || id >= 25) || new Set(value).size !== value.length || !connectedPlots(value))
    throw new Error("Invalid plot layout: land must connect by edges to the center plot.");
  return [...value].sort((a, b) => a - b);
}
export function touchesPlot(bounds: Footprint, id: number) {
  const [x, z] = plotCenter(id);
  return bounds.max[0] > x - 20 + 1e-8 && bounds.min[0] < x + 20 - 1e-8 &&
    bounds.max[2] > z - 20 + 1e-8 && bounds.min[2] < z + 20 - 1e-8;
}
export function coveredByPlots(bounds: Footprint, plots: readonly number[]) {
  if (bounds.min[0] < -100 - 1e-8 || bounds.max[0] > 100 + 1e-8 || bounds.min[2] < -100 - 1e-8 || bounds.max[2] > 100 + 1e-8) return false;
  return ALL_PLOTS.every(id => !touchesPlot(bounds, id) || plots.includes(id));
}
export function inferPlots(bounds: Iterable<Footprint>) {
  const plots = new Set([CENTER_PLOT]);
  for (const box of bounds) for (const id of ALL_PLOTS) if (touchesPlot(box, id)) {
    let x = 2, z = 2;
    while (x !== id % 5) { x += Math.sign(id % 5 - x); plots.add(z * 5 + x); }
    while (z !== Math.floor(id / 5)) { z += Math.sign(Math.floor(id / 5) - z); plots.add(z * 5 + x); }
  }
  return [...plots].sort((a, b) => a - b);
}
