import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';

const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
await page.locator('#menu-tool').click();
await page.locator('#file-input').setInputFiles({name:'path-check.timber',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({version:1,name:'Build paths',pieces:[],plots:[12]}))});
await page.locator('#confirm-action').click();await page.locator('#menu-tool').click();await page.locator('#top').click();

let camera;
function topCamera() {camera=new PerspectiveCamera(45,1440/960,.1,4000);camera.position.set(0,69,.01);camera.lookAt(0,4,0);camera.updateMatrixWorld();}
function homeCamera() {camera=new PerspectiveCamera(45,1440/960,.1,4000);camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();}
topCamera();
const screen=p=>{const v=new Vector3(...p).project(camera);return [(v.x+1)*720,(1-v.y)*480];};
const click=async p=>{const [x,y]=screen(p);await page.mouse.click(x,y);};
async function choose(item) {await page.locator('#build-tool').click();await page.locator(`[data-item="${item}"]`).click();}
async function exportProject() {
  await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
  const stream=await (await pending).createReadStream(),chunks=[];
  for await(const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

await choose('small-floor');
let a=screen([-10,0,-12]),b=screen([2,0,-12]);
await page.mouse.move(...a);await page.keyboard.down('Control');await page.mouse.down();
await page.mouse.move(...b,{steps:10});await page.mouse.up();await page.keyboard.up('Control');
await expect(page.locator('#piece-count')).toHaveText('7 pieces');
const line=await exportProject();
expect(line.pieces.map(p=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,.5,-12]));
await page.locator('#undo').click();await expect(page.locator('#piece-count')).toHaveText('0 pieces');
await page.locator('#redo').click();await expect(page.locator('#piece-count')).toHaveText('7 pieces');

await choose('1-4-wedge');await page.locator('#build-mode').selectOption('wedge');
await page.locator('#overlap-toggle').check();
for(const p of [[-12,0,8],[0,0,8],[12,0,8]]) await click(p);
await expect(page.locator('#path-build')).toBeEnabled();await page.locator('#path-build').click();
const ramp=await exportProject();const rampPieces=ramp.pieces.filter(p=>p.item.includes('wedge'));
expect(rampPieces.length).toBeGreaterThan(3);expect(rampPieces.some(p=>p.position[1]>3)).toBe(true);

await choose('smooth-wall');await page.locator('#build-mode').selectOption('curve');
await page.locator('#wood-toggle').click();await page.locator('[data-wood="walnut"]').click();
for(const p of [[-12,0,-4],[0,0,-14],[12,0,-4]]) await click(p);
await expect(page.locator('#path-status')).toContainText('3 points');await page.locator('#path-build').click();
const curved=await exportProject(),walls=curved.pieces.filter(p=>p.item==='smooth-wall');
expect(walls.length).toBeGreaterThan(6);expect(walls.every(p=>p.wood==='walnut')).toBe(true);
expect(walls.some(p=>p.rotation.some(n=>!Number.isInteger(n)))).toBe(true);

await choose('1-4-wedge');await page.locator('#build-mode').selectOption('wedge');
await page.locator('#wedge-mode').selectOption('wall-arch');await page.locator('#elevation').fill('3');
await page.locator('#wood-toggle').click();await page.locator('[data-wood="pine"]').click();
for(const p of [[-11.8,0,.2],[.2,0,.2],[12.2,0,.2]]) await click(p);
await page.locator('#home').click();homeCamera();
await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
await click([0,5,.5]);
const origin=new Vector3(0,5,.5),depth=-origin.clone().applyMatrix4(camera.matrixWorldInverse).z;
const scale=depth*2*Math.tan(camera.fov*Math.PI/360)*90/960;
a=screen([0,5+scale*.7,.5]);b=screen([0,11+scale*.7,.5]);
await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(...b,{steps:12});await page.mouse.up();
await expect(page.locator('#path-build')).toBeEnabled();
await page.mouse.move(20,180);
mkdirSync('artifacts',{recursive:true});await expect(page.locator('#toast')).not.toHaveClass(/visible/);
await page.screenshot({path:'artifacts/build-paths.png'});
await page.locator('#path-build').click();const result=await exportProject();
const arch=result.pieces.filter(p=>p.item.includes('wedge') && p.wood==='pine');
expect(arch.length).toBeGreaterThan(4);expect(arch.some(p=>p.position[1]>8)).toBe(true);
expect(result.pieces.length).toBeGreaterThan(curved.pieces.length);

await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
expect((await exportProject()).pieces).toEqual(result.pieces);
await choose('smooth-wall');await page.locator('#build-mode').selectOption('curve');
await page.setViewportSize({width:1024,height:768});
const rect=await page.locator('#edit-panel').boundingBox();
expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(1024);
expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(768);
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
expect(errors).toEqual([]);
mkdirSync('release/pages-verification',{recursive:true});
writeFileSync('release/pages-verification/paths-live-check.json',JSON.stringify({target,errors,debugAPI:false,
  straight:line.pieces.length,ramp:rampPieces.length,curve:walls.length,arch:arch.length,groupedUndo:true,
  savedFractionalPoses:true,pointArrows:true,compactFits:true},null,2));
await browser.close();console.log('Production paths verified: Ctrl drag, one-step undo, wedge ramp, curved walls, raised arch point, save/reload and compact controls.');
