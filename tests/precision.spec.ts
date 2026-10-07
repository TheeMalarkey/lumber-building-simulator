import { test, expect } from "@playwright/test";
const positions=(page:any)=>page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].map((p:any)=>({id:p.id,position:p.position})).sort((a:any,b:any)=>a.id.localeCompare(b.id)));
async function setup(page:any, group=false) {
  await page.goto("/");await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate((multi:boolean)=>{
    const e=(window as any).timber.editor;e.world.load([
      {id:"a",item:"tiny-tile",wood:"oak",position:[-3,.1,0],rotation:[0,0,0]},
      {id:"b",item:"tiny-tile",wood:"birch",position:[3,.1,0],rotation:[0,1,0]},
    ],[12]);e.view.camera.camera.position.set(0,20,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();
    e.pickSelections(multi?["a","b"]:["a"]);
  },group);
}
test("six movement buttons nudge one piece in whole studs, keep fractional height, and undo",async({page})=>{
  await setup(page);
  await page.locator('[data-nudge="up"]').click();
  expect((await positions(page))[0].position).toEqual([-3,1.1,0]);
  await page.locator('[data-nudge="forward"]').click();expect((await positions(page))[0].position).toEqual([-3,1.1,-1]);
  await page.locator('[data-nudge="right"]').click();expect((await positions(page))[0].position).toEqual([-2,1.1,-1]);
  await page.locator('[data-nudge="back"]').click();await page.locator('[data-nudge="left"]').click();await page.locator('[data-nudge="down"]').click();
  expect((await positions(page))[0].position).toEqual([-3,.1,0]);
  await page.locator('[data-nudge="down"]').click();await expect(page.locator('#toast')).toContainText('below ground');
  await page.locator('#undo').click();expect((await positions(page))[0].position).toEqual([-3,1.1,0]);
  await expect(page.locator('[data-nudge]')).toHaveCount(6);
});
test("group nudges are atomic and reject an obstacle under either member",async({page})=>{
  await setup(page,true);await page.locator('[data-nudge="up"]').click();
  expect((await positions(page)).map((p:any)=>p.position[1])).toEqual([1.1,1.1]);
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([{before:null,after:{id:'obstacle',item:'tiny-tile',wood:'oak',position:[4,1.1,0],rotation:[0,0,0]}}]);});
  const before=await positions(page);await page.locator('[data-nudge="right"]').click();
  expect(await positions(page)).toEqual(before);await expect(page.locator('#toast')).toContainText('overlap');
  await page.locator('#undo').click();await page.locator('#undo').click();
  expect((await positions(page)).map((p:any)=>p.position[1])).toEqual([.1,.1]);
});
test("held previews can build up and over in the air without following the mouse",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.choose('tiny-tile');e.pointer=[720,480];e.updateGhost();
  });
  const before=await positions(page);
  await page.locator('[data-nudge="up"]').click();
  const preview=()=>page.evaluate(()=>(window as any).timber.editor.ghost.position);
  const raised=await preview();await page.locator('[data-nudge="forward"]').click();
  const offset=await preview();expect(offset).toEqual([raised[0],raised[1],raised[2]-1]);
  await page.mouse.move(500,200);expect(await preview()).toEqual(offset);expect(await positions(page)).toEqual(before);
  await page.locator('#commit-preview').click();expect(await positions(page)).toHaveLength(3);
  expect((await positions(page)).find((p:any)=>!['a','b'].includes(p.id)).position).toEqual(offset);
  await page.locator('[data-nudge="up"]').click();await page.locator('[data-nudge="forward"]').click();await page.locator('#commit-preview').click();
  expect(await positions(page)).toHaveLength(4);
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>(window as any).timber.editor.placing)).toBe(false);
});
test("held group copies retain spacing and cancel without changing originals",async({page})=>{
  await setup(page,true);await page.locator('#duplicate-tool').click();
  await page.locator('#hold-position').click();await page.locator('[data-nudge="up"]').click();
  const before=await positions(page);
  await page.locator('#commit-preview').click();
  expect(await positions(page)).toHaveLength(4);
  await page.locator('#undo').click();expect(await positions(page)).toEqual(before);
  await page.evaluate(()=>(window as any).timber.editor.pickSelections(['a','b']));
  await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();
  await page.locator('[data-nudge="up"]').click();await page.keyboard.press('Escape');
  expect(await positions(page)).toEqual(before);
});

test("walk input follows a wedge slope and precision controls fit compact screens",async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.pickSelection(null);
    e.world.load([{id:'ramp',item:'4-4-wedge',wood:'oak',position:[0,2,0],rotation:[0,0,0]}],[12]);
    const c=e.view.camera;c.camera.position.set(0,6,5);c.controls.target.set(0,3,0);c.controls.update();
  });
  await page.locator('#walk-tool').click();await page.keyboard.down('w');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.camera.walker.position.y),{intervals:[25]}).toBeGreaterThan(1);
  await page.keyboard.up('w');
  const ramp=await page.evaluate(()=>{const w=(window as any).timber.editor.view.camera.walker;return {height:w.position.y,z:w.position.z,clear:w.canOccupy(w.position)}});
  expect(ramp.height).toBeLessThan(4);expect(ramp.z).toBeLessThan(2);expect(ramp.clear).toBe(true);
  await page.keyboard.press('c');await page.evaluate(()=>(window as any).timber.editor.pickSelection('ramp'));
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('[data-nudge="down"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
