import { expect, test } from "@playwright/test";

test("classic maps preload, share textures, and render every material kind without shader errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const result = await page.evaluate(async () => {
    const e = (window as any).timber.editor;
    const entries = [...e.view.materials.entries()] as [string, any][];
    const maps = entries.flatMap(([, m]) => [m.map, m.normalMap]).filter(Boolean);
    const unique = [...new Set(maps)];
    const material = (id: string) => e.view.materials.get(id);
    const plain = (id: string) => !material(id).map && !material(id).normalMap;
    e.world.load(entries.map(([wood], i) => ({
      id: `material-${wood}`, item: "smooth-wall", wood,
      position: [(i % 5) * 6 - 12, 4, Math.floor(i / 5) * 6 - 12], rotation: [0, 0, 0],
    })));
    e.view.sync(true);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return {
      count: entries.length,
      sharedWood: ["elm", "walnut", "birch", "volcano", "gold"].every(id =>
        material(id).map === material("oak").map && material(id).normalMap === material("oak").normalMap),
      unique: unique.length,
      loaded: unique.every(t => t.image?.complete && t.image.naturalWidth > 0),
      colorSpaces: unique.map(t => [t.name, t.colorSpace]),
      oakColor: material("oak").color.getHexString(),
      stone: material("spooky").map.name,
      frost: material("frost").normalMap.name,
      phantom: material("phantom").normalMap.name,
      smoothKinds: ["snowglow", "sinister", "cavecrawler"].every(plain),
      glow: material("sinister").emissiveIntensity > 0 && material("cavecrawler").emissiveIntensity > 0 && material("snowglow").emissiveIntensity === 0,
      imageRequests: performance.getEntriesByType("resource").filter(r => r.name.includes("/textures/")).length,
      triangles: e.view.renderer.info.render.triangles,
    };
  });
  expect(result.count).toBe(20);
  expect(result.sharedWood).toBe(true);
  expect(result.unique).toBe(5);
  expect(result.loaded).toBe(true);
  expect(result.imageRequests).toBe(9);
  expect(result.oakColor).toBe("cc8e69");
  expect(result.stone).toBe("classic-granite-color.png");
  expect(result.frost).toBe("classic-ice-normal.png");
  expect(result.phantom).toBe("classic-foil-normal.png");
  expect(result.smoothKinds).toBe(true);
  expect(result.glow).toBe(true);
  for (const [name, colorSpace] of result.colorSpaces) {
    expect(colorSpace).toBe(name.includes("color") ? "srgb" : "");
  }
  expect(result.triangles).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("blueprint hardware stays neutral across finishes and remains instanced", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const result = await page.evaluate(async () => {
    const e = (window as any).timber.editor, v = e.view;
    const doorOak = v.materialFor("basic-door","oak");
    const doorCherry = v.materialFor("basic-door","cherry");
    const sink = v.materialFor("countertop-with-sink","oak");
    e.world.load(Array.from({length:20},(_,i)=>({
      id:"sink-"+i,item:"countertop-with-sink",wood:"oak",rotation:[0,0,0],
      position:[(i%5)*5,1,Math.floor(i/5)*5],
    })));
    v.sync(true);
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    const meshes = [...v.loaded.values()].flatMap((g:any)=>g.children) as any[];
    return {
      woodChanges: doorOak[0] !== doorCherry[0],
      sharedHardware: doorOak[1] === doorCherry[1] && sink[1] === doorOak[1],
      neutral: sink.slice(1).every((m:any)=>!m.map && !m.emissive.getHex()),
      surfaces: meshes[0].geometry.groups.map((g:any)=>g.materialIndex),
      meshes: meshes.length, instances: meshes.reduce((n,m)=>n+m.count,0),
      triangles: v.renderer.info.render.triangles,
    };
  });
  expect(result.woodChanges).toBe(true);
  expect(result.sharedHardware).toBe(true);
  expect(result.neutral).toBe(true);
  expect(result.surfaces).toEqual([0,1,2,3]);
  expect(result.meshes).toBe(1);
  expect(result.instances).toBe(20);
  expect(result.triangles).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
