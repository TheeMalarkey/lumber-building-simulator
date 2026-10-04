import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, group = false, offset = 0) {
  await page.goto('/'); await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(({group, offset}) => {
    const e = (window as any).timber.editor;
    e.world.load([
      {id:'a',item:'tiny-tile',wood:'oak',position:[offset-3,.1,0],rotation:[0,0,0]},
      {id:'b',item:'tiny-tile',wood:'birch',position:[offset+3,.1,0],rotation:[0,1,0]},
    ], offset ? null : [12]);
    const c = e.view.camera; c.camera.position.set(offset+12,16,24); c.controls.target.set(offset,0,0); c.controls.update();
    e.pickSelections(group ? ['a','b'] : ['a']);
  }, {group,offset});
  await expect.poll(() => page.evaluate(() => !!(window as any).timber.editor.view.gizmo?.root.visible)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
const state = (page: Page) => page.evaluate(() => [...(window as any).timber.editor.world.pieces.values()].sort((a:any,b:any)=>a.id.localeCompare(b.id)).map((p:any) => p.position));
async function drag(page: Page, axis: number, distance: number, finish = true) {
  const points = await page.evaluate(({axis,distance}) => {
    const v = (window as any).timber.editor.view, g = v.gizmo;
    const p = g.root.position.clone(); p.setComponent(axis,p.getComponent(axis)+g.root.scale.x*.7);
    const q = p.clone(); q.setComponent(axis,q.getComponent(axis)+distance);
    const r = v.renderer.domElement.getBoundingClientRect();
    const project = (p:any) => {p.project(v.camera.camera); return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2];};
    return [project(p),project(q)];
  }, {axis,distance});
  await page.mouse.move(points[0][0],points[0][1]); await page.mouse.down();
  await page.mouse.move(points[1][0],points[1][1],{steps:8});
  if (finish) await page.mouse.up();
}

test('axis arrows snap every axis to studs and undo a group in one action',async({page}) => {
  await setup(page,true);
  const camera = await page.evaluate(() => (window as any).timber.editor.view.camera.camera.position.toArray());
  await drag(page,1,2.3); expect(await state(page)).toEqual([[-3,2.1,0],[3,2.1,0]]);
  await drag(page,0,-2.2); expect(await state(page)).toEqual([[-5,2.1,0],[1,2.1,0]]);
  await drag(page,2,1.2); expect(await state(page)).toEqual([[-5,2.1,1],[1,2.1,1]]);
  expect(await page.evaluate(() => (window as any).timber.editor.view.camera.camera.position.toArray())).toEqual(camera);
  await page.locator('#undo').click(); expect(await state(page)).toEqual([[-5,2.1,0],[1,2.1,0]]);
  await page.locator('#redo').click(); expect(await state(page)).toEqual([[-5,2.1,1],[1,2.1,1]]);
});

test('invalid arrow moves and cancelled drags leave originals unchanged',async({page}) => {
  await setup(page); const before = await state(page);
  await drag(page,1,-1); expect(await state(page)).toEqual(before); await expect(page.locator('#toast')).toContainText('below ground');
  await drag(page,0,6); expect(await state(page)).toEqual(before); await expect(page.locator('#toast')).toContainText('overlap');
  await drag(page,0,-20); expect(await state(page)).toEqual(before); await expect(page.locator('#toast')).toContainText('active plots');
  await drag(page,1,3,false); await page.keyboard.press('Escape'); await page.mouse.up(); expect(await state(page)).toEqual(before);
  await drag(page,1,3,false); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); expect(await state(page)).toEqual(before);
  await drag(page,1,1); expect(await state(page)).toEqual([[-3,1.1,0],[3,.1,0]]);
});

test('held copies move with arrows without placing until confirmed',async({page}) => {
  await setup(page,true); const before = await state(page);
  await page.locator('#duplicate-tool').click(); await page.locator('#hold-position').click();
  await drag(page,1,1); await drag(page,2,-1);
  expect(await state(page)).toEqual(before);
  expect(await page.evaluate(() => (window as any).timber.editor.groupPreview.map((p:any)=>p.position))).toEqual([[-3,1.1,-1],[3,1.1,-1]]);
  await drag(page,1,2,false); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await page.evaluate(() => (window as any).timber.editor.groupPreview.map((p:any)=>p.position))).toEqual([[-3,1.1,-1],[3,1.1,-1]]);
  await page.locator('#commit-preview').click(); expect(await state(page)).toHaveLength(4);
  await page.locator('#undo').click(); expect(await state(page)).toEqual(before);
});

test('arrows stay aligned beyond the floating origin',async({page}) => {
  await setup(page,false,512); await drag(page,0,2); expect(await state(page)).toEqual([[511,.1,0],[515,.1,0]]);
});
