import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

// Fresh visitors, public editing and saved-project acceptance; no dev API.
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 const ready=async()=>page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.goto(target);await ready();expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 await expect(page.locator('#piece-count')).toHaveText('307 pieces');
 for(const id of ['build-panel','edit-panel','project-menu'])await expect(page.locator('#'+id)).toBeHidden();
 const menu=async()=>{if(!await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();};
 const exported=async()=>{await menu();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const result=JSON.parse(Buffer.concat(chunks).toString());if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();return result;};
 const starter=await exported();expect(starter.name).toBe('Timber Workshop');expect(starter.plots).toEqual([12]);expect(starter.wires).toHaveLength(1);expect(starter.logicModelVersion).toBe(3);
 expect(starter.pieces.find(p=>p.id==='starter-switch').logicOn).toBe(true);expect(starter.wires[0].from).toEqual({piece:'starter-switch',port:'out'});expect(starter.wires[0].to).toEqual({piece:'starter-worklight',port:'in'});
 expect(starter.pieces.filter(p=>p.id.startsWith('starter-roof'))).toHaveLength(56);
 mkdirSync('release/pages-verification',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'release/pages-verification/starter-workshop-live.png'});
 const rect=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);camera.position.set(-34,24,42);camera.lookAt(-1,7,0);camera.updateMatrixWorld();
 const xy=p=>{const v=new Vector3(...p).project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
 await page.locator('#select-tool').click();await page.mouse.click(...xy([-2,1.5,15]));await expect(page.locator('#piece-name')).toHaveText('Stairs');
 await page.locator('#delete-tool').click();expect((await exported()).pieces).toHaveLength(306);await page.keyboard.press('Control+z');
 const byId=pieces=>[...pieces].sort((a,b)=>a.id.localeCompare(b.id));expect(byId((await exported()).pieces)).toEqual(byId(starter.pieces));
 const fixture={version:1,name:'Saved custom build',plots:[12],pieces:[{id:'saved-floor',item:'floor',wood:'cherry',position:[0,.5,0],rotation:[0,0,0]}]};
 await page.locator('#file-input').setInputFiles({name:'saved.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('#confirm-action').click();await expect(page.locator('#save-state')).toHaveText('Saved on this device');
 await page.reload();await ready();expect(await exported()).toEqual(fixture);
 await menu();await page.locator('#example').click();await page.locator('#cancel-action').click();expect(await exported()).toEqual(fixture);
 await menu();await page.locator('#example').click();await page.locator('#confirm-action').click();expect(await exported()).toEqual(starter);
 await menu();await page.locator('#settings').click();await page.locator('#load-demo').click();await page.locator('#confirm-action').click();expect(await exported()).toEqual(starter);
 await menu();await page.locator('#new').click();await page.locator('#confirm-action').click();const blank=await exported();expect(blank.pieces).toHaveLength(0);expect(blank.wires??[]).toHaveLength(0);
 const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
 await mobile.goto(target);await mobile.waitForFunction(()=>document.documentElement.dataset.ready==='true');await expect(mobile.locator('#piece-count')).toHaveText('307 pieces');await mobile.locator('#menu-tool').click();
 for(const id of ['project-menu','example','settings','help']){const r=await mobile.locator('#'+id).boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(390);expect(r.y+r.height).toBeLessThanOrEqual(844);}
 await mobile.locator('#menu-tool').click();await mobile.screenshot({path:'release/pages-verification/starter-workshop-mobile-live.png'});
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/starter-workshop-live.json',JSON.stringify({target,errors,debugAPI:false,freshStarter:true,editableStairs:true,undo:true,savedProjectsPreserved:true,confirmedExampleLoading:true,wiredExampleInBothControls:true,blankNewProject:true,compactFits:true},null,2));
 console.log('Production workshop: fresh scene, public selection/delete/undo, saved-project preservation, both example controls and compact layout passed.');
}finally{await browser.close();}
