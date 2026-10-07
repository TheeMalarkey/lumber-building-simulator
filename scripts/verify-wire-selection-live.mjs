import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

// Run the same acceptance against preview and Pages without the dev API.
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 const fixture={version:1,logicModelVersion:3,name:'Circuit selection check',plots:[12],pieces:[
  {id:'lever',item:'lever',wood:'oak',position:[-5,.75,0],rotation:[0,0,0],logicOn:true},
  {id:'lamp',item:'lamp',wood:'oak',position:[5,1,0],rotation:[0,0,0]},
 ],wires:[
  {id:'lead',kind:'neon',color:'cyan',from:{piece:'lever',port:'out'},to:{piece:'lamp',port:'in'},points:[[0,.18,0]]},
  {id:'loose',kind:'wire',from:{point:[-4,.145,12]},to:{point:[4,.145,12]},points:[]},
 ]};
 const wireOnlyFixture={version:1,logicModelVersion:3,name:'Wire group movement',plots:[12],pieces:[],wires:[
  {id:'a',kind:'wire',from:{point:[-4,.145,-3]},to:{point:[4,.145,-3]},points:[]},
  {id:'b',kind:'wire',from:{point:[-4,.145,5]},to:{point:[4,.145,5]},points:[]},
 ]};
 const load=async(project=fixture)=>{await page.locator('#file-input').setInputFiles({name:'circuit-selection.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('#confirm-action').click();await page.locator('#select-tool').click();await page.locator('#home').click();};
 const exported=async()=>{await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const result=JSON.parse(Buffer.concat(chunks).toString());if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();return result;};
 await load(wireOnlyFixture);
 const rect=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
 const xy=p=>{const v=new Vector3(...p).project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
 const click=async(p,ctrl=false)=>{if(ctrl)await page.keyboard.down('Control');await page.mouse.click(...xy(p));if(ctrl)await page.keyboard.up('Control');};
 const arrowUp=async(center,studs)=>{
  const depth=-new Vector3(...center).applyMatrix4(camera.matrixWorldInverse).z,scale=depth*2*Math.tan(camera.fov*Math.PI/360)*90/rect.height;
  const from=[...center];from[1]+=.7*scale;const to=[...from];to[1]+=studs;
  await page.mouse.move(...xy(from));await page.mouse.down();await page.mouse.move(...xy(to),{steps:8});await page.mouse.up();
 };
 await click([0,.145,-3]);await click([0,.145,5],true);await expect(page.locator('#wire-palette-panel')).toBeHidden();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('#select-tool')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:960});
 await arrowUp([0,.145,1],2);const axisMove=await exported();expect(axisMove.wires.map(w=>w.id)).toEqual(['a','b']);expect(axisMove.pieces).toEqual([]);
 for(const [i,z] of [-3,5].entries()) expect(axisMove.wires[i]).toMatchObject({kind:'wire',from:{point:[-4,2.145,z]},to:{point:[4,2.145,z]},points:[]});
 await page.keyboard.press('Control+z');expect((await exported()).wires).toEqual(wireOnlyFixture.wires);
 await load();
 await click([0,.145,12]);await expect(page.locator('#wire-palette-panel')).toBeHidden();await click([0,.18,0],true);await expect(page.locator('#wire-palette-panel')).toBeVisible();
 await click([0,.18,0],true);await expect(page.locator('#wire-palette-panel')).toBeHidden();await click([0,.18,0],true);await expect(page.locator('#wire-palette-panel')).toBeVisible();
 await page.keyboard.press('Delete');let result=await exported();expect(result.wires??[]).toHaveLength(0);expect(result.pieces).toHaveLength(2);
 await page.keyboard.press('Control+z');expect((await exported()).wires).toEqual(fixture.wires);
 await page.keyboard.press('Control+Shift+z');expect((await exported()).wires??[]).toHaveLength(0);await page.keyboard.press('Control+z');
 await page.keyboard.press('Escape');
 const from=xy([-8,0,-3]),to=xy([8,2,2]);await page.keyboard.down('Control');await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(...to,{steps:8});await page.mouse.up();await page.keyboard.up('Control');
 await expect(page.locator('#piece-name')).toHaveText('2 blueprints · 1 wire');
 await page.keyboard.press('Control+d');await page.keyboard.press('l');
 for(let i=0;i<6;i++)await page.locator('[data-nudge="up"]').click();await page.locator('#commit-preview').click();
 result=await exported();expect(result.pieces).toHaveLength(4);expect(result.wires).toHaveLength(3);expect(result.wires.slice(0,2)).toEqual(fixture.wires);
 const copy=result.wires[2],copies=result.pieces.filter(p=>!['lever','lamp'].includes(p.id));
 expect(copy.from.piece).not.toBe('lever');expect(copy.to.piece).not.toBe('lamp');expect(copies.some(p=>p.id===copy.from.piece&&p.logicOn)).toBe(true);expect(copies.some(p=>p.id===copy.to.piece&&p.item==='lamp')).toBe(true);expect(copy.color).toBe('cyan');
 // Verify signal through the public lamp inspector, then group undo/redo.
 await page.keyboard.press('Escape');const lamp=copies.find(p=>p.item==='lamp');await click(lamp.position);await expect(page.locator('#logic-status')).toHaveText('Controlled by wire · On');
 await page.keyboard.press('Control+z');expect((await exported()).pieces).toEqual(fixture.pieces);expect((await exported()).wires).toEqual(fixture.wires);
 await page.keyboard.press('Control+Shift+z');expect((await exported()).wires).toEqual(result.wires);
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect((await exported()).wires).toEqual(result.wires);
 await page.locator('#home').click();await click([0,.145,12]);await click([0,.18,0],true);await expect(page.locator('#wire-palette-panel')).toBeVisible();
 mkdirSync('release/pages-verification',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);await page.screenshot({path:'release/pages-verification/wire-multiselect-live.png'});
 await page.keyboard.press('Delete');const removed=await exported();expect(removed.wires).toHaveLength(1);expect(removed.wires[0].id).toBe(copy.id);expect(removed.pieces).toHaveLength(4);await page.keyboard.press('Control+z');expect((await exported()).wires).toEqual(result.wires);
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/wire-multiselect-live.json',JSON.stringify({target,errors,debugAPI:false,ctrlClickToggle:true,ctrlDragMixedSelection:true,wireAxisMove:true,batchDelete:true,mixedCopy:true,copiedSockets:true,copiedSignal:true,oneStepHistory:true,saveReload:true,compactFits:true},null,2));
 console.log('Production wire multi-selection: Ctrl-click, Ctrl-drag, batch delete, circuit copying, copied signal, history, persistence and compact controls passed.');
}finally{await browser.close();}
