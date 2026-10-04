import {
  RepeatWrapping,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from "three";
import { WOODS } from "./catalog";

// Original pre-2022 Roblox maps, shared across every species and instance.
// Sources and approximate lighting parameters: docs/reference/wood-materials.md.
const files = {
  woodColor: "classic-wood-color.png",
  woodNormal: "classic-wood-normal.png",
  graniteColor: "classic-granite-color.png",
  iceNormal: "classic-ice-normal.png",
  foilNormal: "classic-foil-normal.png",
  grassColor: "classic-grass-color.png",
  grassNormal: "classic-grass-normal.png",
  groundColor: "classic-concrete-color.png",
  groundNormal: "classic-concrete-normal.png",
} as const;
type TexturePool = Record<keyof typeof files, Texture>;
let pool: TexturePool | undefined;
let loading: Promise<void> | undefined;

/** Load once before constructing views or rendering catalog thumbnails. */
export function preloadMaterials(): Promise<void> {
  if (loading) return loading;
  const loader = new TextureLoader();
  loading = Promise.all(
    Object.entries(files).map(async ([key, file]) => {
      const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/${file}`);
      texture.name = file;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      // Three generates mipmaps; moderate anisotropy preserves angled floors.
      texture.anisotropy = 4;
      if (key.endsWith("Color")) texture.colorSpace = SRGBColorSpace;
      return [key, texture] as const;
    }),
  ).then((entries) => {
    pool = Object.fromEntries(entries) as TexturePool;
  });
  return loading;
}

export function makeMaterials() {
  if (!pool) throw new Error("Material textures must finish loading before creating the scene.");
  const textures = pool;
  return new Map(
    WOODS.map((w) => [
      w.id,
      new MeshStandardMaterial({
        name: `${w.name} / classic ${w.kind}`,
        color: w.color,
        map: w.kind === "wood" ? textures.woodColor : w.kind === "stone" ? textures.graniteColor : null,
        normalMap: w.kind === "wood" ? textures.woodNormal : w.kind === "ice" ? textures.iceNormal : w.kind === "foil" ? textures.foilNormal : null,
        normalScale: new Vector2(1, 1),
        roughness: w.kind === "ice" ? 0.22 : w.kind === "foil" ? 0.32 : 0.78,
        metalness: w.kind === "foil" ? 0.35 : 0,
        emissive: w.kind === "glow" ? w.color : "#000000",
        emissiveIntensity: w.kind === "glow" ? 0.4 : 0,
      }),
    ]),
  );
}

export function makeTerrainMaterials() {
  if (!pool) throw new Error("Terrain textures must finish loading first.");
  return {
    grass: new MeshStandardMaterial({ name: "Classic grass", color: 0x295b31, map: pool.grassColor, normalMap: pool.grassNormal, normalScale: new Vector2(.5, .5), roughness: 1 }),
    plot: new MeshStandardMaterial({ name: "Building plot soil", color: 0x826438, map: pool.groundColor, normalMap: pool.groundNormal, normalScale: new Vector2(.35, .35), roughness: 1 }),
  };
}

/** One subtle classic texture treatment shared by every logic housing. */
export function makeLogicHousingMaterial() {
  if (!pool) throw new Error("Material textures must finish loading first.");
  const material=new MeshStandardMaterial({name:"Logic / classic concrete",color:0x58594f,
    map:pool.groundColor,roughness:.95});
  // The terrain map's full contrast looks like gravel on small enclosures.
  // Blend its albedo once in the shared shader; no generated texture per item.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      'vec4 caseColor = diffuseColor;\n#include <map_fragment>\ndiffuseColor.rgb = mix(caseColor.rgb, diffuseColor.rgb, 0.16);');
  };
  return material;
}

/** Shared fixed glass; no scene capture or refraction pass per pane. */
export function makeGlassMaterial() {
  return new MeshStandardMaterial({name:"Fixed translucent glass",color:0xc4d2d6,
    transparent:true,opacity:.32,depthWrite:false,roughness:.18,metalness:0});
}

/** Shared fixed store finishes; no wood palette or per-instance textures. */
export function makeFurnitureMaterials() {
  return [
    ["Warm beige upholstery",0xc9966b,.85], ["Black feet and handles",0x17242b,.65],
    ["White enamel and bedding",0xf1f0e9,.48], ["Brown bed frame",0x866044,.8],
    ["Gray metal handles",0xa3a5a4,.4], ["Stove body",0x625d66,.65],
    ["Bowl water",0x9eafb9,.28], ["Appliance gray",0x999b9e,.65],
    ["Oven window",0x3e464b,.4],
  ].map(([name,color,roughness])=>new MeshStandardMaterial({name:name as string,color:color as number,roughness:roughness as number}));
}


/** Fixed hardware is shared by all blueprints, independent of selected wood. */
export function makeBlueprintHardwareMaterials() {
  return [
    new MeshStandardMaterial({ name: "Dark knob / drain", color: 0x171919, roughness: .72 }),
    new MeshStandardMaterial({ name: "Sink tap", color: 0xb5b8b9, roughness: .32, metalness: .35 }),
    new MeshStandardMaterial({ name: "Sink basin", color: 0xe7e8e6, roughness: .24 }),
  ];
}
