import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 const fixture=[{id:'lever',item:'lever',wood:'oak',position:[-6,1,0],rotation:[0,0,0]},
  {id:'gate',item:'signal-inverter',wood:'oak',position:[0,.5,0],rotation:[0,0,0]},
  {id:'light',item:'worklight',wood:'oak',position:[6,1.5,0],rotation:[0,0,0],lightOn:false}];
 await page.locator('#menu-tool').click();await page.locator('#file-input').setInputFiles({name:'logic-check.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,name:'Logic check',plots:[12],pieces:fixture}))});await page.locator('#confirm-action').click();
 if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();
 await page.locator('#build-tool').click();await page.locator('[data-category="Logic"]').click();await expect(page.locator('#catalog-total')).toHaveText('100');await expect(page.locator('.catalog-card')).toHaveCount(12);
 for(const [id,size] of [['signal-delay','2 × 2 × 2'],['signal-sustain','2 × 2 × 2'],['signal-inverter','2 × 1 × 1']])await expect(page.locator(`[data-item="${id}"] .card-size`)).toHaveText(size);
 await page.locator('#select-tool').click();
 const rect=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
 const xy=p=>{const v=new Vector3(...p).project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
 const select=async(position,name)=>{await page.mouse.click(...xy(position));await expect(page.locator('#piece-name')).toHaveText(name);};
 await select([-6,.3,0],'Lever');await page.locator('[data-port="out"]').click();await page.mouse.click(...xy([-1,.25,0]));
 await page.mouse.click(...xy([1,.25,0]));await page.mouse.click(...xy([4.69,2.05,.05]));await expect(page.locator('#wire-count')).toContainText('2 wires');await page.locator('#wire-done').click();
 await select([6,2,0],'Worklight');await expect(page.locator('#light-toggle')).toBeDisabled();await expect(page.locator('#light-toggle')).toBeChecked();
 await select([-6,.3,0],'Lever');await page.locator('#logic-action').click();await expect(page.locator('#logic-status')).toHaveText('Output · On');
 await select([6,2,0],'Worklight');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · Off');await expect(page.locator('#light-toggle')).not.toBeChecked();
 const exported=async()=>{await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString());};
 const saved=await exported();expect(saved.wires).toHaveLength(2);expect(saved.pieces.find(p=>p.id==='lever').logicOn).toBe(true);
 expect(saved.logicModelVersion).toBe(3);expect(saved.pieces.find(p=>p.id==='lever').position).toEqual([-6,.75,0]);
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 expect((await exported()).wires).toEqual(saved.wires);await page.locator('#select-tool').click();await select([6,2,0],'Worklight');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · Off');
 await select([-6,.3,0],'Lever');await page.locator('#delete-tool').click();const afterDelete=await exported();expect(afterDelete.wires).toHaveLength(1);await page.locator('#undo').click();expect((await exported()).wires).toHaveLength(2);
 await page.locator('#select-tool').click();await page.locator('#build-tool').click();await page.locator('[data-category="Logic"]').click();
 mkdirSync('release/pages-verification',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'release/pages-verification/logic-live.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-item="lever"]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#wire-tool').click();await expect(page.locator('#wiring-panel')).toBeVisible();await page.locator('#select-tool').click();await expect(page.locator('#wiring-panel')).toBeHidden();
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/logic-live.json',JSON.stringify({target,errors,debugAPI:false,catalog:12,total:100,wiring:true,logicDrivenLight:true,savedSwitch:true,exportReload:true,deleteUndo:true,compactFits:true,modeExit:true},null,2));
 console.log('Production logic: catalog, socket wiring, controlled Worklight, export/reload, delete/undo, compact controls and Wire mode exit passed.');
}finally{await browser.close();}
