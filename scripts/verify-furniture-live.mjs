import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';

const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const specs=[['armchair',-10,2,-10],['loveseat',-3,2,-10],['couch',6,2,-10],
  ['single-bed',-10,1.5,0],['twin-bed',-3,1.5,0],['toilet',6,1.75,0],
  ['refrigerator',-10,3,10],['stove',-3,1.4,10],['dishwasher',6,1.2,10]];
const fixture=specs.map(([item,x,y,z],i)=>({id:`furniture-${i}`,item,wood:'oak',position:[x,y,z],rotation:[0,0,0]}));
try {
  await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
  await page.locator('#menu-tool').click();await page.locator('#file-input').setInputFiles({name:'furniture-check.timber',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({version:1,name:'Store furniture',pieces:fixture,plots:[12]}))});
  await page.locator('#confirm-action').click();if(await page.locator('#project-menu').isVisible()) await page.locator('#menu-tool').click();
  await page.locator('#build-tool').click();await page.locator('[data-category="Store furniture"]').click();
  await expect(page.locator('#catalog-total')).toHaveText('100');
  await expect(page.locator('.catalog-card')).toHaveCount(9);
  await expect(page.locator('.card-name')).toHaveText(['Armchair','Loveseat','Couch','Single Bed','Twin Bed','Toilet','Refrigerator','Stove','Dishwasher']);
  await page.locator('[data-item="armchair"]').click();await expect(page.locator('#wood-picker')).toBeHidden();
  const r=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,r.width/r.height,.1,4000);
  camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
  const screen=p=>{const v=new Vector3(...p).project(camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];};
  const exported=async()=>{
    await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
    const stream=await (await pending).createReadStream(),chunks=[];for await(const c of stream) chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
  let project=await exported();expect(project.pieces).toEqual(fixture);
  await page.locator('#select-tool').click();await page.mouse.click(...screen([-10,3,12]));
  await expect(page.locator('#piece-name')).toHaveText('Refrigerator');await expect(page.locator('#wood-picker')).toBeHidden();
  await page.locator('#axis-copy-toggle').check();
  const center=new Vector3(-10,3,10),depth=-center.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const scale=depth*2*Math.tan(camera.fov*Math.PI/360)*90/r.height;
  const from=center.clone();from.y+=scale*.7;const to=from.clone();to.y+=8;
  await page.mouse.move(...screen(from.toArray()));await page.mouse.down();await page.mouse.move(...screen(to.toArray()),{steps:8});await page.mouse.up();
  await expect(page.locator('#piece-count')).toHaveText('10 pieces');
  project=await exported();expect(project.pieces.slice(0,9)).toEqual(fixture);
  expect(project.pieces.at(-1)).toMatchObject({item:'refrigerator',position:[-10,11,10]});
  await page.locator('#rotate').click();await page.locator('#tilt').click();
  await page.locator('#undo').click();await page.locator('#redo').click();
  project=await exported();await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect((await exported()).pieces).toEqual(project.pieces);
  await page.locator('#build-tool').click();await page.locator('[data-category="Store furniture"]').click();
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  mkdirSync('release/pages-verification',{recursive:true});
  await page.screenshot({path:'release/pages-verification/furniture-live.png'});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('[data-item="dishwasher"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync('release/pages-verification/furniture-live-check.json',JSON.stringify({target,errors,debugAPI:false,allNine:true,
    fixedFinish:true,import:true,axisCopy:true,rotateTilt:true,undoRedo:true,saveReload:true,compactFits:true},null,2));
  console.log('Production furniture catalog, import, fixed finish, axis copy, rotation/tilt, undo/redo, save/reload and compact controls passed.');
} finally {await browser.close();}
