import { ITEMS, WOOD_MAP } from "./catalog";
import { pieceBounds, type Piece } from "./world";
import { coveredByPlots, inferPlots, validatePlots } from "./plots";
export interface Project {
  version: 1;
  name: string;
  pieces: Piece[];
  plots?: number[];
}
export function parseProject(text: string): Project {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This is not a readable Timber project file.");
  }
  if (!value || typeof value !== "object")
    throw new Error("Missing project data.");
  const v = value as Project;
  if (v.version !== 1) throw new Error("Unsupported project version.");
  if (
    typeof v.name !== "string" ||
    v.name.length > 120 ||
    !Array.isArray(v.pieces)
  )
    throw new Error("Invalid project name or pieces.");
  const ids = new Set<string>();
  for (const p of v.pieces) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      p.id.length > 100 ||
      ids.has(p.id) ||
      !ITEMS.has(p.item) ||
      !WOOD_MAP.has(p.wood)
    )
      throw new Error("Invalid, duplicate, or unknown piece in project.");
    if(p.lightOn !== undefined && typeof p.lightOn !== 'boolean') throw new Error('Invalid light state.');
    ids.add(p.id);
    if (
      !Array.isArray(p.position) ||
      p.position.length !== 3 ||
      !p.position.every(
        (n) =>
          typeof n === "number" &&
          Number.isFinite(n) &&
          Math.abs(n) <= Number.MAX_SAFE_INTEGER / 10000,
      )
    )
      throw new Error("Invalid piece position.");
    if (
      !Array.isArray(p.rotation) ||
      p.rotation.length !== 3 ||
      !p.rotation.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 4)
    )
      throw new Error("Invalid piece rotation.");
  }
  const plots = v.plots === undefined ? inferPlots(v.pieces.map(pieceBounds)) : validatePlots(v.plots);
  if (v.pieces.some(p => !coveredByPlots(pieceBounds(p), plots)))
    throw new Error("Blueprints must stay inside the project's active plots.");
  return {
    version: 1,
    name: v.name,
    plots,
    pieces: v.pieces.map((p) => ({
      id: p.id,
      item: p.item,
      wood: p.wood,
      position: [...p.position],
      rotation: [...p.rotation],
      ...(p.lightOn === undefined ? {} : {lightOn:p.lightOn}),
    })),
  };
}
