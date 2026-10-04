import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

// Uses only the public UI, including import/export; no development hooks.
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
  await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
  const fixture={version:1,logicModelVersion:2,name:'Hover controls check',plots:[12],pieces:[
    {id:'lever',item:'lever',position:[-2,.75,0],rotation:[0,0,0],wood:'oak'},
    {id:'button',item:'button',position:[2,.25,0],rotation:[0,0,0],wood:'oak'},
    {id:'lamp',item:'lamp',position:[7,1.5,0],rotation:[0,0,0],wood:'oak',lightOn:false},
  ],wires:[{id:'wire',from:{piece:'button',port:'out'},to:{piece:'lamp',port:'in'},points:[]}]};
  await page.locator('#file-input').setInputFiles({name:'hover-controls.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.locator('#confirm-action').click();await page.locator('#select-tool').click();await page.locator('#home').click();
  const rect=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);
  camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
  const xy=position=>{const p=new Vector3(...position).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];};
  await page.mouse.move(...xy([-2+.693,1.093,0]));await expect(page.locator('#logic-hover')).toContainText('Switch on');
  await page.keyboard.down('e');await page.keyboard.down('e');await page.waitForTimeout(150);await page.keyboard.up('e');
  // Same camera projection still hits the opposite pose: held E did not fly up.
  await page.mouse.move(...xy([-2-.693,1.093,0]));await expect(page.locator('#logic-hover')).toContainText('Switch off');
  await expect(page.locator('#edit-panel')).toBeHidden();
  await page.mouse.click(...xy([7,1.2,0]));await expect(page.locator('#piece-name')).toHaveText('Lamp');
  await expect(page.locator('#light-toggle')).not.toBeChecked();
  await page.mouse.move(...xy([2,.5,0]));await expect(page.locator('#logic-hover')).toContainText('Press button');
  await page.locator('#menu-tool').click();await page.locator('#project-name').focus();
  await page.mouse.move(...xy([2,.5,0]));await expect(page.locator('#logic-hover')).toBeHidden();
  await page.mouse.click(...xy([2,.5,0]));await expect(page.locator('#light-toggle')).toBeChecked();
  await expect(page.locator('#piece-name')).toHaveText('Lamp');await expect(page.locator('#light-toggle')).not.toBeChecked();
  await page.keyboard.press('e');await expect(page.locator('#light-toggle')).toBeChecked();await expect(page.locator('#light-toggle')).not.toBeChecked();
  if(!await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();
  const download=page.waitForEvent('download');await page.locator('#export').click();
  const stream=await(await download).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const saved=JSON.parse(Buffer.concat(chunks).toString());expect(saved.pieces.find(p=>p.id==='lever').logicOn).toBe(true);
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  await page.mouse.move(...xy([-2-.693,1.093,0]));await expect(page.locator('#logic-hover')).toContainText('Switch off');
  expect(errors).toEqual([]);mkdirSync('release/pages-verification',{recursive:true});
  await page.screenshot({path:'release/pages-verification/logic-interaction-live.png'});
  writeFileSync('release/pages-verification/logic-interaction-live.json',JSON.stringify({target,errors,debugAPI:false,hoverLever:true,heldKeyNoFlight:true,buttonClick:true,clickAfterTextEntry:true,buttonKey:true,momentaryPulse:true,selectionPreserved:true,switchPersisted:true},null,2));
  console.log('Production hover controls: lever E, held-key camera priority, button click/E, wired pulse, selection and saved state passed.');
} finally {await browser.close();}
