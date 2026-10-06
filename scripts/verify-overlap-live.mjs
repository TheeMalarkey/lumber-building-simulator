import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
const fixture=[
  {id:'a',item:'small-floor',wood:'oak',position:[-4,.5,0],rotation:[0,0,0]},
  {id:'b',item:'small-floor',wood:'birch',position:[4,.5,0],rotation:[0,0,0]},
];
await page.locator('#menu-tool').click();
await page.locator('#file-input').setInputFiles({name:'overlap-check.timber',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({version:1,name:'Overlap check',pieces:fixture,plots:[12]}))});
await page.locator('#confirm-action').click();await page.locator('#menu-tool').click();await page.locator('#home').click();
const r=await page.locator('#viewport>canvas').boundingBox();
const camera=new PerspectiveCamera(45,r.width/r.height,.1,4000);
camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
const v=new Vector3(-4,1,0).project(camera);
await page.mouse.click(r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2);
await expect(page.locator('#overlap-toggle')).not.toBeChecked();
await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();
await page.locator('#commit-preview').click();await expect(page.locator('#piece-count')).toHaveText('2 pieces');
await expect(page.locator('#toast')).toContainText('overlap');
await page.locator('#overlap-toggle').check();await page.locator('#commit-preview').click();
await expect(page.locator('#piece-count')).toHaveText('3 pieces');
await page.locator('#overlap-toggle').uncheck();await page.locator('#commit-preview').click();
await expect(page.locator('#piece-count')).toHaveText('3 pieces');
await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
const stream=await (await pending).createReadStream(),chunks=[];
for await(const chunk of stream)chunks.push(chunk);
const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
expect(result.pieces.filter(p=>JSON.stringify(p.position)==='[-4,0.5,0]')).toHaveLength(2);
expect(result.pieces.find(p=>p.id==='a')).toEqual(fixture[0]);expect(result.pieces.find(p=>p.id==='b')).toEqual(fixture[1]);
await page.locator('#undo').click();await expect(page.locator('#piece-count')).toHaveText('2 pieces');
await expect(page.locator('#overlap-toggle')).not.toBeChecked();
expect(errors).toEqual([]);
mkdirSync('release/pages-verification',{recursive:true});
writeFileSync('release/pages-verification/overlap-live-check.json',JSON.stringify({target,errors,debugAPI:false,overlapPlacement:true,disabledKeepsExisting:true,undo:true},null,2));
await browser.close();console.log('Production overlap toggle verified: default blocking, exact overlapping copy, restored blocking, export and undo.');
