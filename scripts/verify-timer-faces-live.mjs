import {chromium,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';

// Use public import, selection, switch and focus controls, including on Pages.
const target=process.env.TIMBER_URL||'http://127.0.0.1:5179/';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*(error|warning)/i.test(m.text()))errors.push(m.text());});
 await page.goto(target);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');expect(await page.evaluate(()=>typeof window.timber)).toBe('undefined');
 mkdirSync('release/pages-verification',{recursive:true});
 const rect=await page.locator('#viewport>canvas').boundingBox(),camera=new PerspectiveCamera(45,rect.width/rect.height,.1,4000);
 const home=()=>{camera.position.set(40,30,44);camera.lookAt(0,4,0);camera.updateMatrixWorld();};
 const focus=()=>{camera.position.copy(new Vector3(40,26,44).normalize().multiplyScalar(6)).add(new Vector3(0,1,0));camera.lookAt(0,1,0);camera.updateMatrixWorld();};
 const xy=p=>{const v=new Vector3(...p).project(camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];};
 const menu=async()=>{if(!await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();};
 const closeMenu=async()=>{if(await page.locator('#project-menu').isVisible())await page.locator('#menu-tool').click();};
 const select=async(position,name)=>{if(await page.locator('#edit-panel').isVisible())await page.locator('#close-edit').click();await page.mouse.click(...xy(position));await expect(page.locator('#piece-name')).toHaveText(name);};
 const inspectTimer=async name=>{await select([0,1,.8],name);await page.keyboard.press('f');focus();};
 const pixels=async()=>{
  const png=await page.locator('#viewport>canvas').screenshot(),points=[0,1,4,8,11].map(i=>xy([.55,.2696+.112*i,1.0002]));points.push(xy([-.4,.28,.958]));
  return page.evaluate(async({url,points,rect})=>{
   const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const context=canvas.getContext('2d');context.drawImage(img,0,0);
   return points.map(([x,y])=>[...context.getImageData(Math.floor(x-rect.x),Math.floor(y-rect.y),1,1).data]);
  },{url:'data:image/png;base64,'+png.toString('base64'),points,rect});
 };
 const cyan=([r,g,b])=>g>r+80&&b>r+100;
 const colors=async()=> (await pixels()).map(cyan);
 const fixture=item=>({version:1,name:'Timer face check',logicModelVersion:3,plots:[12],pieces:[
  {id:'source',item:'lever',wood:'oak',position:[-4,.75,0],rotation:[0,0,0],logicOn:true},
  {id:'timer',item,wood:'oak',position:[0,1,0],rotation:[0,0,0],timing:12}
 ],wires:[{id:'lead',from:{piece:'source',port:'out'},to:{piece:'timer',port:'in'},points:[]}]});
 const results=[];
 for(const [item,name] of [['signal-delay','Signal Delay'],['signal-sustain','Signal Sustain']]){
  await page.locator('#file-input').setInputFiles({name:'timer-check.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture(item)))});await page.locator('#confirm-action').click();await closeMenu();await page.locator('#select-tool').click();await page.locator('#home').click();home();
  await inspectTimer(name);await expect(page.locator('#logic-timing')).toHaveValue('12');await expect.poll(colors).toEqual([true,true,true,true,true,true]);
  await page.screenshot({path:`release/pages-verification/${item}-powered-live.png`});
  await page.locator('#home').click();home();await select([-4,.25,0],'Lever');await page.locator('#logic-action').click();await expect(page.locator('#logic-status')).toHaveText('Output · Off');await inspectTimer(name);
  await expect.poll(colors,{timeout:2000,intervals:[30,50,100]}).toEqual(item==='signal-delay'?[false,false,true,true,true,false]:[true,true,true,true,false,false]);
  await page.screenshot({path:`release/pages-verification/${item}-draining-live.png`});
  await expect.poll(colors).toEqual([false,false,false,false,false,false]);
  results.push({item,inputIndicator:true,independentProgress:true,cleared:true});
 }
 // Selected Sustain amount is measured against the fixed 12-step meter.
 await page.locator('#logic-timing').selectOption('2');await page.locator('#home').click();home();await select([-4,.25,0],'Lever');await page.locator('#logic-action').click();await inspectTimer('Signal Sustain');
 await expect.poll(colors).toEqual([true,true,false,false,false,true]);
 await menu();const pending=page.waitForEvent('download');await page.locator('#export').click();const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const saved=JSON.parse(Buffer.concat(chunks).toString());
 expect(saved.logicModelVersion).toBe(3);expect(saved.wires).toEqual(fixture('signal-sustain').wires);expect(saved.pieces.find(p=>p.id==='timer').timing).toBe(2);
 for(const piece of saved.pieces)expect(Object.keys(piece).sort()).toEqual(piece.id==='source'?['id','item','logicOn','position','rotation','wood']:['id','item','position','rotation','timing','wood']);
 expect(errors).toEqual([]);writeFileSync('release/pages-verification/timer-faces-live.json',JSON.stringify({target,errors,debugAPI:false,results,selectedAmount:true,runtimeNotExported:true},null,2));
 console.log('Production timer faces: powered cyan, input indicators, Delay travel, Sustain drain, selected amount and stable exports passed.');
}finally{await browser.close();}
