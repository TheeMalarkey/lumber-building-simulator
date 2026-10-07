import { test, expect, type Page } from "@playwright/test";
import { openWoods } from "./ui-helpers";
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
async function elevatedPair(page:Page) {
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    e.world.load([
      {id:'a',item:'post',wood:'oak',position:[-3,8,1],rotation:[0,0,0]},
      {id:'b',item:'post',wood:'birch',position:[3,8,-1],rotation:[0,1,0]},
      {id:'c',item:'tiny-tile',wood:'walnut',position:[12,.1,12],rotation:[0,0,0]},
    ],[12]);e.pickSelections(['a','b']);
  });
}

test('group rotate and tilt keep the assembly together and undo as whole actions',async({page})=>{
  await elevatedPair(page);const original=await pieces(page);
  await expect(page.locator('[data-nudge]')).toHaveCount(6);
  await expect(page.locator('[data-nudge="up"]')).toBeHidden();
  await page.keyboard.press('r');
  const yawed=await pieces(page);expect(yawed.slice(0,2).map((p:any)=>p.position)).toEqual([[1,8,3],[-1,8,-3]]);
  await page.keyboard.press('t');const tilted=await pieces(page);
  expect(tilted.slice(0,2).map((p:any)=>p.position)).toEqual([[1,5,0],[-1,11,0]]);
  expect(tilted[2]).toEqual(original[2]);expect(await selected(page)).toEqual(['a','b']);
  await page.locator('#undo').click();expect(await pieces(page)).toEqual(yawed);
  await page.locator('#undo').click();expect(await pieces(page)).toEqual(original);
  await page.locator('#redo').click();await page.locator('#redo').click();expect(await pieces(page)).toEqual(tilted);
});

test('group turns reject ground, plot and outsider collisions without partial edits',async({page})=>{
  await elevatedPair(page);
  for (const issue of ['overlap','below ground','active plots']) {
    await page.evaluate((issue)=>{
      const e=(window as any).timber.editor;
      const member=(id:string,position:number[])=>({id,item:'post',wood:'oak',position,rotation:[0,0,0]});
      const pair=issue==='active plots' ? [member('a',[17,8,-3]),member('b',[17,8,3])]
        : issue==='below ground' ? [member('a',[-3,2,3]),member('b',[3,2,-3])]
        : [member('a',[-3,8,1]),member('b',[3,8,-1]),{id:'c',item:'tiny-floor',wood:'walnut',position:[1,8,3],rotation:[0,0,0]}];
      e.world.load(pair,[12]);e.pickSelections(['a','b']);
    },issue);
    const before=await pieces(page);await page.keyboard.press(issue==='below ground'?'t':'r');
    expect(await pieces(page)).toEqual(before);await expect(page.locator('#toast')).toContainText(issue);
    await expect(page.locator('#undo')).toBeDisabled();
  }
});

test('group wood changes show mixed finishes and preserve undo, outsiders and saves',async({page})=>{
  await elevatedPair(page);const original=await pieces(page);
  await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', /Mixed woods/);await openWoods(page);
  await expect(page.locator('[data-wood].active')).toHaveCount(0);
  await page.locator('[data-wood="pine"]').click();const recolored=await pieces(page);
  expect(recolored.slice(0,2).map((p:any)=>p.wood)).toEqual(['pine','pine']);expect(recolored[2]).toEqual(original[2]);
  expect(recolored.map((p:any)=>[p.id,p.position,p.rotation])).toEqual(original.map((p:any)=>[p.id,p.position,p.rotation]));
  await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', /Pine/);
  await page.locator('#undo').click();expect(await pieces(page)).toEqual(original);await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', /Mixed woods/);
  await page.locator('#redo').click();expect(await pieces(page)).toEqual(recolored);
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);expect(await pieces(page)).toEqual(recolored);
});

test('held group copies can turn and recolor without modifying their originals',async({page})=>{
  await elevatedPair(page);const original=await pieces(page);await page.locator('#duplicate-tool').click();
  await page.locator('#hold-position').click();await page.keyboard.press('r');await page.keyboard.press('t');
  await openWoods(page);await page.locator('[data-wood="pine"]').click();
  expect(await pieces(page)).toEqual(original);
  expect(await page.evaluate(()=>(window as any).timber.editor.groupPreview.map((p:any)=>[p.position,p.wood]))).toEqual([[[1,5,0],'pine'],[[-1,11,0],'pine']]);
  await page.locator('#commit-preview').click();const copies=(await pieces(page)).filter((p:any)=>!['a','b','c'].includes(p.id));
  expect(copies).toHaveLength(2);expect(copies.every((p:any)=>p.wood==='pine')).toBe(true);
  expect((await pieces(page)).filter((p:any)=>['a','b','c'].includes(p.id))).toEqual(original);
  await page.locator('#undo').click();expect(await pieces(page)).toEqual(original);
  await page.evaluate(()=>(window as any).timber.editor.pickSelections(['a','b']));
  await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();await page.keyboard.press('r');
  await openWoods(page);await page.locator('[data-wood="walnut"]').click();await page.keyboard.press('Escape');
  expect(await pieces(page)).toEqual(original);
});

test('surface-following group preview retains turns and wood on subsequent positions',async({page})=>{
  const s=await fixture(page);await selectPair(page,s);const original=await pieces(page);
  await page.locator('#duplicate-tool').click();await page.mouse.move(s.copy.x,s.copy.y);
  await page.keyboard.press('r');await openWoods(page);await page.locator('[data-wood="pine"]').click();
  await page.mouse.move(s.move.x,s.move.y);
  const preview=await page.evaluate(()=>(window as any).timber.editor.groupPreview);
  expect(preview.map((p:any)=>p.position)).toEqual([[-3,.5,9],[-3,.5,3]]);
  expect(preview.map((p:any)=>p.wood)).toEqual(['pine','pine']);expect(await pieces(page)).toEqual(original);
  await page.mouse.click(s.move.x,s.move.y);expect(await pieces(page)).toHaveLength(5);
});

test('held group move commits rotation, tilt and finish with one undo',async({page})=>{
  await elevatedPair(page);const original=await pieces(page);
  await page.locator('#move-tool').click();await page.locator('#hold-position').click();
  await page.keyboard.press('r');await page.keyboard.press('t');await openWoods(page);await page.locator('[data-wood="pine"]').click();
  expect(await pieces(page)).toEqual(original);await page.locator('#commit-preview').click();
  const moved=await pieces(page);expect(moved.slice(0,2).map((p:any)=>[p.position,p.wood])).toEqual([[[1,5,0],'pine'],[[-1,11,0],'pine']]);
  await page.locator('#undo').click();expect(await pieces(page)).toEqual(original);
});

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
  await page.mouse.move(s.copy.x,s.copy.y);await page.locator('#viewport>canvas').focus();await page.keyboard.press('l');
  await page.locator('[data-nudge="down"]').click();await page.locator('#commit-preview').click();
  expect(await pieces(page)).toEqual(original);await expect(page.locator("#toast")).toContainText("below ground");
  expect(await page.evaluate(()=>(window as any).timber.editor.view.ghost.material.color.getHex())).toBe(0xe15d4f);
  await page.keyboard.press("Escape");expect(await pieces(page)).toEqual(original);
});

test("Escape cancels Ctrl-drag without moving the camera, and selection rendering is batched",async({page})=>{
  const s=await fixture(page);await page.mouse.click(s.c.x,s.c.y);
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
