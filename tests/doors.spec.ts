import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';

async function setup(page:Page){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'h',item:'hatch',wood:'oak',position:[0,.5,0],rotation:[0,0,0]}],[12]);e.pickSelection(null);e.view.sync(true);e.view.grid.visible=false;e.view.camera.controls.enableDamping=false;});
}
async function camera(page:Page,position:number[],target:number[]){await page.evaluate(({position,target})=>{const c=(window as any).timber.editor.view.camera;c.camera.position.set(...position);c.controls.target.set(...target);c.controls.update();},{position,target});await page.waitForTimeout(120);}
async function point(page:Page,position:number[]){return page.evaluate(async position=>{const {Vector3}=await import('/node_modules/three/build/three.module.js');const v=(window as any).timber.editor.view;v.camera.camera.updateMatrixWorld();const r=v.renderer.domElement.getBoundingClientRect(),p=new Vector3(...position).project(v.camera.camera);return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2] as [number,number];},position);}
async function progress(page:Page,id='h'){return page.evaluate(id=>(window as any).timber.editor.view.doors.progress(id),id);}
const out='artifacts/hatches-and-doors';

test('hatch control opens upward with E and closes on click; multiple-angle review',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));mkdirSync(out,{recursive:true});
 await setup(page);await camera(page,[6,5,8],[0,.5,0]);
 await page.screenshot({path:`${out}/hatch-closed-front.png`});
 await camera(page,[0,9,.1],[0,0,0]);await page.screenshot({path:`${out}/hatch-closed-top.png`});
 await camera(page,[6,4,9],[0,.8,.5]);
 const control=await point(page,[0,.5,1.997]);await page.mouse.move(...control);await expect(page.locator('#logic-hover')).toContainText('Open hatch');
 await page.keyboard.press('e');await expect.poll(()=>progress(page)).toBe(1);
 await camera(page,[9,4,1],[0,2,.3]);await page.mouse.move(5,100);await page.screenshot({path:`${out}/hatch-open-side.png`});
 await camera(page,[-6,5,-7],[0,2,.5]);await page.screenshot({path:`${out}/hatch-open-rear.png`});
 await camera(page,[6,4,9],[0,.8,.5]);await page.mouse.click(...await point(page,[0,.5,1.997]));await expect.poll(()=>progress(page)).toBe(0);
 await page.keyboard.press('Control+z');await expect.poll(()=>progress(page)).toBe(1);
 expect(errors).toEqual([]);
});

test('all four doors retain their design and expose a walkable opening',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load(['basic-door','half-door','fat-door','glass-door'].map((item,i)=>({id:item,item,wood:'oak',position:[(i-1.5)*8,item==='half-door'?2:4,0],rotation:[0,0,0]})),[12]);e.view.sync(true);});
 await camera(page,[14,14,29],[0,4,0]);await page.screenshot({path:`${out}/doors-closed.png`});
 const topology=await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.topologyBuilds);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([...e.world.pieces.values()].map((p:any)=>({before:p,after:{...p,doorOpen:true}})));});
 await expect.poll(()=>progress(page,'basic-door')).toBe(1);await expect.poll(()=>progress(page,'glass-door')).toBe(1);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.logic.circuit.topologyBuilds)).toBe(topology);
 await page.screenshot({path:`${out}/doors-open.png`});
 expect(await page.evaluate(()=>{const e=(window as any).timber.editor;return e.view.camera.walker.canOccupy(e.view.camera.walker.position.clone().set(-12,0,0));})).toBe(true);
 // Picking the slab now hits the opened leaf, not its former closed footprint.
 const hit=await point(page,[-10,4,2]);expect(await page.evaluate(([x,y])=>(window as any).timber.editor.view.pick(x,y)?.id,hit)).toBe('basic-door');
});

test('a visible wired lever controls a hatch without replacing the placed assembly',async({page})=>{
 await setup(page);await page.evaluate(()=>{const e=(window as any).timber.editor;const h=e.world.pieces.get('h');e.world.load([h,{id:'lever',item:'lever',position:[-5,.75,4],rotation:[0,0,0],wood:'oak'}],[12],[{id:'lead',kind:'wire',from:{piece:'lever',port:'out'},to:{piece:'h',port:'in'},points:[[-2,.2,4],[0,.5,3]]}]);e.view.sync(true);});
 await camera(page,[9,9,14],[-1,1,1]);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.logicTools.activate('lever');});
 await expect.poll(()=>progress(page)).toBe(1);await page.screenshot({path:`${out}/hatch-wired-open.png`});
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.logicTools.activate('lever');});await expect.poll(()=>progress(page)).toBe(0);
});

test('a walking player opens the handle and walks through the doorway',async({page})=>{
 await setup(page);await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'door',item:'basic-door',wood:'oak',position:[0,4,0],rotation:[0,0,0]}],[12]);e.view.sync(true);const c=e.view.camera;c.setWalking(true);c.walker.position.set(0,0,6);c.walker.velocity.set(0,0,0);c.walker.grounded=true;c.yaw=0;c.pitch=-.2;c.walkDistance=0;});
 await page.waitForTimeout(80);await page.mouse.move(...await point(page,[-1.5,3,.501]));await expect(page.locator('#logic-hover')).toContainText('Open door');await page.keyboard.press('e');await expect.poll(()=>progress(page,'door')).toBe(1);
 await page.keyboard.down('w');await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.camera.walker.position.z)).toBeLessThan(-1);await page.keyboard.up('w');
 await page.evaluate(()=>{const c=(window as any).timber.editor.view.camera;c.yaw=Math.PI;c.pitch=-.15;c.walkDistance=10;});await page.mouse.move(5,100);await page.waitForTimeout(100);await page.screenshot({path:`${out}/door-walk-through.png`});
});
