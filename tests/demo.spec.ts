import {test,expect} from '@playwright/test';
import {openMenu} from './ui-helpers';

test('fresh workshop is editable, wired and walkable, with a clean opening view',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await expect(page.locator('#piece-count')).toHaveText('307 pieces');
 await expect(page.locator('#project-name')).toHaveValue('Timber Workshop');
 for(const id of ['build-panel','edit-panel','project-menu'])await expect(page.locator('#'+id)).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('starter-worklight'))).toBe(true);
 await page.waitForTimeout(800);await page.screenshot({path:'artifacts/starter-workshop.png'});
 await page.evaluate(()=>{const c=(window as any).timber.editor.view.camera;c.camera.position.set(22,14,34);c.controls.target.set(0,7,0);c.controls.update();});
 await page.waitForTimeout(500);await page.screenshot({path:'artifacts/starter-workshop-front.png'});
 await page.evaluate(()=>{const e=(window as any).timber.editor,c=e.view.camera;c.camera.position.set(0,7,6);c.controls.target.set(-2,6,-7);c.controls.update();});
 await page.waitForTimeout(500);await page.screenshot({path:'artifacts/starter-workshop-interior.png'});
 await page.evaluate(()=>{const c=(window as any).timber.editor.view.camera;c.camera.position.set(0,6,19);c.controls.target.set(0,6,0);c.controls.update();c.setWalking(true);c.yaw=0;c.walker.position.set(0,0,19);c.walker.velocity.set(0,0,0);c.walker.grounded=true;});
 await page.locator('#viewport>canvas').focus();await page.keyboard.down('w');
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.camera.walker.position.z)).toBeLessThan(-2);
 await page.keyboard.up('w');
 expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.walker.position.y)).toBeCloseTo(2);
 await page.evaluate(()=>{const e=(window as any).timber.editor,p=e.world.pieces.get('starter-switch');e.world.execute([{before:p,after:{...p,logicOn:false}}]);});
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('starter-worklight'))).toBe(false);
 expect(errors).toEqual([]);
});

test('saved projects survive startup and both example controls load the complete workshop only on confirmation',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 const fixture={version:1,name:'Saved custom project',plots:[12],pieces:[{id:'saved-floor',item:'floor',wood:'cherry',position:[0,.5,0],rotation:[0,0,0]}]};
 await page.locator('#file-input').setInputFiles({name:'fixture.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.locator('#confirm-action').click();await expect(page.locator('#save-state')).toHaveText('Saved on this device');
 await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 await expect(page.locator('#piece-count')).toHaveText('1 pieces');await expect(page.locator('#project-name')).toHaveValue(fixture.name);
 await openMenu(page);await page.locator('#example').click();await page.locator('#cancel-action').click();
 await expect(page.locator('#piece-count')).toHaveText('1 pieces');
 await openMenu(page);await page.locator('#example').click();await page.locator('#confirm-action').click();
 await expect(page.locator('#piece-count')).toHaveText('307 pieces');
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('starter-worklight'))).toBe(true);
 await openMenu(page);await page.locator('#settings').click();await page.locator('#load-demo').click();await page.locator('#confirm-action').click();
 expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(1);
 await expect(page.locator('#project-name')).toHaveValue('Timber Workshop');
 await openMenu(page);await page.locator('#new').click();await page.locator('#confirm-action').click();
 await expect(page.locator('#piece-count')).toHaveText('0 pieces');
 expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(0);
});

test('workshop menu and welcome view fit compact screens',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 const projected=await page.evaluate(async()=>{const {Vector3}=await import('/node_modules/three/build/three.module.js');const c=(window as any).timber.editor.view.camera.camera;return [[-20,0,-20],[-20,0,20],[20,0,-20],[20,0,20],[0,17,0]].map(p=>new Vector3(...p).project(c).toArray());});
 for(const [x,y] of projected){expect(Math.abs(x)).toBeLessThan(1);expect(Math.abs(y)).toBeLessThan(1);}
 await openMenu(page);
 for(const selector of ['#project-menu','#example','#settings','#help']){
  const b=(await page.locator(selector).boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(390);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(844);
 }
 await page.locator('#menu-tool').click();await page.waitForTimeout(600);await page.screenshot({path:'artifacts/starter-workshop-mobile.png'});
});
