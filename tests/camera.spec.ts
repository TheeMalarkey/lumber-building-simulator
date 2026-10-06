import {test,expect,type Page} from '@playwright/test';

async function setup(page:Page){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12]);e.pickSelection(null);e.view.camera.controls.enableDamping=false;e.view.camera.home();});
}
const state=(page:Page)=>page.evaluate(()=>{const e=(window as any).timber.editor,c=e.view.camera;return {position:c.camera.position.toArray(),target:c.controls.target.toArray(),rotation:c.camera.quaternion.toArray(),flying:c.flying,pieces:e.world.pieces.size};});
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('retired orbit gestures cannot rotate the camera while wheel zoom remains available',async({page})=>{
 await setup(page);await page.mouse.move(720,450);const before=await state(page);
 await page.keyboard.press('o');await page.mouse.down({button:'middle'});await page.mouse.move(870,530,{steps:6});await page.mouse.up({button:'middle'});
 const after=await state(page);expect(distance(after.position,before.position)).toBeLessThan(.000001);expect(distance(after.rotation,before.rotation)).toBeLessThan(.000001);
 await page.mouse.wheel(0,240);
 await expect.poll(async()=>distance((await state(page)).position,after.position)).toBeGreaterThan(1);
});

test('Shift right-drag pans in screen space while right-drag still looks around',async({page})=>{
 await setup(page);await page.mouse.move(720,450);const before=await state(page);
 await page.keyboard.down('Shift');await page.mouse.down({button:'right'});await page.mouse.move(870,530,{steps:6});await page.mouse.up({button:'right'});await page.keyboard.up('Shift');
 const panned=await state(page);expect(distance(panned.position,before.position)).toBeGreaterThan(1);
 expect(distance(panned.rotation,before.rotation)).toBeLessThan(.000001);
 for(let i=0;i<3;i++)expect(panned.position[i]-before.position[i]).toBeCloseTo(panned.target[i]-before.target[i],5);
 expect(panned.flying).toBe(false);expect(panned.pieces).toBe(0);
 await page.mouse.down({button:'right'});await page.mouse.move(920,560,{steps:4});await page.mouse.up({button:'right'});
 expect(distance((await state(page)).rotation,panned.rotation)).toBeGreaterThan(.01);
});

test('Shift can engage pan during a right drag and blur releases camera capture',async({page})=>{
 await setup(page);await page.mouse.move(720,450);await page.mouse.down({button:'right'});await page.keyboard.down('Shift');
 const before=await state(page);await page.mouse.move(820,450,{steps:4});const panned=await state(page);
 expect(distance(panned.position,before.position)).toBeGreaterThan(1);expect(distance(panned.rotation,before.rotation)).toBeLessThan(.000001);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect((await state(page)).flying).toBe(false);
 await page.mouse.move(860,480);expect(distance((await state(page)).position,panned.position)).toBeLessThan(.000001);
 await page.mouse.up({button:'right'});await page.keyboard.up('Shift');
});

test('camera speed slider changes real movement from levels 1 to 5 and persists',async({page})=>{
 await setup(page);
 const settings=async()=>{await page.locator('#menu-tool').click();await page.locator('#settings').click();};
 await settings();const slider=page.getByRole('slider',{name:'Camera move speed'});await expect(slider).toHaveValue('3');
 await slider.focus();await page.keyboard.press('Home');await expect(slider).toHaveValue('1');await expect(page.locator('#camera-speed-value')).toHaveText('1 / 5');await page.locator('#close-modal').click();
 const step=()=>page.evaluate(()=>{const c=(window as any).timber.editor.view.camera;c.keys.clear();c.camera.updateMatrixWorld();const before=c.camera.position.clone();c.keys.add('KeyW');c.update(.25);c.keys.clear();return c.camera.position.distanceTo(before);});
 expect(await step()).toBeCloseTo(2,5);
 await settings();await slider.focus();await page.keyboard.press('End');await expect(slider).toHaveValue('5');await expect(page.locator('#camera-speed-value')).toHaveText('5 / 5');await page.locator('#close-modal').click();
 expect(await step()).toBeCloseTo(10,5);
 await page.reload();await page.waitForFunction(()=>!!(window as any).timber);await settings();await expect(slider).toHaveValue('5');
 await page.setViewportSize({width:390,height:844});await expect(slider).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('right-drag wheel speed remains within the same slider range',async({page})=>{
 await setup(page);await page.mouse.move(720,450);await page.mouse.down({button:'right'});
 for(let i=0;i<7;i++)await page.mouse.wheel(0,-120);
 await page.mouse.up({button:'right'});await page.locator('#menu-tool').click();await page.locator('#settings').click();await expect(page.locator('#camera-speed')).toHaveValue('5');await page.locator('#close-modal').click();
 await page.mouse.move(720,450);await page.mouse.down({button:'right'});for(let i=0;i<7;i++)await page.mouse.wheel(0,120);
 await page.mouse.up({button:'right'});await page.locator('#menu-tool').click();await page.locator('#settings').click();await expect(page.locator('#camera-speed')).toHaveValue('1');
});
