import {validateWires,type Wire} from "./logic-ports";
import { ITEMS, WOOD_MAP } from "./catalog";
import { pieceBounds, type Piece } from "./world";
import { coveredByPlots, inferPlots, validatePlots } from "./plots";
import {Vector3} from 'three';
import {quaternionRotation} from './placement';
import {originalLeverBounds} from './logic-model-compat';
import {isDoor} from './door-design';
export interface Project {
  version: 1;
  name: string;
  pieces: Piece[];
  plots?: number[];
  wires?: Wire[];
  logicModelVersion?: 2 | 3;
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
  if(v.logicModelVersion!==undefined&&v.logicModelVersion!==2&&v.logicModelVersion!==3)throw new Error('Unsupported logic model version.');
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
    if(p.logicOn!==undefined && typeof p.logicOn!=='boolean')throw new Error('Invalid switch state.');
    if(p.doorOpen!==undefined && (typeof p.doorOpen!=='boolean'||!isDoor(p.item)))throw new Error('Invalid door state.');
    if(p.timing!==undefined && (!Number.isInteger(p.timing)||p.timing<1||p.timing>12))throw new Error('Invalid timer setting.');
    if(p.legacyLeverBounds!==undefined&&(p.item!=='lever'||p.legacyLeverBounds!==true))throw new Error('Invalid legacy lever placement.');
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
  // Preserve mounting planes and sockets when older lever/timer heights shrink,
  // including rotated mounts. Version 2 already has the corrected lever.
  const pieces=v.pieces.map(p=>{
    const oldHeight=p.item==='lever'&&v.logicModelVersion===undefined?2:
      (p.item==='signal-delay'||p.item==='signal-sustain')&&v.logicModelVersion!==3?2.5:null;
    if(oldHeight===null)return p;
    const offset=new Vector3(0,(ITEMS.get(p.item)!.size[1]-oldHeight)/2,0).applyEuler(quaternionRotation(p.rotation));
    return {...p,position:new Vector3(...p.position).add(offset).toArray() as Piece['position']};
  });
  const plots = v.plots === undefined ? inferPlots(pieces.map(pieceBounds)) : validatePlots(v.plots);
  const retainedLegacy=new Set<string>();
  for(const p of pieces)if(!coveredByPlots(pieceBounds(p),plots)){
    if(p.item==='lever'&&(v.logicModelVersion===undefined||p.legacyLeverBounds===true)&&coveredByPlots(originalLeverBounds(p),plots))retainedLegacy.add(p.id);
    else throw new Error("Blueprints must stay inside the project's active plots.");
  }
  return {
    version: 1,
    name: v.name,
    plots,
    ...(pieces.some(p=>['lever','signal-delay','signal-sustain'].includes(p.item))?{logicModelVersion:3 as const}:{}),
    ...(v.wires===undefined?{}:{wires:validateWires(v.wires,v.pieces)}),
    pieces: pieces.map((p) => ({
      id: p.id,
      item: p.item,
      wood: p.wood,
      position: [...p.position],
      rotation: [...p.rotation],
      ...(p.logicOn===undefined?{}:{logicOn:p.logicOn}),
      ...(p.doorOpen===undefined?{}:{doorOpen:p.doorOpen}),
      ...(p.timing===undefined?{}:{timing:p.timing}),
      ...(retainedLegacy.has(p.id)?{legacyLeverBounds:true as const}:{}),
      ...(p.lightOn === undefined ? {} : {lightOn:p.lightOn}),
    })),
  };
}
