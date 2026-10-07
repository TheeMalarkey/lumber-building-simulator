import {test, expect, type Page} from '@playwright/test';
import {openBuild,openWire} from './ui-helpers';

async function setup(page:Page) {
  await page.goto('/');
  await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;
    e.world.load([
      {id:'lever',item:'lever',position:[-2,.75,0],rotation:[0,0,0],wood:'oak'},
      {id:'button',item:'button',position:[2,.25,0],rotation:[0,0,0],wood:'oak'},
      {id:'lamp',item:'lamp',position:[7,1.5,0],rotation:[0,0,0],wood:'oak',lightOn:false},
    ],[12],[{id:'wire',from:{piece:'button',port:'out'},to:{piece:'lamp',port:'in'},points:[]}]);
    e.pickSelection(null);e.view.sync(true);e.view.grid.visible=false;
    e.view.camera.controls.enableDamping=false;
    e.view.camera.camera.position.set(3.8,5.4,8.5);
    e.view.camera.controls.target.set(0,.5,0);e.view.camera.controls.update();
  });
}

async function point(page:Page,position:number[]) {
  return page.evaluate(async position=>{
    const {Vector3}=await import('/node_modules/three/build/three.module.js');
    const e=(window as any).timber.editor,camera=e.view.camera.camera;
    camera.updateMatrixWorld();
    const r=e.view.renderer.domElement.getBoundingClientRect(),p=new Vector3(...position).project(camera);
    return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2] as [number,number];
  },position);
}

test('hovering either lever pose toggles with E without selecting or raising the camera',async({page})=>{
  await setup(page);
  const y=await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.y);
  await page.mouse.move(...await point(page,[-2+.693,1.093,0]));
  await expect(page.locator('#logic-hover')).toContainText('Switch on');
  await page.keyboard.down('e');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.pieces.get('lever').logicOn)).toBe(true);
  // The grip moves away from the pointer. Held E must still not turn into flight.
  await page.keyboard.down('e');await page.waitForTimeout(180);await page.keyboard.up('e');
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.y)).toBeCloseTo(y,5);
  expect(await page.evaluate(()=>(window as any).timber.editor.selection.size)).toBe(0);
  await page.mouse.move(...await point(page,[-2-.693,1.093,0]));
  await expect(page.locator('#logic-hover')).toContainText('Switch off');
  await page.screenshot({path:'artifacts/logic-hover-controls.png'});
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.pieces.get('lever').logicOn)).toBe(false);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('lever').logicOn)).toBe(true);
  await page.mouse.move(...await point(page,[0,0,4]));
  await expect(page.locator('#logic-hover')).toBeHidden();
  await page.keyboard.down('e');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.y)).toBeGreaterThan(y+.2);
  await page.keyboard.up('e');
});

test('the orange button cap accepts a click or E and keeps its momentary pulse',async({page})=>{
  await setup(page);
  await page.mouse.move(...await point(page,[2,.5,0]));
  await expect(page.locator('#logic-hover')).toContainText('Press button');
  await expect(page.locator('#logic-hover')).toContainText('click');
  await page.mouse.click(...await point(page,[2,.5,0]));
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(true);
  expect(await page.evaluate(()=>(window as any).timber.editor.selection.size)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(false);
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(false);
  await page.mouse.dblclick(...await point(page,[2,.5,0]));
  expect(await page.evaluate(()=>(window as any).timber.editor.placing)).toBe(false);
});

test('housings, Ctrl-selection and drag gestures do not press the button',async({page})=>{
  await setup(page);
  await page.mouse.move(...await point(page,[2.75,.4,.3]));
  await expect(page.locator('#logic-hover')).toBeHidden();
  await page.mouse.click(...await point(page,[2.75,.4,.3]));
  await expect(page.locator('#piece-name')).toHaveText('Button');
  expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('button'))).toBe(false);
  await page.locator('#select-tool').click();
  await page.keyboard.down('Control');await page.mouse.click(...await point(page,[2,.5,0]));await page.keyboard.up('Control');
  expect(await page.evaluate(()=>[...(window as any).timber.editor.selection])).toEqual(['button']);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('button'))).toBe(false);
  await page.locator('#select-tool').click();
  await page.mouse.move(...await point(page,[2,.5,0]));await page.mouse.down();
  await page.mouse.move(...await point(page,[0,0,3]),{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('button'))).toBe(false);
  expect(await page.evaluate(()=>(window as any).timber.editor.selection.size)).toBe(0);
});

test('the first click on a button cap works after editing a text field',async({page})=>{
  await setup(page);
  await page.locator('#menu-tool').click();await page.locator('#project-name').focus();
  await page.mouse.move(...await point(page,[2,.5,0]));
  await expect(page.locator('#logic-hover')).toBeHidden();
  await page.mouse.click(...await point(page,[2,.5,0]));
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(true);
  expect(await page.evaluate(()=>(window as any).timber.editor.selection.size)).toBe(0);
});

test('hover respects occlusion and refreshes when pieces or the camera move',async({page})=>{
  await setup(page);
  const xy=await point(page,[2,.5,0]);await page.mouse.move(...xy);
  await expect(page.locator('#logic-hover')).toBeVisible();
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([{before:null,after:{id:'cover',item:'smooth-wall',position:[2,4,1.5],rotation:[0,0,0],wood:'oak'}}]);});
  await expect(page.locator('#logic-hover')).toBeHidden();
  await page.mouse.click(...xy);
  await expect(page.locator('#piece-name')).toHaveText('Smooth Wall');
  expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('button'))).toBe(false);
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.pickSelection(null);e.world.execute([{before:e.world.pieces.get('cover'),after:null}]);});
  await expect(page.locator('#logic-hover')).toBeVisible();
  await page.evaluate(()=>{const e=(window as any).timber.editor,p=e.world.pieces.get('button');e.world.execute([{before:p,after:{...p,position:[5,.25,0]}}]);});
  await expect(page.locator('#logic-hover')).toBeHidden();
  await page.mouse.move(...await point(page,[5,.5,0]));await expect(page.locator('#logic-hover')).toBeVisible();
  await page.evaluate(()=>{const c=(window as any).timber.editor.view.camera;c.camera.position.x+=6;c.controls.target.x+=6;c.controls.update();});
  await expect(page.locator('#logic-hover')).toBeHidden();
});

test('walk mode operates hovered rotated handles and caps without a selection',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    const e=(window as any).timber.editor,p=e.world.pieces.get('lever');
    e.world.execute([{before:p,after:{...p,position:[-2,1.5,0],rotation:[0,0,1]}}]);
    const c=e.view.camera;c.setWalking(true);c.walker.position.set(0,0,6);c.walker.velocity.set(0,0,0);
    c.walker.grounded=true;c.yaw=0;c.pitch=-.4;c.walkDistance=0;
  });
  await page.waitForTimeout(80);
  // A wall-mounted lever's local X/Y coordinates turn with the entire piece.
  await page.mouse.move(...await point(page,[-2-(1.093-.75),1.5+.693,.421]));
  await expect(page.locator('#logic-hover')).toContainText('Switch on');
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.pieces.get('lever').logicOn)).toBe(true);
  await page.mouse.move(...await point(page,[2,.5,0]));
  await expect(page.locator('#logic-hover')).toContainText('Press button');
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(true);
  expect(await page.evaluate(()=>(window as any).timber.editor.selection.size)).toBe(0);
});

test('building, wiring, camera drags and UI controls retain their normal input',async({page})=>{
  await setup(page);
  await page.mouse.move(...await point(page,[-2+.693,1.093,0]));
  await expect(page.locator('#logic-hover')).toBeVisible();
  await page.mouse.down({button:'right'});await expect(page.locator('#logic-hover')).toBeHidden();await page.mouse.up({button:'right'});
  await openWire(page);
  await page.locator('#collapse').click();
  await page.mouse.move(...await point(page,[2,.5,0]));await expect(page.locator('#logic-hover')).toBeHidden();
  await page.mouse.click(...await point(page,[2,.5,0]));
  expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('button'))).toBe(false);
  await page.locator('#select-tool').click();
  await openBuild(page);await page.locator('[data-category="Logic"]').click();await page.locator('[data-item="button"]').click();await page.locator('#collapse').click();
  await page.mouse.move(...await point(page,[2,.5,0]));await expect(page.locator('#logic-hover')).toBeHidden();
  await page.locator('#select-tool').click();
  await page.mouse.move(...await point(page,[2,.5,0]));await expect(page.locator('#logic-hover')).toBeVisible();
  await page.locator('#menu-tool').click();await page.locator('#project-name').focus();
  await page.mouse.move(...await point(page,[2,.5,0]));await page.keyboard.press('e');
  await expect(page.locator('#logic-hover')).toBeHidden();
  expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.output('button'))).toBe(false);
});
