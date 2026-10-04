import { test, expect, type Page } from "@playwright/test";
async function fixture(page:Page) {
  await page.goto("/");await page.waitForFunction(()=>!!(window as any).timber);
  return page.evaluate(()=>{
    const e=(window as any).timber.editor;
    e.pickSelection(null);e.world.load([
      {id:"a",item:"small-floor",wood:"oak",position:[-6,.5,-6],rotation:[0,1,0]},
      {id:"b",item:"small-floor",wood:"birch",position:[0,.5,-6],rotation:[0,0,0]},
      {id:"c",item:"small-floor",wood:"walnut",position:[6,.5,6],rotation:[0,0,0]},
    ],[12]);
    e.view.camera.controls.enableDamping=false;e.view.camera.top();e.view.camera.camera.updateMatrixWorld();e.view.sync(true);
    const project=(p:number[])=>{const v=e.view.camera.camera.position.clone().fromArray(p).project(e.view.camera.camera);const r=e.view.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}};
    return {a:project([-6,.5,-6]),b:project([0,.5,-6]),c:project([6,.5,6]),empty:project([-13,0,0]),start:project([-9,0,-9]),end:project([3,0,-3]),move:project([-3,0,6]),blocked:project([3,0,6]),copy:project([-3,0,0]),outside:project([17,0,0])};
  });
}
const selected=(page:Page)=>page.evaluate(()=>[...(window as any).timber.editor.selection].sort());
const pieces=(page:Page)=>page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].sort((a:any,b:any)=>a.id.localeCompare(b.id)));
async function selectPair(page:Page,s:any) {await page.mouse.click(s.a.x,s.a.y);await page.keyboard.down("Control");await page.mouse.click(s.b.x,s.b.y);await page.keyboard.up("Control");}

test("Ctrl-click adds and removes separate blueprints without double-click pickup",async({page})=>{
  const s=await fixture(page);await selectPair(page,s);
  expect(await selected(page)).toEqual(["a","b"]);await expect(page.locator("#piece-name")).toHaveText("2 blueprints selected");
  await page.keyboard.down("Control");await page.mouse.click(s.c.x,s.c.y);await page.mouse.click(s.a.x,s.a.y);await page.keyboard.up("Control");
  expect(await selected(page)).toEqual(["b","c"]);
  await page.keyboard.down("Control");await page.mouse.dblclick(s.a.x,s.a.y);await page.mouse.click(s.empty.x,s.empty.y);await page.keyboard.up("Control");
  expect(await selected(page)).toEqual(["b","c"]);
  expect(await page.evaluate(()=>(window as any).timber.editor.placing)).toBe(false);
  await page.mouse.click(s.empty.x,s.empty.y);expect(await selected(page)).toEqual([]);
});

test("Ctrl-drag adds a rectangle in either direction and cancels on lost focus",async({page})=>{
  const s=await fixture(page);await page.mouse.click(s.c.x,s.c.y);
  await page.keyboard.down("Control");await page.mouse.move(s.start.x,s.start.y);await page.mouse.down();await page.mouse.move(s.end.x,s.end.y,{steps:6});
  await expect(page.locator("#selection-marquee")).toBeVisible();await page.mouse.up();await page.keyboard.up("Control");
  expect(await selected(page)).toEqual(["a","b","c"]);
  await page.keyboard.press("Escape");
  await page.keyboard.down("Control");await page.mouse.move(s.end.x,s.end.y);await page.mouse.down();await page.mouse.move(s.start.x,s.start.y,{steps:6});await page.mouse.up();await page.keyboard.up("Control");
  expect(await selected(page)).toEqual(["a","b"]);
  await page.keyboard.down("Control");await page.mouse.move(s.start.x,s.start.y);await page.mouse.down();await page.mouse.move(s.end.x,s.end.y);await page.evaluate(()=>window.dispatchEvent(new Event("blur")));await page.mouse.up();await page.keyboard.up("Control");
  await expect(page.locator("#selection-marquee")).toBeHidden();expect(await selected(page)).toEqual(["a","b"]);
});

test("group move is atomic, preserves spacing, rejects collisions and supports cancel and undo",async({page})=>{
  const s=await fixture(page),original=await pieces(page);await selectPair(page,s);await page.keyboard.press("g");
  await page.mouse.move(s.blocked.x,s.blocked.y);await page.mouse.click(s.blocked.x,s.blocked.y);
  expect(await pieces(page)).toEqual(original);await expect(page.locator("#toast")).toContainText("overlap");
  await page.keyboard.press("Escape");expect(await pieces(page)).toEqual(original);
  await selectPair(page,s);await page.locator("#move-tool").click();await page.mouse.click(s.move.x,s.move.y);
  const moved=await pieces(page);expect(moved.find((p:any)=>p.id==="a").position).toEqual([-6,.5,6]);expect(moved.find((p:any)=>p.id==="b").position).toEqual([0,.5,6]);
  expect(moved.find((p:any)=>p.id==="a").rotation).toEqual([0,1,0]);expect(moved.find((p:any)=>p.id==="b").wood).toBe("birch");
  await page.keyboard.press("Control+z");expect(await pieces(page)).toEqual(original);
  await page.keyboard.press("Control+Shift+z");expect(await pieces(page)).toEqual(moved);
});

test("group copy creates independent pieces and group delete undoes in one step",async({page})=>{
  const s=await fixture(page),original=await pieces(page);await selectPair(page,s);await page.keyboard.press("Control+d");await page.mouse.click(s.copy.x,s.copy.y);
  const copied=await pieces(page);expect(copied).toHaveLength(5);expect(copied.filter((p:any)=>["a","b","c"].includes(p.id))).toEqual(original);
  const added=copied.filter((p:any)=>!["a","b","c"].includes(p.id));expect(added.map((p:any)=>p.wood).sort()).toEqual(["birch","oak"]);expect(new Set(added.map((p:any)=>p.id)).size).toBe(2);
  expect((await selected(page)).length).toBe(2);await page.keyboard.press("Delete");expect(await pieces(page)).toEqual(original);
  await page.keyboard.press("Control+z");expect(await pieces(page)).toEqual(copied);
  await page.keyboard.press("Control+z");expect(await pieces(page)).toEqual(original);
  await page.keyboard.press("Control+Shift+z");expect(await pieces(page)).toEqual(copied);
  await page.keyboard.press("Control+s");await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);expect(await pieces(page)).toEqual(copied);
});

test("group placement rejects even one member outside plots or below ground", async ({page}) => {
  const s=await fixture(page),original=await pieces(page);await selectPair(page,s);await page.keyboard.press("g");
  await page.mouse.click(s.outside.x,s.outside.y);
  expect(await pieces(page)).toEqual(original);await expect(page.locator("#toast")).toContainText("active plots");
  await page.locator("#elevation").fill("-1");await page.mouse.click(s.copy.x,s.copy.y);
  expect(await pieces(page)).toEqual(original);await expect(page.locator("#toast")).toContainText("below ground");
  expect(await page.evaluate(()=>(window as any).timber.editor.view.ghost.material.color.getHex())).toBe(0xe15d4f);
  await page.keyboard.press("Escape");expect(await pieces(page)).toEqual(original);
});

test("Ctrl-drag overrides orbit, Escape cancels the gesture, and selection rendering is batched",async({page})=>{
  const s=await fixture(page);await page.mouse.click(s.c.x,s.c.y);await page.locator("#orbit-tool").click();
  const camera=()=>page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.toArray());
  const before=await camera();
  await page.keyboard.down("Control");await page.mouse.move(s.start.x,s.start.y);await page.mouse.down();await page.mouse.move(s.end.x,s.end.y,{steps:4});
  await expect(page.locator("#selection-marquee")).toBeVisible();await page.keyboard.press("Escape");await page.mouse.up();await page.keyboard.up("Control");
  expect(await selected(page)).toEqual(["c"]);expect(await camera()).toEqual(before);
  await expect(page.locator("#selection-marquee")).toBeHidden();
  const rendering=await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    const group=Array.from({length:200},(_,i)=>({id:`batch-${i}`,item:i%2?"small-floor":"tiny-tile",wood:i%2?"oak":"birch",position:[(i%10)*3,.5,Math.floor(i/10)*3],rotation:[0,0,0]}));
    e.world.load(group);e.pickSelections(group.map(p=>p.id));e.move(true);
    e.view.showGroupGhosts(group);
    const result={lines:e.view.selectionLines.geometry.getAttribute("position").count,ghosts:e.view.groupGhosts.children.length,instances:e.view.groupGhosts.children.reduce((n:number,m:any)=>n+m.count,0)};
    e.pickSelection(null);return {...result,remaining:e.view.groupGhosts.children.length,highlight:e.view.selectionLines.visible};
  });
  expect(rendering).toEqual({lines:200*24,ghosts:2,instances:200,remaining:0,highlight:false});
});
