import { chromium, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';

const target=process.env.TIMBER_URL || 'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
let camera,rect;

async function importPieces(pieces) {
  await page.locator('#menu-tool').click();
  await page.locator('#file-input').setInputFiles({name:'surface-copy-check.timber',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({version:1,name:'Surface building and axis copies',pieces,plots:[12]}))});
  await page.locator('#confirm-action').click();
  await expect(page.locator('#piece-count')).toHaveText(`${pieces.length} pieces`);
  if(await page.locator('#project-menu').isVisible()) await page.locator('#menu-tool').click();
}
async function view() {
  await page.locator('#home').click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  rect=await page.locator('#viewport>canvas').boundingBox();
  camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);
  camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();
}
const screen=p=>{const v=new Vector3(...p).project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
async function choose(item) {await page.locator('#build-tool').click();await page.locator(`[data-item="${item}"]`).click();}
async function drag(from,to,ctrl=false) {
  await page.mouse.move(...screen(from));if(ctrl) await page.keyboard.down('Control');
  await page.mouse.down();await page.mouse.move(...screen(to),{steps:10});await page.mouse.up();
  if(ctrl) await page.keyboard.up('Control');
}
async function arrow(center,axis,delta) {
  const depth=-new Vector3(...center).applyMatrix4(camera.matrixWorldInverse).z;
  const scale=Math.max(.01,depth)*2*Math.tan(camera.fov*Math.PI/360)*90/rect.height;
  const from=[...center];from[axis]+=.7*scale;const to=[...from];to[axis]+=delta;
  await drag(from,to);
}
async function exported() {
  await page.locator('#menu-tool').click();const pending=page.waitForEvent('download');await page.locator('#export').click();
  const stream=await (await pending).createReadStream(),chunks=[];
  for await(const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const original={id:'platform',item:'large-floor',wood:'oak',position:[0,.5,0],rotation:[0,0,0]};
try {
  await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
  await importPieces([original]);await view();await choose('small-floor');await page.locator('#elevation').fill('0');
  await drag([-2,1,-1],[2,1,-1],true);
  let result=await exported();
  expect(result.pieces.filter(p=>p.id!=='platform').map(p=>p.position)).toEqual([[-2,1.5,-1],[0,1.5,-1],[2,1.5,-1]]);
  await page.locator('#undo').click();await expect(page.locator('#piece-count')).toHaveText('1 pieces');

  const wall={id:'wall',item:'smooth-wall',wood:'oak',position:[0,4,0],rotation:[0,0,0]};
  await importPieces([wall]);await view();await choose('small-floor');await page.locator('#elevation').fill('0');
  await drag([0,1.2,.5],[0,10.2,.5],true);
  result=await exported();
  expect(result.pieces.filter(p=>p.id!=='wall').map(p=>p.position)).toEqual(Array.from({length:10},(_,i)=>[0,1.5+i,1.5]));
  await page.locator('#undo').click();await choose('small-floor');await page.locator('#elevation').fill('2');
  await drag([0,1.2,.5],[0,3.2,.5],true);
  result=await exported();
  expect(result.pieces.filter(p=>p.id!=='wall').map(p=>p.position)).toEqual([[0,3.5,1.5],[0,4.5,1.5],[0,5.5,1.5]]);

  const originals=[
    {id:'a',item:'tiny-tile',wood:'oak',position:[-3,.1,0],rotation:[0,0,0]},
    {id:'b',item:'tiny-tile',wood:'birch',position:[3,.1,0],rotation:[0,1,0]},
  ];
  await importPieces(originals);await view();await page.mouse.click(...screen(originals[0].position));
  await expect(page.locator('#axis-copy-toggle')).not.toBeChecked();await page.locator('#axis-copy-toggle').check();
  await view();await arrow(originals[0].position,1,1);
  result=await exported();expect(result.pieces).toHaveLength(3);
  expect(result.pieces.filter(p=>['a','b'].includes(p.id))).toEqual(originals);
  expect(result.pieces.find(p=>!['a','b'].includes(p.id))).toMatchObject({item:'tiny-tile',wood:'oak',position:[-3,1.1,0],rotation:[0,0,0]});
  const single=result.pieces;
  // The first copy sits above A; use the oblique view to select the lower original.
  await page.locator('#select-tool').click();await view();await page.mouse.click(...screen(originals[0].position));
  await page.keyboard.down('Control');await page.mouse.click(...screen(originals[1].position));await page.keyboard.up('Control');
  await expect(page.locator('#selection-count')).toHaveText('2 selected');
  await view();await arrow([0,.1,0],1,2);
  result=await exported();expect(result.pieces).toHaveLength(5);
  expect(result.pieces.slice(0,3)).toEqual(single);
  expect(result.pieces.slice(3).map(p=>({item:p.item,wood:p.wood,position:p.position,rotation:p.rotation})))
    .toEqual(originals.map(p=>({item:p.item,wood:p.wood,position:[p.position[0],2.1,0],rotation:p.rotation})));
  expect(new Set(result.pieces.map(p=>p.id)).size).toBe(5);
  await page.locator('#undo').click();expect((await exported()).pieces).toEqual(single);
  await page.locator('#redo').click();expect((await exported()).pieces).toEqual(result.pieces);
  await view();await page.mouse.click(...screen([-3,2.1,0]));
  await page.keyboard.down('Control');await page.mouse.click(...screen([3,2.1,0]));await page.keyboard.up('Control');
  await expect(page.locator('#selection-count')).toHaveText('2 selected');await view();
  mkdirSync('release/pages-verification',{recursive:true});
  await page.screenshot({path:'release/pages-verification/surfaces-copy.png'});
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#axis-copy-toggle')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  expect((await exported()).pieces).toEqual(result.pieces);expect(errors).toEqual([]);
  writeFileSync('release/pages-verification/surfaces-copy-live-check.json',JSON.stringify({target,errors,debugAPI:false,
    blueprintTop:true,verticalSide:true,elevation:true,singleAxisCopy:true,groupAxisCopy:true,originalsPreserved:true,
    uniqueIDs:true,groupedUndo:true,saveReload:true,compactFits:true},null,2));
  console.log('Production surface building and axis-copy verified through UI: top/vertical/elevated runs, single/group copies, original preservation, undo/redo, save/reload and compact controls.');
} finally {await browser.close();}
