import {test,expect} from '@playwright/test';
for(const item of ['worklight','lamp','floor-lamp','wall-light','floodlight'])test(`walking near a lone ${item} keeps shaded surfaces rendering`,async({page})=>{
 const errors:string[]=[];
 page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate((item)=>{const e=(window as any).timber.editor;e.world.load([{id:'light',item,wood:'oak',position:[0,1.5,0],rotation:[0,0,0]}],[12]);e.view.sync(true);e.view.adaptive=false;},item);
 await page.locator('#walk-tool').click();
 await page.keyboard.down('w');await page.waitForTimeout(800);await page.keyboard.up('w');
 for(const quality of ['performance','balanced','quality']){
  await page.evaluate(q=>(window as any).timber.editor.view.setQuality(q),quality);
  await page.waitForTimeout(300);
 }
 await page.keyboard.press('c');
 for(const x of [200,0,-70,0]){
  await page.evaluate(x=>{const v=(window as any).timber.editor.view;v.camera.camera.position.set(x,8,15);v.camera.controls.target.set(x,1,0);v.camera.controls.update();},x);
  await page.waitForTimeout(300);
 }
 if(item==='worklight')await page.screenshot({path:'artifacts/lighting-walk-regression.png'});
 expect(errors).toEqual([]);
});
