import {test,expect} from '@playwright/test';
test('transport controls, reference views and reset preserve authored wood',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'belt1',item:'straight-conveyor',wood:'oak',position:[0,.5,0],rotation:[0,0,0]},
  {id:'belt2',item:'straight-conveyor',wood:'oak',position:[0,.5,8],rotation:[0,0,0]},
  {id:'wood',item:'loose-plank',wood:'oak',position:[0,1.5,-1],rotation:[0,0,0]},
 ],[12]);e.pickSelection(null);});
 for(const [name,pos] of [['three-quarter',[12,10,18]],['side',[13,3,3]],['top',[.01,22,4]],['low',[10,.7,12]]] as const){
  await page.evaluate(pos=>{const v=(window as any).timber.editor.view;v.camera.camera.position.set(...pos);v.camera.controls.target.set(0,.5,4);v.camera.controls.update();v.sync(true);},pos);
  await page.waitForTimeout(200);await page.screenshot({path:`release/conveyor-${name}.png`});
 }
 await page.locator('#transport-run').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood')?.position.z),{timeout:10000}).toBeGreaterThan(2);
 await page.locator('#transport-run').click();await expect(page.locator('#transport-run')).toHaveText('Resume wood');
 const paused=await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position.z);await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position.z)).toBe(paused);
 await page.locator('#transport-reset').click();
 expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('wood').position)).toEqual([0,1.5,-1]);
 await page.locator('#transport-run').click();await page.evaluate(()=>{const e=(window as any).timber.editor,p=e.world.pieces.get('wood');e.world.execute([{before:p,after:{...p,position:[0,3,-1]}}]);});await expect(page.locator('#transport-run')).toHaveText('Test wood');
 await page.locator('#transport-run').click();await page.evaluate(()=>{const w=(window as any).timber.editor.world;w.plots=[12,13];w.revision++;});await expect(page.locator('#transport-run')).toHaveText('Test wood');
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('belt1'));await expect(page.locator('#logic-action')).toHaveText('Reverse direction');await page.locator('#logic-action').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('belt1').logicOn)).toBe(true);
 await page.locator('#build-tool').click();await page.locator('#search').fill('conveyor');await expect(page.locator('[data-item="straight-conveyor"]')).toBeVisible();
 expect(errors).toEqual([]);
});
