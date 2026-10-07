import {expect,test} from '@playwright/test';
import {openBuild} from './ui-helpers';
test('lighting catalog, grouped switching, single copy, saved state and night preview work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await openBuild(page);await page.locator('[data-category="Lighting"]').click();await expect(page.locator('.catalog-card')).toHaveCount(5);
 await page.locator('[data-item="lamp"]').click();await expect(page.locator('#wood-picker')).toBeHidden();
 await page.evaluate(()=>{
  const e=(window as any).timber.editor;
  const specs=[['wall-light',-9,6,0],['floodlight',-4,6,0],['lamp',1,1.5,0],['floor-lamp',5,3,0],['worklight',10,1.5,0]];
  e.world.load([...specs.map(([item,x,y,z],i)=>({id:'l'+i,item,wood:'oak',position:[x,y,z],rotation:[0,0,0]})),
   {id:'floor',item:'large-tile',wood:'birch',position:[4,.1,6],rotation:[0,0,0]},
   {id:'wall',item:'fat-door',wood:'birch',position:[-7,4,-2],rotation:[0,0,0]}],[12]);
  e.view.sync(true);e.pickSelections(['l0','l1','l2','l3','l4']);e.view.setNight(true);
  e.view.camera.camera.position.set(18,13,26);e.view.camera.controls.target.set(0,3,1);e.view.camera.controls.update();
 });
 await expect(page.locator('#light-toggle')).toBeChecked();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.fixtureLighting.activeIds.length)).toBe(6);
 await page.locator('#light-toggle').uncheck();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.fixtureLighting.activeIds.length)).toBe(0);
 await page.locator('#undo').click();await expect(page.locator('#light-toggle')).toBeChecked();
 await page.locator('#redo').click();await expect(page.locator('#light-toggle')).not.toBeChecked();
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('l2'));
 await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();
 for(let i=0;i<5;i++)await page.locator('[data-nudge="up"]').click();
 await page.locator('#commit-preview').click();
 expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].filter((p:any)=>p.item==='lamp').every((p:any)=>p.lightOn===false))).toBe(true);
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 expect(await page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()].filter((p:any)=>p.item==='lamp').every((p:any)=>p.lightOn===false))).toBe(true);
 await page.locator('#menu-tool').click();await page.locator('#settings').click();await page.locator('#night-preview').check();await page.locator('#close-modal').click();
 await page.evaluate(()=>{
  const e=(window as any).timber.editor;e.pickSelections(['l0','l1','l2','l3','l4']);
  e.view.camera.camera.position.set(18,13,26);e.view.camera.controls.target.set(0,3,1);e.view.camera.controls.update();
 });
 await page.locator('#light-toggle').check();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.fixtureLighting.activeIds.length)).toBe(6);
 await page.evaluate(()=>{
   const e=(window as any).timber.editor;e.pickSelection(null);
   e.world.load([...e.world.pieces.values()].filter((p:any)=>p.id.startsWith('l')||p.id==='floor'||p.id==='wall'),[12]);e.view.sync(true);
 });
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await page.screenshot({path:'artifacts/lighting-night.png'});
 await page.evaluate(()=>{
  const e=(window as any).timber.editor;e.view.setNight(false);
  e.world.load([{id:'work',item:'worklight',wood:'oak',lightOn:false,position:[0,1.5,0],rotation:[0,0,0]}],[12]);e.view.sync(true);
  e.view.camera.camera.position.set(4,3.5,6);e.view.camera.controls.target.set(0,1.4,0);e.view.camera.controls.update();
 });
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 await page.screenshot({path:'artifacts/worklight-detail.png'});
 await page.setViewportSize({width:390,height:844});await openBuild(page);await page.locator('[data-category="Lighting"]').click();
 await expect(page.locator('.catalog-card')).toHaveCount(5);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
