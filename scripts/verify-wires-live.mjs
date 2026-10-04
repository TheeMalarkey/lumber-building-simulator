import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

// Release acceptance uses only public controls, import/export and pixels.
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 const load=async fixture=>{await page.locator('#file-input').setInputFiles({name:'wire-check.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('#confirm-action').click();await page.locator('#select-tool').click();await page.locator('#home').click();};
 await load({version:1,name:'Wire placement check',plots:[12],pieces:[]});
 const rect=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
 const xy=p=>{const v=new Vector3(...p).project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
 await page.locator('#wire-tool').click();await page.locator('[data-wire-kind="neon"]').click();await expect(page.locator('[data-wire-color]')).toHaveCount(9);await page.locator('[data-wire-color="cyan"]').click();
 await page.mouse.click(...xy([-8,0,-8]));await page.mouse.click(...xy([9,0,-8]));await expect(page.locator('#wire-feedback')).toContainText('16');await expect(page.locator('#wire-count')).toContainText('0 wires');
 await page.mouse.click(...xy([7.5,0,-8]));await page.keyboard.press('Enter');await expect(page.locator('#wire-count')).toContainText('1 wires');
 await page.locator('[data-wire-kind="wire"]').click();await page.mouse.click(...xy([-9,0,8]));await page.mouse.click(...xy([12,0,8]));await expect(page.locator('#wire-feedback')).toContainText('20');await page.mouse.click(...xy([9,0,8]));await page.locator('#wire-finish').click();await expect(page.locator('#wire-count')).toContainText('2 wires');
 await page.locator('#wire-done').click();
 const exported=async()=>{await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const result=JSON.parse(Buffer.concat(chunks).toString());if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();return result;};
 const saved=await exported();expect(saved.wires).toHaveLength(2);expect(saved.wires[0].kind).toBe('neon');expect(saved.wires[0].color).toBe('cyan');expect(saved.wires[1].kind).toBe('wire');
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect((await exported()).wires).toEqual(saved.wires);
 const fixture={version:1,logicModelVersion:3,name:'Neon signal check',plots:[12],pieces:[{id:'l',item:'lever',wood:'oak',position:[-5,.75,0],rotation:[0,0,0],logicOn:false}],wires:[{id:'n',kind:'neon',color:'pink',from:{piece:'l',port:'out'},to:{point:[5,.18,0]},points:[]}]};
 await load(fixture);await page.mouse.click(...xy([-5,.25,0]));await expect(page.locator('#piece-name')).toHaveText('Lever');await page.locator('#logic-action').click();await expect(page.locator('#logic-status')).toHaveText('Output · On');expect((await exported()).pieces[0].logicOn).toBe(true);
 await page.locator('#wire-tool').click();await page.locator('[data-wire-kind="neon"]').click();await page.locator('[data-wire-color="pink"]').click();
 mkdirSync('release/pages-verification',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'release/pages-verification/wires-live.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#wire-done')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/wires-live.json',JSON.stringify({target,errors,debugAPI:false,regularLimit:20,neonLimit:16,neonColors:9,surfaceRouting:true,saveReload:true,leverSignal:true,compactFits:true},null,2));
 console.log('Production wires: both budgets, nine colors, surface routes, export/reload, switch state, compact layout and WebGL checks passed.');
}finally{await browser.close();}
