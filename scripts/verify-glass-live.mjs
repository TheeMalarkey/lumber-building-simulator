import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';

const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const specs=[['tiny-glass-pane',-15,.5],['small-glass-pane',-11.5,1],['glass-pane',-6.5,2],['large-glass-pane',1.5,4],['glass-door',10.5,4]];
const fixture=specs.map(([item,x,y],i)=>({id:`glass-${i}`,item,wood:'oak',position:[x,y,0],rotation:[0,0,0]}));
for(const [i,x] of [-10,0,10].entries()) fixture.push({id:`backdrop-${i}`,item:'smooth-wall',wood:['cherry','birch','pine'][i],position:[x,4,-5],rotation:[0,0,0]});
try {
  await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
  await page.locator('#menu-tool').click();await page.locator('#file-input').setInputFiles({name:'glass-check.timber',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({version:1,name:'Glass building pieces',pieces:fixture,plots:[12]}))});
  await page.locator('#confirm-action').click();if(await page.locator('#project-menu').isVisible()) await page.locator('#menu-tool').click();
  await page.locator('#build-tool').click();await page.locator('[data-category="Glass"]').click();
  await expect(page.locator('#catalog-total')).toHaveText('88');
  await expect(page.locator('.catalog-card')).toHaveCount(5);
  await expect(page.locator('.card-name')).toHaveText(['Tiny Glass Pane','Small Glass Pane','Glass Pane','Large Glass Pane','Glass Door']);
  await page.locator('[data-item="tiny-glass-pane"]').click();await expect(page.locator('#wood-picker')).toBeHidden();
  const r=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,r.width/r.height,.1,4000);
  camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
  const screen=p=>{const v=new Vector3(...p).project(camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];};
  await page.mouse.click(...screen([-15.3,0,7.2]));await expect(page.locator('#piece-count')).toHaveText('9 pieces');
  const exported=async()=>{
    await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
    const stream=await (await pending).createReadStream(),chunks=[];for await(const c of stream) chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
  let project=await exported();expect(project.pieces.find(p=>!fixture.some(f=>f.id===p.id))).toMatchObject({item:'tiny-glass-pane',position:[-15.5,.5,7.1]});
  await page.locator('#select-tool').click();await page.mouse.click(...screen([-6.5,2,0]));
  await expect(page.locator('#piece-name')).toHaveText('Glass Pane');await expect(page.locator('#wood-picker')).toBeHidden();
  await page.locator('#axis-copy-toggle').check();
  const center=new Vector3(-6.5,2,0),depth=-center.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const scale=depth*2*Math.tan(camera.fov*Math.PI/360)*90/r.height;
  const from=center.clone();from.y+=scale*.7;const to=from.clone();to.y+=5;
  await page.mouse.move(...screen(from.toArray()));await page.mouse.down();await page.mouse.move(...screen(to.toArray()),{steps:8});await page.mouse.up();
  await expect(page.locator('#piece-count')).toHaveText('10 pieces');
  project=await exported();expect(project.pieces.slice(0,8)).toEqual(fixture);
  expect(project.pieces.at(-1)).toMatchObject({item:'glass-pane',position:[-6.5,7,0]});
  await page.locator('#rotate').click();await page.locator('#tilt').click();
  await page.locator('#undo').click();await page.locator('#redo').click();
  project=await exported();await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect((await exported()).pieces).toEqual(project.pieces);
  await page.locator('#build-tool').click();await page.locator('[data-category="Glass"]').click();
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  mkdirSync('release/pages-verification',{recursive:true});
  await page.screenshot({path:'artifacts/glass-building.png'});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-item="glass-door"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync('release/pages-verification/glass-live-check.json',JSON.stringify({target,errors,debugAPI:false,allFive:true,
    fixedFinish:true,placement:true,axisCopy:true,rotateTilt:true,undoRedo:true,saveReload:true,compactFits:true},null,2));
  console.log('Production glass catalog, placement, fixed finish, axis copy, rotation/tilt, undo/redo, save/reload and compact controls passed.');
} finally {await browser.close();}
