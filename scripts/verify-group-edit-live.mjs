import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3, Quaternion, Euler } from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
const fixture=[
  {id:'a',item:'post',wood:'oak',position:[-3,8,1],rotation:[0,0,0]},
  {id:'b',item:'post',wood:'birch',position:[3,8,-1],rotation:[0,1,0]},
  {id:'c',item:'tiny-tile',wood:'walnut',position:[12,.1,12],rotation:[0,0,0]},
];
await page.locator('#menu-tool').click();
await page.locator('#file-input').setInputFiles({name:'group-edit-check.timber',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({version:1,name:'Group editing',pieces:fixture,plots:[12]}))});
await page.locator('#confirm-action').click();await page.locator('#menu-tool').click();
await page.locator('#home').click();
const r=await page.locator('#viewport>canvas').boundingBox();
const camera=new PerspectiveCamera(45,r.width/r.height,.1,4000);
camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
const project=position=>{const v=new Vector3(...position).project(camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];};
await page.mouse.click(...project(fixture[0].position));
await page.keyboard.down('Control');await page.mouse.click(...project(fixture[1].position));await page.keyboard.up('Control');
await expect(page.locator('#selection-count')).toHaveText('2 selected');
await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', /Mixed woods/);
await page.keyboard.press('r');await page.keyboard.press('t');
await page.locator('#wood-toggle').click();await page.locator('[data-wood="pine"]').click();
const exported=async()=>{
  await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
  const stream=await (await pending).createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8')).pieces;
};
const edited=await exported();
expect(edited.find(p=>p.id==='a').position).toEqual([1,5,0]);expect(edited.find(p=>p.id==='b').position).toEqual([-1,11,0]);
expect(edited.filter(p=>p.id!=='c').map(p=>p.wood)).toEqual(['pine','pine']);expect(edited.find(p=>p.id==='c')).toEqual(fixture[2]);
for(const initial of fixture.slice(0,2)) {
  const expected=new Quaternion().setFromEuler(new Euler(...initial.rotation.map(n=>n*Math.PI/2),'YXZ'));
  expected.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2));
  expected.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
  const actual=new Quaternion().setFromEuler(new Euler(...edited.find(p=>p.id===initial.id).rotation.map(n=>n*Math.PI/2),'YXZ'));
  expect(Math.abs(actual.dot(expected))).toBeCloseTo(1,8);
}
await page.locator('#undo').click();await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', /Mixed woods/);
await page.locator('#redo').click();await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', /Pine/);
await page.locator('#duplicate-tool').click();await page.locator('#hold-position').click();await page.keyboard.press('r');
await page.locator('#wood-toggle').click();await page.locator('[data-wood="walnut"]').click();await page.keyboard.press('Escape');
expect((await exported()).sort((a,b)=>a.id.localeCompare(b.id))).toEqual([...edited].sort((a,b)=>a.id.localeCompare(b.id)));
// Restore the group for a readable screenshot and compact controls check.
await page.locator('#home').click();
await page.mouse.click(...project([1,5,0]));await page.keyboard.down('Control');await page.mouse.click(...project([-1,11,0]));await page.keyboard.up('Control');
await page.locator('#home').click();await page.waitForTimeout(1000);
await expect(page.locator('#toast')).not.toHaveClass(/visible/);
await page.screenshot({path:'artifacts/group-editing.png'});
await page.setViewportSize({width:390,height:844});
await expect(page.locator('#nudge-buttons')).toBeHidden();await expect(page.locator('#wood-toggle')).toBeVisible();
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
expect(errors).toEqual([]);
mkdirSync('release/pages-verification',{recursive:true});
writeFileSync('release/pages-verification/group-edit-live-check.json',JSON.stringify({target,errors,debugAPI:false,rotateTilt:true,groupWood:true,copyCancelPreservesOriginals:true,compactFits:true},null,2));
await browser.close();console.log('Production group editing verified: rotation, tilt, finish, undo/redo, copy cancellation, export and compact controls.');
