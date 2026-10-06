import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

async function openWire(page,kind='wire') {
 if(!await page.locator('#build-panel').isVisible())await page.locator('#build-tool').click();
 await page.locator('#search').fill('');await page.locator('[data-category="Wires"]').click();
 await page.locator(`[data-wire-item="${kind}"]`).click();
}

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
 await openWire(page,'neon');await expect(page.locator('[data-wire-color]')).toHaveCount(9);await page.locator('[data-wire-color="cyan"]').click();
 await page.mouse.click(...xy([-8,0,-8]));await page.mouse.click(...xy([9,0,-8]));await expect(page.locator('#wire-feedback')).toContainText('16');await expect(page.locator('#wire-count')).toContainText('0 wires');
 await page.mouse.click(...xy([7.5,0,-8]));await page.keyboard.press('Enter');await expect(page.locator('#wire-count')).toContainText('1 wires');
 await page.locator('[data-wire-kind="wire"]').click();await page.mouse.click(...xy([-9,0,8]));await page.mouse.click(...xy([12,0,8]));await expect(page.locator('#wire-feedback')).toContainText('20');await page.mouse.click(...xy([9,0,8]));await page.locator('#wire-finish').click();await expect(page.locator('#wire-count')).toContainText('2 wires');
 await page.locator('#wire-done').click();
 const exported=async()=>{await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const result=JSON.parse(Buffer.concat(chunks).toString());if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();return result;};
 const saved=await exported();expect(saved.wires).toHaveLength(2);expect(saved.wires[0].kind).toBe('neon');expect(saved.wires[0].color).toBe('cyan');expect(saved.wires[1].kind).toBe('wire');
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect((await exported()).wires).toEqual(saved.wires);
 await load({version:1,name:'Wire overpass check',plots:[12],pieces:[],wires:[{id:'host',kind:'neon',color:'cyan',from:{point:[-5,.155,0]},to:{point:[5,.155,0]},points:[]}]});
 await openWire(page);await page.mouse.click(...xy([0,0,-4]));await page.mouse.click(...xy([0,0,4]));
 await expect(page.locator('#wire-feedback')).toContainText('cannot pass through');await expect(page.locator('#wire-count')).toContainText('1 wires');
 await page.keyboard.down('Shift');await page.mouse.click(...xy([0,.155,0]));await page.keyboard.up('Shift');await page.mouse.click(...xy([0,0,4]));await page.keyboard.press('Enter');
 await expect(page.locator('#wire-count')).toContainText('2 wires');await page.locator('#wire-done').click();expect((await exported()).wires[1].points[0][1]).toBeGreaterThan(.4);
 await load({version:1,logicModelVersion:3,name:'Wire end contact check',plots:[12],pieces:[
  {id:'lever',item:'lever',wood:'oak',position:[-6,.75,0],rotation:[0,0,0],logicOn:true},
  {id:'body-light',item:'lamp',wood:'oak',position:[0,1,6],rotation:[0,0,0]},
  {id:'end-light',item:'lamp',wood:'oak',position:[7,1,6],rotation:[0,0,0]},
 ],wires:[{id:'host',kind:'wire',from:{piece:'lever',port:'out'},to:{point:[4,.18,0]},points:[]}]});
 await openWire(page);await page.mouse.click(...xy([0,.18,0]));await page.mouse.click(...xy([0,.6,6.22]));await expect(page.locator('#wire-count')).toContainText('2 wires');await page.locator('#wire-done').click();
 await page.mouse.click(...xy([0,.5,6]));await expect(page.locator('#piece-name')).toHaveText('Lamp');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · Off');
 await openWire(page);await page.mouse.click(...xy([3.95,.18,0]));await page.mouse.click(...xy([7,.6,6.22]));await expect(page.locator('#wire-count')).toContainText('3 wires');await page.locator('#wire-done').click();
 await page.mouse.click(...xy([7,.5,6]));await expect(page.locator('#piece-name')).toHaveText('Lamp');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · On');
 const fixture={version:1,logicModelVersion:3,name:'Neon signal check',plots:[12],pieces:[{id:'l',item:'lever',wood:'oak',position:[-5,.75,0],rotation:[0,0,0],logicOn:false}],wires:[{id:'n',kind:'neon',color:'pink',from:{piece:'l',port:'out'},to:{point:[5,.18,0]},points:[]}]};
 await load(fixture);await page.mouse.click(...xy([-5,.25,0]));await expect(page.locator('#piece-name')).toHaveText('Lever');await page.locator('#logic-action').click();await expect(page.locator('#logic-status')).toHaveText('Output · On');expect((await exported()).pieces[0].logicOn).toBe(true);
 await page.locator('#delete-tool').click();
 const detached=await exported();expect(detached.pieces).toHaveLength(0);expect(detached.wires).toHaveLength(1);expect(detached.wires[0].from.point).toHaveLength(3);expect(detached.wires[0].to).toEqual(fixture.wires[0].to);expect(detached.wires[0].color).toBe('pink');
 await page.keyboard.press('Control+z');expect((await exported()).wires[0].from).toEqual(fixture.wires[0].from);
 await page.keyboard.press('Control+Shift+z');expect((await exported()).wires).toEqual(detached.wires);
 await page.mouse.click(...xy([0,.18,0]));await expect(page.locator('#wire-selection-name')).toHaveText('Pink neon selected');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#delete-wire')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:960});
 mkdirSync('release/pages-verification',{recursive:true});await page.screenshot({path:'release/pages-verification/wire-selection-live.png'});
 await page.locator('#delete-wire').click();expect((await exported()).wires??[]).toHaveLength(0);
 await page.keyboard.press('Control+z');await page.mouse.click(...xy([0,.18,0]));await page.keyboard.press('Delete');expect((await exported()).wires??[]).toHaveLength(0);
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect((await exported()).wires).toEqual(detached.wires);
 await openWire(page,'neon');await page.locator('[data-wire-color="pink"]').click();
 mkdirSync('release/pages-verification',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'release/pages-verification/wires-live.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#wire-done')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/wires-live.json',JSON.stringify({target,errors,debugAPI:false,regularLimit:20,neonLimit:16,neonColors:9,surfaceRouting:true,wireCollision:true,overpass:true,bodyContactIsolated:true,endCapsCarryPower:true,individualWireDelete:true,componentDeletePreservesWires:true,deleteUndoRedo:true,saveReload:true,leverSignal:true,compactFits:true},null,2));
 console.log('Production wires: placement, power, individual selection/deletion, preserved disconnected routes, history, save/reload, compact layout and WebGL checks passed.');
}finally{await browser.close();}
