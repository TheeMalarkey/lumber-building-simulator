import { test, expect, type Page } from '@playwright/test';
const pieces=(page:Page)=>page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].sort((a:any,b:any)=>a.id.localeCompare(b.id)));
async function setup(page:Page) {
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    e.world.load([
      {id:'a',item:'small-floor',wood:'oak',position:[-4,.5,0],rotation:[0,0,0]},
      {id:'b',item:'small-floor',wood:'birch',position:[4,.5,0],rotation:[0,0,0]},
    ],[12]);e.pickSelection('a');
  });
}
test('overlap toggle refreshes held copies and disabling it keeps existing builds',async({page})=>{
  await setup(page);await expect(page.locator('#overlap-toggle')).toHaveCount(1);
  await expect(page.locator('#overlap-toggle')).not.toBeChecked();
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.move(true);e.pointer=null;e.held=true;
    e.ghost={...structuredClone(e.world.pieces.get('a')),id:'ghost'};e.inspect();e.updateGhost();
  });
  const color=()=>page.evaluate(()=>(window as any).timber.editor.view.ghost.material.color.getHex());
  expect(await color()).toBe(0xe15d4f);
  await page.locator('#commit-preview').click();expect(await pieces(page)).toHaveLength(2);
  await page.locator('#overlap-toggle').check();expect(await color()).toBe(0xe7b465);
  await page.locator('#commit-preview').click();expect(await pieces(page)).toHaveLength(3);
  const placed=await pieces(page);expect(placed.filter((p:any)=>p.position[0]===-4)).toHaveLength(2);
  await page.locator('#overlap-toggle').uncheck();expect(await pieces(page)).toEqual(placed);expect(await color()).toBe(0xe15d4f);
  await page.locator('#commit-preview').click();expect(await pieces(page)).toEqual(placed);
  await page.locator('#undo').click();expect(await pieces(page)).toHaveLength(2);await expect(page.locator('#overlap-toggle')).not.toBeChecked();
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#overlap-toggle')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('overlap mode applies to group turns and moves while retaining ground and plot limits',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    e.world.load([
      {id:'a',item:'post',wood:'oak',position:[-3,8,1],rotation:[0,0,0]},
      {id:'b',item:'post',wood:'birch',position:[3,8,-1],rotation:[0,0,0]},
      {id:'c',item:'tiny-floor',wood:'walnut',position:[1,8,3],rotation:[0,0,0]},
    ],[12]);e.pickSelections(['a','b']);
  });
  const before=await pieces(page);await page.keyboard.press('r');expect(await pieces(page)).toEqual(before);
  await page.locator('#overlap-toggle').check();await page.locator('#viewport>canvas').focus();await page.keyboard.press('r');
  expect((await pieces(page)).slice(0,2).map((p:any)=>p.position)).toEqual([[1,8,3],[-1,8,-3]]);
  await page.locator('#undo').click();expect(await pieces(page)).toEqual(before);
  for(let i=0;i<8;i++)await page.locator('[data-nudge="down"]').click();
  const floor=await pieces(page);expect(floor.slice(0,2).map((p:any)=>p.position[1])).toEqual([2,2]);
  await expect(page.locator('#toast')).toContainText('below ground');
  for(let i=0;i<25;i++)await page.locator('[data-nudge="right"]').click();
  const edge=await pieces(page);expect(edge.slice(0,2).map((p:any)=>p.position[0])).toEqual([13,19]);
  await expect(page.locator('#toast')).toContainText('active plots');await expect(page.locator('#overlap-toggle')).toBeChecked();
});
