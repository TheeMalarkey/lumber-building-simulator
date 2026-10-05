import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';

// Production acceptance uses public settings, pointer controls and rendered pixels.
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 const settings=async()=>{await page.locator('#menu-tool').click();await page.locator('#settings').click();};
 await settings();const slider=page.getByRole('slider',{name:'Camera move speed'});await expect(slider).toHaveValue('3');
 await slider.focus();await page.keyboard.press('Home');await expect(slider).toHaveValue('1');await expect(page.locator('#camera-speed-value')).toHaveText('1 / 5');
 await page.keyboard.press('End');await expect(slider).toHaveValue('5');await expect(page.locator('#camera-speed-value')).toHaveText('5 / 5');
 mkdirSync('release/pages-verification',{recursive:true});await page.screenshot({path:'release/pages-verification/camera-settings-live.png'});
 await page.setViewportSize({width:390,height:844});await expect(slider).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await settings();await expect(slider).toHaveValue('5');await page.locator('#close-modal').click();await page.setViewportSize({width:1440,height:960});
 const fixture={version:1,name:'Camera controls check',plots:[12],pieces:[{id:'wall',item:'smooth-wall',wood:'oak',position:[0,4,0],rotation:[0,0,0]}]};
 await page.locator('#file-input').setInputFiles({name:'camera-check.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('#confirm-action').click();await page.locator('#select-tool').click();await page.locator('#home').click();
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
 await page.screenshot({path:'release/pages-verification/camera-before-pan.png'});
 const crop={x:400,y:150,width:640,height:600},before=await page.screenshot({clip:crop});
 await page.mouse.move(720,450);await page.keyboard.down('Shift');await page.mouse.down({button:'right'});await page.mouse.move(820,500,{steps:8});await page.mouse.up({button:'right'});await page.keyboard.up('Shift');
 await page.screenshot({path:'release/pages-verification/camera-after-pan.png'});const panned=await page.screenshot({clip:crop});expect(panned.equals(before)).toBe(false);
 await page.mouse.down({button:'right'});await page.mouse.move(860,510,{steps:4});await page.mouse.up({button:'right'});expect((await page.screenshot({clip:crop})).equals(panned)).toBe(false);
 await expect(page.locator('#piece-count')).toHaveText('1 pieces');expect(errors).toEqual([]);
 writeFileSync('release/pages-verification/camera-live.json',JSON.stringify({target,errors,debugAPI:false,sliderRange:[1,5],defaultLevel:3,speedPersists:true,panChangesView:true,rightLook:true,compactFits:true},null,2));
 console.log('Production camera: speed slider, saved preference, Shift-right pan, normal right-look, compact settings and WebGL checks passed.');
}finally{await browser.close();}
