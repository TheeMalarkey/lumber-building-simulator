import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';

const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
  await page.locator('#menu-tool').click();
  await page.locator('#file-input').setInputFiles({name:'drag-check.timber',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({version:1,name:'Straight drag check',pieces:[],plots:[12]}))});
  await page.locator('#confirm-action').click();await page.locator('#menu-tool').click();await page.locator('#home').click();
  const camera=new PerspectiveCamera(45,1440/960,.1,4000);
  camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
  const screen=p=>{const v=new Vector3(...p).project(camera);return [(v.x+1)*720,(1-v.y)*480];};
  async function choose() {await page.locator('#build-tool').click();await page.locator('[data-item="small-floor"]').click();}
  async function drag(from,to) {
    await page.mouse.move(...screen(from));
    await page.mouse.down();await page.mouse.move(...screen(to),{steps:10});await page.mouse.up();
  }
  async function exportProject() {
    await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
    const stream=await (await pending).createReadStream(),chunks=[];
    for await(const chunk of stream) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  await choose();
  await expect(page.locator('#build-mode,#path-fill,#elevation')).toHaveCount(0);
  await page.mouse.click(...screen([-10,0,-12]));await expect(page.locator('#piece-count')).toHaveText('1 pieces');
  await page.locator('#undo').click();await expect(page.locator('#piece-count')).toHaveText('0 pieces');
  await expect(page.locator('#undo')).toBeDisabled();await choose();
  await expect(page.locator('#wedge-mode, #path-remove')).toHaveCount(0);
  await drag([-10,0,-12],[2,0,-12]);
  await expect(page.locator('#piece-count')).toHaveText('7 pieces');
  const line=await exportProject();
  expect(line.pieces.map(p=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,.5,-12]));
  await page.locator('#undo').click();await expect(page.locator('#piece-count')).toHaveText('0 pieces');
  await page.locator('#redo').click();await expect(page.locator('#piece-count')).toHaveText('7 pieces');
  await choose();
  await drag([-10,0,8],[22,0,8]);await expect(page.locator('#piece-count')).toHaveText('7 pieces');
  await expect(page.locator('#path-status')).toContainText('active plots');
  await page.locator('#path-cancel').click();
  await drag([-10,0,8],[-6,0,10]);
  await expect(page.locator('#piece-count')).toHaveText('10 pieces');
  const result=await exportProject();
  expect(result.pieces.filter(p=>p.position[2]===8).map(p=>p.position)).toEqual(Array.from({length:3},(_,i)=>[-10+2*i,.5,8]));
  expect(result.pieces.every(p=>p.rotation.every(Number.isInteger))).toBe(true);
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect((await exportProject()).pieces).toEqual(result.pieces);
  const legacy={id:'published-pose',item:'small-floor',wood:'pine',position:[-4,.5,0],rotation:[0,.5,0]};
  await page.locator('#menu-tool').click();
  await page.locator('#file-input').setInputFiles({name:'existing-build.timber',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({version:1,name:'Existing build',pieces:[legacy],plots:[12]}))});
  await page.locator('#confirm-action').click();await page.locator('#menu-tool').click();
  expect((await exportProject()).pieces).toEqual([legacy]);
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect((await exportProject()).pieces).toEqual([legacy]);
  await choose();await page.setViewportSize({width:1024,height:768});
  const rect=await page.locator('#edit-panel').boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(1024);
  expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(768);
  expect(errors).toEqual([]);
  mkdirSync('release/pages-verification',{recursive:true});
  writeFileSync('release/pages-verification/drag-live-check.json',JSON.stringify({target,errors,debugAPI:false,
    plainClick:true,plainDrag:true,axisAligned:true,footprintSpacing:true,landValidation:true,groupedUndo:true,saveReload:true,legacySaves:true,curvesRemoved:true,compactFits:true},null,2));
  console.log('Production straight drag verified: plain click/drag, dominant world axis, land validation, one-step undo, save/reload and compact controls.');
} finally {await browser.close();}
