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
  return points;
}

test('copy with arrows keeps a single original and selects the new copy',async({page})=>{
  await setup(page);await page.locator('#axis-copy-toggle').check({timeout:1000});
  const original=await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('a'));
  await drag(page,1,1.3);
  const after=await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()]);
  expect(after).toHaveLength(3);expect(after.find((p:any)=>p.id==='a')).toEqual(original);
  const copy=after.find((p:any)=>!['a','b'].includes(p.id));
  expect(copy).toMatchObject({item:original.item,wood:original.wood,position:[-3,1.1,0],rotation:original.rotation});
  expect(await page.evaluate(()=>(window as any).timber.editor.selected)).toBe(copy.id);
  await page.locator('#undo').click();expect(await state(page)).toEqual([[-3,.1,0],[3,.1,0]]);
  await page.locator('#redo').click();expect(await state(page)).toHaveLength(3);
});

test('copy with arrows duplicates a whole group and cancellation leaves originals unchanged',async({page})=>{
  await setup(page,true);await page.locator('#axis-copy-toggle').check({timeout:1000});
  const originals=await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()]);
  await drag(page,1,2,false);await page.keyboard.press('Escape');await page.mouse.up();
  expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()])).toEqual(originals);
  await drag(page,1,2,false);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
  expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()])).toEqual(originals);
  await drag(page,1,2);
  const after=await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()]);
  expect(after.filter((p:any)=>['a','b'].includes(p.id))).toEqual(originals);
  expect(after.filter((p:any)=>!['a','b'].includes(p.id)).map((p:any)=>({item:p.item,wood:p.wood,position:p.position,rotation:p.rotation})))
    .toEqual(originals.map((p:any)=>({item:p.item,wood:p.wood,position:[p.position[0],p.position[1]+2,p.position[2]],rotation:p.rotation})));
  expect(await page.evaluate(()=>(window as any).timber.editor.selection.size)).toBe(2);
  await page.locator('#undo').click();expect(await state(page)).toEqual([[-3,.1,0],[3,.1,0]]);
});

test('axis copies check originals as obstacles and always keep ground and land limits',async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:'a',item:'small-floor',wood:'oak',position:[0,.5,0],rotation:[0,0,0]}],[12]);e.pickSelection('a');
  });
  await page.locator('#axis-copy-toggle').check({timeout:1000});
  await drag(page,0,1);expect(await state(page)).toEqual([[0,.5,0]]);await expect(page.locator('#toast')).toContainText('overlap');
  await page.locator('#overlap-toggle').check();
  await drag(page,1,-1);expect(await state(page)).toEqual([[0,.5,0]]);await expect(page.locator('#toast')).toContainText('below ground');
  await drag(page,0,22);expect(await state(page)).toEqual([[0,.5,0]]);await expect(page.locator('#toast')).toContainText('active plots');
  await drag(page,0,1);expect(await state(page)).toHaveLength(2);
  await page.locator('#undo').click();await page.evaluate(()=>(window as any).timber.editor.pickSelection('a'));
  await page.locator('#axis-copy-toggle').uncheck();await page.locator('#overlap-toggle').uncheck();
  await drag(page,0,1);expect(await state(page)).toEqual([[1,.5,0]]);
});

test('successive group arrow copies follow the new selection and fit a compact screen',async({page})=>{
  await setup(page,true);await page.locator('#axis-copy-toggle').check();
  await drag(page,1,0);expect(await state(page)).toHaveLength(2);
  expect(await page.evaluate(()=>(window as any).timber.editor.world.canUndo)).toBe(false);
  await drag(page,1,2);await drag(page,2,1);
  expect(await state(page)).toHaveLength(6);
  expect(await page.evaluate(()=>(window as any).timber.editor.selectedPieces.map((p:any)=>p.position))).toEqual([[-3,2.1,1],[3,2.1,1]]);
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#axis-copy-toggle')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#undo').click();expect(await state(page)).toHaveLength(4);
  await page.locator('#undo').click();expect(await state(page)).toEqual([[-3,.1,0],[3,.1,0]]);
});

test('unchanged snapped copy previews skip repeated validation and redraw',async({page})=>{
  await setup(page,true);await page.locator('#axis-copy-toggle').check();
  await page.evaluate(()=>{
    const e=(window as any).timber.editor,check=e.world.placementIssue.bind(e.world),draw=e.view.showGroupGhosts.bind(e.view);
    (window as any).copyWork={checks:0,draws:0};
    e.world.placementIssue=(...args:any[])=>{(window as any).copyWork.checks++;return check(...args);};
    e.view.showGroupGhosts=(...args:any[])=>{(window as any).copyWork.draws++;return draw(...args);};
  });
  const points=await drag(page,1,2,false);
  const before=await page.evaluate(()=>(window as any).copyWork);
  await page.evaluate(([x,y])=>{
    const canvas=(window as any).timber.editor.view.renderer.domElement;
    for(let i=0;i<8;i++) canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x,clientY:y,bubbles:true}));
  },points[1]);
  expect(await page.evaluate(()=>(window as any).copyWork)).toEqual(before);
  await page.mouse.up();expect(await state(page)).toHaveLength(4);
});

test('copying a group preserves internal overlap rules when the originals overlap',async({page})=>{
  await setup(page,true);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([
      {id:'a',item:'small-floor',wood:'oak',position:[0,.5,0],rotation:[0,0,0]},
      {id:'b',item:'small-floor',wood:'birch',position:[1,.5,0],rotation:[0,0,0]},
    ],[12]);e.pickSelections(['a','b']);
  });
  await page.locator('#axis-copy-toggle').check();await drag(page,1,2);
  expect(await state(page)).toEqual([[0,.5,0],[1,.5,0]]);
  await expect(page.locator('#toast')).toContainText('overlap');
  await page.locator('#overlap-toggle').check();await drag(page,1,2);expect(await state(page)).toHaveLength(4);
});

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
