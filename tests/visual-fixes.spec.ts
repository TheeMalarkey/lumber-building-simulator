import {test,expect} from '@playwright/test';
test('open door copies retain their requested pose',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'door',item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0],doorOpen:true}],[12]);e.pickSelection('door');e.move(true);});
 await page.mouse.move(700,600);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.doorOpen)).toBe(true);
});
test('phone catalog and palette do not cover one another',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.locator('#build-tool').click();await page.locator('[data-item="smooth-wall"]').click();await page.locator('#wood-toggle').click();
 const catalog=await page.locator('#build-panel').boundingBox(),inspector=await page.locator('#edit-panel').boundingBox();
 expect(catalog!.y+catalog!.height).toBeLessThanOrEqual(inspector!.y);
 await expect(page.locator('[data-wood="oak"]')).toBeVisible();
});
test('open and closed doors keep distinct group preview geometry',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 const batches=await page.evaluate(()=>{const v=(window as any).timber.editor.view;const base={item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0]};v.showGroupGhosts([{...base,id:'open',doorOpen:true},{...base,id:'closed',position:[10,4,0],doorOpen:false}]);return v.groupGhosts.children.map((m:any)=>{m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;return {key:m.name,width:b.max.x-b.min.x,depth:b.max.z-b.min.z}})});
 expect(batches).toHaveLength(2);
 expect(batches.find((b:any)=>b.key.endsWith('|true')).depth).toBeGreaterThan(3.9);
 expect(batches.find((b:any)=>b.key.endsWith('|false')).width).toBeGreaterThan(3.9);
});
