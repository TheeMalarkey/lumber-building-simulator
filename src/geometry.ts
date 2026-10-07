import {logicParts} from "./logic-geometry";
import {logicAppearance} from "./logic-ports";
import {
  BoxGeometry,
  CylinderGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Shape,
  ExtrudeGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { type CatalogItem, ITEMS, stairTreadCount } from "./catalog";
import { applyPhysicalUVs, TEXTURE_TILE_STUDS } from "./texture-uv";
import { solidFromGeometry, type Solid } from "./solid";
import { lightFixtureParts } from "./light-fixtures";
import { furnitureParts } from "./furniture-geometry";
import {hatchParts} from './hatch-geometry';
const cache = new Map<string, BufferGeometry>();
const collisionCache = new Map<string, Solid[]>();
export function collisionPartsFor(id: string,active=false) {
  const key=id+(id==='lever'&&active?'|on':'');
  if (!collisionCache.has(key)) {
    if(key!==id)logicGeometryFor(id,true,1);else geometryFor(id);
  }
  return collisionCache.get(key)!;
}
export function geometryFor(id: string): BufferGeometry {
  if (cache.has(id)) return cache.get(id)!;
  const item = ITEMS.get(id)!;
  const g = buildGeometry(item);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  cache.set(id, g);
  return g;
}
const logicVisuals=new Map<string,BufferGeometry>();
export function logicGeometryFor(id:string,active:boolean,timing:number){
 const state=logicAppearance(id,active,timing),key=id+'|'+state.active+'|'+state.timing;if(!logicVisuals.has(key)){const g=buildGeometry(ITEMS.get(id)!,state);g.computeBoundingBox();g.computeBoundingSphere();logicVisuals.set(key,g);}return logicVisuals.get(key)!;
}
export function buildGeometry(item: CatalogItem,logicState?:{active:boolean;timing:number}): BufferGeometry {
  const [w, h, d] = item.size,
    parts: BufferGeometry[] = [];
  // Recipe coordinates use the bottom as y=0, then center for reusable transforms.
  const box = (
    sx: number,
    sy: number,
    sz: number,
    x = 0,
    y = sy / 2,
    z = 0,
    surface = 0,
  ) => {
    const g = new BoxGeometry(sx, sy, sz);
    // Wall and door grain stays upright even when a panel is wider than tall.
    applyPhysicalUVs(g, [sx, sy, sz], item.category === "Walls" || item.shape === "door" ? 1 : undefined);
    g.translate(x, y - h / 2, z);
    g.userData.surface = surface;
    parts.push(g);
  };
  // Fixed surfaces: 0 chosen wood, 1 black hardware, 2 metal, 3 basin.
  const cylinder = (radius: number, length: number, x: number, y: number, z: number,
    axis: "x" | "y" | "z", surface = 0) => {
    const segments = 16;
    const g = new CylinderGeometry(radius, radius, length, segments, 1);
    // Keep the cylinder's smooth side normals and flat cap normals. Unwrap
    // its polygon perimeter at physical scale; projecting smooth normals
    // would collapse the circumferential UV coordinate to zero.
    const uv = g.getAttribute("uv"), normal = g.getAttribute("normal"), p = g.getAttribute("position");
    const perimeter = 2 * radius * Math.sin(Math.PI / segments) * segments;
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(normal.getY(i)) > .9)
        uv.setXY(i, p.getX(i) / TEXTURE_TILE_STUDS, p.getZ(i) / TEXTURE_TILE_STUDS);
      else
        uv.setXY(i, uv.getY(i) * length / TEXTURE_TILE_STUDS, uv.getX(i) * perimeter / TEXTURE_TILE_STUDS);
    }
    if (axis === "x") g.rotateZ(Math.PI / 2);
    if (axis === "z") g.rotateX(Math.PI / 2);
    g.translate(x, y - h / 2, z);
    g.userData.surface = surface;
    parts.push(g);
  };
  const boardWall = (width: number, depth: number, x: number, z: number,
    offset: number, turn = false) => {
    // The reference has broad vertical boards with alternating face relief.
    const count = Math.round(width);
    for (let i = 0; i < count; i++) {
      const along = -width / 2 + (i + .5) * width / count;
      const stagger = (i % 2 ? 1 : -1) * offset / 2;
      box(turn ? depth - offset : width / count, h,
        turn ? width / count : depth - offset,
        x + (turn ? stagger : along), h / 2, z + (turn ? along : stagger));
    }
  };
  const cabinetFront = (width: number, x: number, z: number, turn = false) => {
    // Shallow rectangular door frames visible in the public cabinet previews.
    const panel = (sx: number, sy: number, px: number, py: number) =>
      box(turn ? .12 : sx, sy, turn ? sx : .12,
        turn ? x : x + px, py, turn ? z + px : z);
    panel(width, .16, 0, .24);
    panel(width, .16, 0, h - .14);
    for (const px of [-width / 2 + .08, width / 2 - .08])
      panel(.16, h - .4, px, h / 2);
  };
  switch (item.shape) {
    case "hatch": parts.push(...hatchParts());break;
    case "logic":
      parts.push(...logicParts(item,logicState));break;
    case "light-fixture":
      parts.push(...lightFixtureParts(item));
      break;
    case "store-furniture":
      parts.push(...furnitureParts(item));
      break;
    case "box":
      box(w, h, d);
      break;
    case "corner":
      box(w, h, 1, 0, h / 2, -d / 2 + 0.5);
      box(1, h, d - 1, -w / 2 + 0.5, h / 2, 0.5);
      break;
    case "corrugated":
      boardWall(w, d, 0, 0, .12);
      break;
    case "corrugated-corner":
      boardWall(w, 1, 0, -d / 2 + .5, .12);
      // Continue to the recessed first board, rather than leaving a .12 gap.
      boardWall(d - 1 + .12, 1, -w / 2 + .5, .5 - .06, .12, true);
      break;
    case "fence":
      boardWall(w, d, 0, 0, .5);
      break;
    case "fence-corner":
      // The corner reference has thin continuous returns and a broad opening.
      // Staggering the two arms independently left them disconnected.
      box(w, h, .5, 0, h / 2, -d / 2 + .25);
      box(.5, h, d - .5, -w / 2 + .25, h / 2, .25);
      break;
    case "wedge": {
      const shape = new Shape();
      shape.moveTo(-d / 2, -h / 2);
      shape.lineTo(d / 2, -h / 2);
      shape.lineTo(d / 2, h / 2);
      shape.closePath();
      const g = new ExtrudeGeometry(shape, {
        depth: w,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });
      // Local shape x maps to z, extrusion to x; slope rises toward -z.
      const a = g.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i),
          y = a.getY(i),
          z = a.getZ(i);
        a.setXYZ(i, z - w / 2, y, -x);
      }
      g.computeVertexNormals();
      applyPhysicalUVs(g, item.size);
      parts.push(g);
      break;
    }
    case "stairs": {
      const n = stairTreadCount(item);
      for (let i = 0; i < n; i++)
        box(
          w,
          (h * (i + 1)) / n,
          d / n,
          0,
          (h * (i + 1)) / n / 2,
          d / 2 - ((i + 0.5) * d) / n,
        );
      break;
    }
    case "glass-door":
      box(w,h,d);
      for(const side of [-1,1]) cylinder(.3,.25,-w/2+.5,h/2,side*.225,"z",1);
      break;
    case "door":
      box(w, h, .5, 0, h / 2, 0);
      // Thumbnail-derived proportions: half/basic knobs near three studs,
      // wide door centered. Fine hardware measurements remain estimates.
      for (const side of [-1, 1])
        cylinder(.35, .25, -w / 2 + .5, item.id === "fat-door" ? 4 : 3, side * .375, "z", 1);
      break;
    case "ladder":
      box(.5, h, d, -w / 2 + .25);
      box(.5, h, d, w / 2 - .25);
      for (let i = 0; i < 5; i++)
        cylinder(.25, w - 1, 0, .5 + i * .75, 0, "x");
      break;
    case "chair":
      box(w, .5, d, 0, 2.25);
      for (const x of [-w / 2 + .25, w / 2 - .25])
        for (const z of [-d / 2 + .25, d / 2 - .25])
          box(.5, 2, .5, x, 1, z);
      box(w, h - 2.5, .5, 0, (h + 2.5) / 2, -d / 2 + .25);
      break;
    case "table":
      box(w, .5, d, 0, h - .25);
      for (const x of [-w / 2 + .25, w / 2 - .25])
        for (const z of [-d / 2 + .25, d / 2 - .25])
          box(.5, h - .5, .5, x, (h - .5) / 2, z);
      break;
    case "cabinet":
      box(w, .2, d);
      for (const x of [-w / 2 + .1, w / 2 - .1]) box(.2, h, d, x);
      box(w - .4, h, .2, 0, h / 2, -d / 2 + .1);
      box(w - .4, h - .1, .12, 0, (h - .1) / 2, d / 2 - .16);
      if (d === 4) box(.15, h - .1, d - .4, 0, (h - .1) / 2);
      for (const x of [-w / 4, w / 4]) cabinetFront(w / 2 - .1, x, d / 2 - .06);
      break;
    case "cabinet-corner":
      if (w === 4) {
        // The small corner is a square open carcass, without a diagonal cut.
        box(w, .2, d);
        for (const x of [-w / 2 + .1, w / 2 - .1]) box(.2, h, d, x);
        for (const z of [-d / 2 + .1, d / 2 - .1]) box(w - .4, h, .2, 0, h / 2, z);
      } else {
        // Six-stud L: a two-by-two notch at +X/+Z, open bins and inside doors.
        box(w, .2, 4, 0, .1, -1);
        box(4, .2, 2, -1, .1, 2);
        box(.2, h, d, -2.9);
        box(w - .2, h, .2, .1, h / 2, -2.9);
        box(.2, h, 4, 2.9, h / 2, -1);
        box(4, h, .2, -1, h / 2, 2.9);
        box(.2, h, 2, .9, h / 2, 2);
        box(2, h, .2, 2, h / 2, .9);
        box(.15, h - .1, 3.8, -.95, (h - .1) / 2, -1);
        box(3.8, h - .1, .15, -1, (h - .1) / 2, -.95);
        cabinetFront(1.8, 1, 2, true);
        cabinetFront(1.8, 2, 1);
      }
      break;
    case "sink": {
      // Counter surround remains the chosen wood. A catalog marble preview
      // alone does not establish the finish of the completed wood structure.
      box(w, .4, .65, 0, .3, -d / 2 + .325);
      box(w, .4, .65, 0, .3, d / 2 - .325);
      box(.75, .4, 2.7, -w / 2 + .375, .3);
      box(.75, .4, 2.7, w / 2 - .375, .3);
      box(1.7, .08, 1.9, 0, .04, 0, 3);
      const rings = [[1.25,1.35,.5],[1.03,1.13,.2],[.85,.95,.08]];
      const vertices: number[] = [];
      for (let i = 0; i < rings.length - 1; i++) {
        const [x,z,y]=rings[i], [bx,bz,by]=rings[i+1];
        const top=[[-x,y,-z],[x,y,-z],[x,y,z],[-x,y,z]];
        const bottom=[[-bx,by,-bz],[bx,by,-bz],[bx,by,bz],[-bx,by,bz]];
        for(let j=0;j<4;j++) {
          const k=(j+1)%4;
          for(const v of [top[k],top[j],bottom[j],top[k],bottom[j],bottom[k]])
            vertices.push(v[0],v[1]-h/2,v[2]);
        }
      }
      const basin = new BufferGeometry();
      basin.setAttribute("position",new Float32BufferAttribute(vertices,3));
      basin.computeVertexNormals(); applyPhysicalUVs(basin,[2.5,.5,2.7]);
      basin.userData.surface=3; basin.userData.collisionShell=true; parts.push(basin);
      cylinder(.13,.025,0,.093,0,"y",1);
      cylinder(.16,.45,0,.725,-1.6,"y",2);
      box(.24,.12,.95,0,.94,-1.25,2);
      for(const x of [-.65,.65]) {
        cylinder(.2,.08,x,.54,-1.6,"y",2);
        box(.13,.17,.26,x,.665,-1.6,2);
      }
      break;
    }
  }

  // Consolidate components by surface: one instanced draw per surface per
  // item/wood/chunk, never a separate mesh or material per placed component.
  if(!logicState||item.id==='lever')collisionCache.set(item.id+(logicState?.active?'|on':''), parts.flatMap(g => (g.userData.collisionSolids ?? solidFromGeometry(g)).map((s:Solid)=>({...s,doorFixed:g.userData.doorFixed===true}))));
  const surfaces = [...new Set(parts.map(g => g.userData.surface ?? 0))].sort();
  const ordered = surfaces.flatMap(surface => parts.filter(g => (g.userData.surface ?? 0) === surface));
  const flat = ordered.map(g => g.index ? g.toNonIndexed() : g);
  const merged = mergeGeometries(flat);
  if (!merged) throw new Error(`Geometry failed: ${item.id}`);
  let start = 0;
  for (const surface of surfaces) {
    let count = 0;
    ordered.forEach((g, i) => { if ((g.userData.surface ?? 0) === surface) count += flat[i].getAttribute("position").count; });
    merged.addGroup(start, count, surface);
    start += count;
  }
  for (const g of new Set([...parts, ...flat])) g.dispose();
  // Faceted geometry is deliberate; avoid smooth normals across box edges.
  if (!merged.getAttribute("uv"))
    merged.setAttribute(
      "uv",
      new Float32BufferAttribute(
        new Float32Array(merged.getAttribute("position").count * 2),
        2,
      ),
    );
  return merged;
}
