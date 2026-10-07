import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

async function openWire(page,kind='wire') {
 if(!await page.locator('#build-panel').isVisible())await page.locator('#build-tool').click();
 await page.locator('#search').fill('');await page.locator('[data-category="Wires"]').click();
 await page.locator(`[data-wire-item="${kind}"]`).click();
 await page.getByRole('button',{name:'Close blueprint library',exact:true}).click();
}
async function color(page,id) {
 if(!await page.locator('#wire-colors').isVisible()) await page.locator('#wire-color-toggle').click();
 await page.locator(`[data-wire-color="${id}"]`).click();
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
 const exported=async()=>{await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const result=JSON.parse(Buffer.concat(chunks).toString());if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();return result;};
 const count=async()=>((await exported()).wires??[]).length;
 await openWire(page,'neon');await expect(page.locator('[data-wire-color]')).toHaveCount(9);await color(page,'cyan');
 await page.mouse.click(...xy([-8,0,-8]));await page.mouse.move(...xy([7.5,0,-8]));
 const lengthLabel=page.locator('#wire-length-label');await expect(lengthLabel).toHaveText('15.5/16');
 const midpoint=xy([-.25,.155,-8]),labelBounds=await lengthLabel.boundingBox();
 expect(Math.abs(labelBounds.x+labelBounds.width/2-midpoint[0])).toBeLessThan(3);expect(Math.abs(labelBounds.y+labelBounds.height/2-midpoint[1])).toBeLessThan(3);
 mkdirSync('release/pages-verification',{recursive:true});await page.screenshot({path:'release/pages-verification/wire-placement-compact-private.png'});
 await page.mouse.click(...xy([9,0,-8]));await expect(page.locator('#toast')).toContainText('16');expect(await count()).toBe(0);
 await page.mouse.click(...xy([7.5,0,-8]));await page.keyboard.press('Enter');expect(await count()).toBe(1);
 await openWire(page);await expect(page.locator('#wire-palette-panel')).toBeVisible();await expect(page.locator('#wire-color-toggle')).toBeHidden();await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();await page.mouse.click(...xy([-9,0,8]));await page.mouse.click(...xy([12,0,8]));await expect(page.locator('#toast')).toContainText('20');await page.mouse.click(...xy([9,0,8]));await page.keyboard.press('Enter');expect(await count()).toBe(2);
 await page.locator('#select-tool').click();
 const saved=await exported();expect(saved.wires).toHaveLength(2);expect(saved.wires[0].kind).toBe('neon');expect(saved.wires[0].color).toBe('cyan');expect(saved.wires[1].kind).toBe('wire');
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect((await exported()).wires).toEqual(saved.wires);
 await load({version:1,name:'Wire overpass check',plots:[12],pieces:[],wires:[{id:'host',kind:'neon',color:'cyan',from:{point:[-5,.155,0]},to:{point:[5,.155,0]},points:[]}]});
 await openWire(page);await page.mouse.click(...xy([0,0,-4]));await page.mouse.click(...xy([0,0,4]));
 await expect(page.locator('#toast')).toContainText('cannot pass through');expect(await count()).toBe(1);
 await page.keyboard.down('Shift');await page.mouse.click(...xy([0,.155,0]));await page.keyboard.up('Shift');await page.mouse.click(...xy([0,0,4]));await page.keyboard.press('Enter');
 expect(await count()).toBe(2);await page.locator('#select-tool').click();expect((await exported()).wires[1].points[0][1]).toBeGreaterThan(.4);
 await load({version:1,logicModelVersion:3,name:'Wire end contact check',plots:[12],pieces:[
  {id:'lever',item:'lever',wood:'oak',position:[-6,.75,0],rotation:[0,0,0],logicOn:true},
  {id:'body-light',item:'lamp',wood:'oak',position:[0,1,6],rotation:[0,0,0]},
  {id:'end-light',item:'lamp',wood:'oak',position:[7,1,6],rotation:[0,0,0]},
 ],wires:[{id:'host',kind:'wire',from:{piece:'lever',port:'out'},to:{point:[4,.18,0]},points:[]}]});
 await openWire(page);await page.mouse.click(...xy([0,.18,0]));await page.mouse.click(...xy([0,.6,6.22]));expect(await count()).toBe(2);await page.locator('#select-tool').click();
 await page.mouse.click(...xy([0,.5,6]));await expect(page.locator('#piece-name')).toHaveText('Lamp');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · Off');
 await openWire(page);await page.mouse.click(...xy([3.95,.18,0]));await page.mouse.click(...xy([7,.6,6.22]));expect(await count()).toBe(3);await page.locator('#select-tool').click();
 await page.mouse.click(...xy([7,.5,6]));await expect(page.locator('#piece-name')).toHaveText('Lamp');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · On');
 const fixture={version:1,logicModelVersion:3,name:'Neon signal check',plots:[12],pieces:[{id:'l',item:'lever',wood:'oak',position:[-5,.75,0],rotation:[0,0,0],logicOn:false}],wires:[{id:'n',kind:'neon',color:'pink',from:{piece:'l',port:'out'},to:{point:[5,.18,0]},points:[]}]};
 await load(fixture);await page.mouse.click(...xy([-5,.25,0]));await expect(page.locator('#piece-name')).toHaveText('Lever');await page.locator('#logic-action').click();await expect(page.locator('#logic-status')).toHaveText('Output · On');expect((await exported()).pieces[0].logicOn).toBe(true);
 await page.locator('#delete-tool').click();
 const detached=await exported();expect(detached.pieces).toHaveLength(0);expect(detached.wires).toHaveLength(1);expect(detached.wires[0].from.point).toHaveLength(3);expect(detached.wires[0].to).toEqual(fixture.wires[0].to);expect(detached.wires[0].color).toBe('pink');
 await page.keyboard.press('Control+z');expect((await exported()).wires[0].from).toEqual(fixture.wires[0].from);
 await page.keyboard.press('Control+Shift+z');expect((await exported()).wires).toEqual(detached.wires);
 await page.mouse.click(...xy([0,.18,0]));await expect(page.locator('#wire-color-toggle')).toHaveAttribute('title',/Pink/);await page.locator('#wire-axis-copy-toggle').uncheck();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#wire-color-toggle')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:960});
 mkdirSync('release/pages-verification',{recursive:true});await page.screenshot({path:'release/pages-verification/wire-selection-live.png'});
 await page.keyboard.press('Delete');expect((await exported()).wires??[]).toHaveLength(0);
 await page.keyboard.press('Control+z');await page.mouse.click(...xy([0,.18,0]));await page.keyboard.press('Delete');expect((await exported()).wires??[]).toHaveLength(0);
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect((await exported()).wires).toEqual(detached.wires);
 await page.mouse.click(...xy([0,.18,0]));await expect(page.locator('#wire-color-toggle')).toHaveAttribute('title',/Pink/);
 const sourceWire=detached.wires[0],sourceCenter=sourceWire.from.point.map((v,i)=>(v+sourceWire.to.point[i])/2),sourceDepth=-new Vector3(...sourceCenter).applyMatrix4(camera.matrixWorldInverse).z;
 const handle=[...sourceCenter];handle[1]+=.7*sourceDepth*2*Math.tan(camera.fov*Math.PI/360)*90/rect.height;
 await page.mouse.move(...xy(handle));await expect(page.locator('#viewport>canvas')).not.toHaveCSS('cursor','grab');
 await page.screenshot({path:'release/pages-verification/wire-single-selected-private.png'});
 await page.keyboard.press('g');expect((await exported()).wires).toEqual(detached.wires);
 await page.mouse.click(...xy([0,0,-4]));await page.mouse.click(...xy([0,0,4]));expect((await exported()).wires).toEqual(detached.wires);
 await page.keyboard.press('Enter');const rerouted=await exported();expect(rerouted.wires).toHaveLength(1);expect(rerouted.pieces).toEqual(detached.pieces);
 expect(rerouted.wires[0]).toMatchObject({id:sourceWire.id,kind:'neon',color:'pink',points:[]});expect(rerouted.wires[0].from.point[0]).toBeCloseTo(0,4);expect(rerouted.wires[0].from.point[2]).toBeCloseTo(-4,4);expect(rerouted.wires[0].to.point[0]).toBeCloseTo(0,4);expect(rerouted.wires[0].to.point[2]).toBeCloseTo(4,4);
 expect(rerouted.wires[0].from.point[1]).toBeCloseTo(rerouted.wires[0].to.point[1],4);
 await page.keyboard.press('Control+z');expect((await exported()).wires).toEqual(detached.wires);
 const linkedFixture={...fixture,pieces:[{...fixture.pieces[0],logicOn:true},{id:'lamp',item:'lamp',wood:'oak',position:[5,1,0],rotation:[0,0,0]}],wires:[{...fixture.wires[0],to:{piece:'lamp',port:'in'}}]};
 await load(linkedFixture);await page.mouse.click(...xy([.5,.39,.11]));await page.keyboard.press('g');expect((await exported()).wires).toEqual(linkedFixture.wires);
 await page.mouse.click(...xy([0,0,-4]));await page.mouse.click(...xy([0,0,4]));await page.keyboard.press('Enter');expect((await exported()).wires[0]).toMatchObject({id:'n',kind:'neon',color:'pink',from:{point:expect.any(Array)},to:{point:expect.any(Array)}});
 await page.keyboard.press('Control+z');expect((await exported()).wires).toEqual(linkedFixture.wires);
 await page.mouse.click(...xy([5,.5,0]));await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · On');await expect(page.locator('#light-toggle')).toBeDisabled();
 await page.mouse.click(...xy([-5,.25,0]));await page.locator('#logic-action').click();await page.mouse.click(...xy([5,.5,0]));await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · Off');
 await page.keyboard.press('Control+z');await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · On');expect((await exported()).wires).toEqual(linkedFixture.wires);
 await page.mouse.click(...xy([.5,.39,.11]));await page.keyboard.press('g');await page.mouse.click(...xy([0,0,-4]));await page.keyboard.press('Escape');expect((await exported()).wires).toEqual(linkedFixture.wires);await page.locator('#select-tool').click();
 await openWire(page,'neon');await color(page,'pink');
 mkdirSync('release/pages-verification',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'release/pages-verification/wires-live.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#wire-color-toggle')).toBeInViewport();await expect(page.locator('#wire-overlap-toggle')).toBeInViewport();await expect(page.locator('#wire-axis-copy-toggle')).toBeInViewport();await expect(page.locator('#select-tool')).toBeInViewport();const compact=await page.locator('#wire-palette-panel').boundingBox();expect(compact.width).toBeLessThan(200);expect(compact.height).toBeLessThan(160);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/wires-live.json',JSON.stringify({target,errors,debugAPI:false,regularLimit:20,neonLimit:16,neonColors:9,midpointLengthLabel:true,surfaceRouting:true,wireCollision:true,overpass:true,bodyContactIsolated:true,endCapsCarryPower:true,individualWireDelete:true,componentDeletePreservesWires:true,singleWireReroute:true,rerouteUndo:true,connectedRerouteCancel:true,deleteUndoRedo:true,saveReload:true,leverSignal:true,compactFits:true},null,2));
 console.log('Production wires: placement, power, individual selection/deletion, preserved disconnected routes, history, save/reload, compact layout and WebGL checks passed.');
}finally{await browser.close();}
