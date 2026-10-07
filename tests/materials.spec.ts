import { expect, test } from "@playwright/test";
import { openBuild } from "./ui-helpers";

test('all nine furnishings save with fixed finishes and seating supports group copy and rotation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
  await openBuild(page);await page.locator('[data-category="Store furniture"]').click();
  await expect(page.locator('.catalog-card')).toHaveCount(9);
  await expect(page.locator('[data-category="Store furniture"]')).toHaveClass(/active/);
  await expect(page.locator('[data-item="armchair"] .card-size')).toContainText('≈');
  await page.locator('[data-item="couch"]').click();await expect(page.locator('#wood-picker')).toBeHidden();
  const result=await page.evaluate(()=>{
    const e=(window as any).timber.editor,v=e.view;
    e.world.load(Array.from({length:20},(_,i)=>({id:String(i),item:'couch',wood:i%2?'pine':'oak',position:[4+(i%3)*9,2,4+Math.floor(i/3)*5],rotation:[0,0,0]})),null);
    v.sync(true);
    const meshes=[...v.loaded.values()].flatMap((g:any)=>g.children) as any[];
    return {shared:v.materialFor('couch','oak')===v.materialFor('couch','pine'),plain:v.furnitureMaterials.every((m:any)=>!m.map&&!m.transparent),
      instances:meshes.reduce((n,m)=>n+m.count,0),meshes:meshes.length};
  });
  expect(result).toEqual({shared:true,plain:true,instances:20,meshes:1});
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    const specs=[['armchair',-10,2,-10],['loveseat',-3,2,-10],['couch',6,2,-10],
      ['single-bed',-10,1.5,0],['twin-bed',-3,1.5,0],['toilet',6,1.75,0],
      ['refrigerator',-10,3,10],['stove',-3,1.4,10],['dishwasher',6,1.2,10]];
    e.world.load(specs.map(([item,x,y,z],i)=>({id:'f'+i,item,wood:'oak',position:[x,y,z],rotation:[0,0,0]})),[12]);
    e.pickSelections(['f0','f1']);e.changeWood('pine');e.view.sync(true);
  });
  await expect(page.locator('#wood-picker')).toBeHidden();
  expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].every((p:any)=>p.wood==='oak'))).toBe(true);
  await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();
  for(let i=0;i<5;i++) await page.locator('[data-nudge="up"]').click();
  await page.locator('#commit-preview').click();await expect(page.locator('#piece-count')).toHaveText('11 pieces');
  await page.keyboard.press('r');await page.keyboard.press('t');
  await page.locator('#undo').click();await page.locator('#redo').click();
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
  expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(11);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    e.world.load([...e.world.pieces.values()].filter((p:any)=>p.id.startsWith('f')),[12]);
    e.view.sync(true);e.view.camera.camera.position.set(27,23,32);e.view.camera.controls.target.set(-2,1,0);e.view.camera.controls.update();
  });
  await openBuild(page);await page.locator('[data-category="Store furniture"]').click();
  await expect(page.locator('.catalog-card')).toHaveCount(9);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await page.screenshot({path:'artifacts/store-furniture.png'});
  await page.locator('#build-tool').click();
  await page.screenshot({path:'artifacts/store-furniture-scene.png'});
  await page.locator('#build-tool').click();
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-category="Store furniture"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('glass shares a fixed translucent finish and keeps opaque door hardware',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
  const result=await page.evaluate(()=>{
    const e=(window as any).timber.editor,v=e.view;
    const pane=v.materialFor('glass-pane','oak'),other=v.materialFor('glass-pane','volcano'),door=v.materialFor('glass-door','pine');
    e.world.load(Array.from({length:20},(_,i)=>({id:String(i),item:'glass-pane',wood:i%2?'oak':'pine',position:[4+(i%4)*5,4,4+Math.floor(i/4)*5],rotation:[0,0,0]})),null);
    v.sync(true);
    const meshes=[...v.loaded.values()].flatMap((g:any)=>g.children) as any[];
    return {same:pane===other && pane===door[0],transparent:pane.transparent,opacity:pane.opacity,depthWrite:pane.depthWrite,
      hardwareOpaque:!door[1].transparent,untextured:!pane.map,meshes:meshes.length,instances:meshes.reduce((n,m)=>n+m.count,0),
      shadows:meshes.some(m=>m.castShadow)};
  });
  expect(result).toMatchObject({same:true,transparent:true,depthWrite:false,hardwareOpaque:true,untextured:true,meshes:1,instances:20,shadows:false});
  expect(result.opacity).toBeGreaterThan(0);expect(result.opacity).toBeLessThan(1);expect(errors).toEqual([]);
});

test('glass catalog and mixed selections preserve fixed finishes through editing and saves',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
  await openBuild(page);await page.locator('[data-category="Glass"]').click();
  await expect(page.locator('.catalog-card')).toHaveCount(5);await page.locator('[data-item="glass-pane"]').click();
  await expect(page.locator('#wood-picker')).toBeHidden();
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([
      {id:'pane',item:'glass-pane',wood:'oak',position:[-5,2,0],rotation:[0,0,0]},
      {id:'door',item:'glass-door',wood:'oak',position:[5,4,0],rotation:[0,0,0]},
      {id:'wood',item:'smooth-wall',wood:'oak',position:[0,4,5],rotation:[0,0,0]},
    ],[12]);e.pickSelections(['pane','wood']);
  });
  await page.locator('#wood-toggle').click();await page.locator('[data-wood="pine"]').click();
  expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].map((p:any)=>p.wood))).toEqual(['oak','oak','pine']);
  await page.evaluate(()=>(window as any).timber.editor.pickSelections(['pane','door']));
  await expect(page.locator('#wood-picker')).toBeHidden();
  await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();
  for(let i=0;i<8;i++) await page.locator('[data-nudge="up"]').click();
  await page.locator('#commit-preview').click();
  await expect(page.locator('#piece-count')).toHaveText('5 pieces');
  await page.locator('#undo').click();await expect(page.locator('#piece-count')).toHaveText('3 pieces');
  await page.locator('#redo').click();await page.keyboard.press('Control+s');
  await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
  expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].filter((p:any)=>p.item.includes('glass')).length)).toBe(4);
});

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
