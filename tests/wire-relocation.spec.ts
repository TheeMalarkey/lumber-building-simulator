import {test,expect,type Page} from '@playwright/test';

async function setup(page:Page){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{
  const e=(window as any).timber.editor;
  e.world.load([],[12],[
   {id:'a',kind:'wire',from:{point:[-4,.145,-3]},to:{point:[4,.145,-3]},points:[]},
   {id:'b',kind:'neon',color:'cyan',from:{point:[-4,.155,2]},to:{point:[4,.155,5]},points:[[0,.155,2],[0,.155,5]]},
  ]);
  e.pickSelection(null);e.view.sync(true);e.view.camera.controls.enableDamping=false;
  e.view.camera.camera.position.set(16,27,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.logicTools.wiring)).toBe(false);
}
async function click(page:Page,point:number[]){
 const xy=await page.evaluate(async p=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,r=e.view.renderer.domElement.getBoundingClientRect();
  e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);
  return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];
 },point);
 await page.mouse.click(xy[0],xy[1]);
}
const wires=(page:Page)=>page.evaluate(()=>(window as any).timber.editor.world.wires);
const mode=(page:Page)=>page.evaluate(()=>{
 const e=(window as any).timber.editor;
 return {wiring:e.logicTools.wiring,placing:e.placing,gizmo:e.view.gizmo.root.visible};
});

test('Move redraws a single wire and Escape keeps its original route',async({page})=>{
 await setup(page);const original=await wires(page);
 await click(page,[0,.145,-3]);
 await expect.poll(()=>page.evaluate(()=>[...(window as any).timber.editor.wireSelection])).toEqual(['a']);
 await expect.poll(()=>mode(page)).toEqual({wiring:false,placing:false,gizmo:false});
 await page.keyboard.press('g');
 await expect.poll(()=>mode(page)).toEqual({wiring:true,placing:false,gizmo:false});
 expect(await wires(page)).toEqual(original);
 await click(page,[-5,0,-7]);await click(page,[3,0,-7]);
 await expect(page.locator('#wire-length-label')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect.poll(()=>mode(page)).toEqual({wiring:false,placing:false,gizmo:false});
 expect(await wires(page)).toEqual(original);
 await expect(page.locator('#wire-length-label')).toBeHidden();
});

test('Move translates multiple selected wires together without changing their routes or creating copies',async({page})=>{
 await setup(page);const original=await wires(page);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.copyWithArrows=true;e.pickSelections([],['a','b']);e.pointer=null;});
 await expect.poll(()=>mode(page)).toEqual({wiring:false,placing:false,gizmo:true});
 await page.keyboard.press('g');
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.placing)).toBe(true);
 expect((await mode(page)).wiring).toBe(false);
 await page.keyboard.press('l');await page.locator('[data-nudge="up"]').click();await page.locator('[data-nudge="up"]').click();await page.locator('#commit-preview').click();
 const after=await wires(page);expect(after).toHaveLength(original.length);
 after.forEach((w:any,index:number)=>{
  const before=original[index];expect(w.id).toBe(before.id);expect(w.kind).toBe(before.kind);expect(w.color).toBe(before.color);expect(w.frame).toEqual(before.frame??[0,0,0,1]);
  const route=[w.from.point,...w.points,w.to.point],source=[before.from.point,...before.points,before.to.point];expect(route).toHaveLength(source.length);
  route.forEach((point:number[],i:number)=>point.forEach((v:number,axis:number)=>expect(v).toBeCloseTo(source[i][axis]+(axis===1?2:0),10)));
 });
 await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
});

test('Duplicate keeps single-wire whole-route copying',async({page})=>{
 await setup(page);const original=await wires(page);
 await click(page,[-2,.155,2]);await page.evaluate(()=>(window as any).timber.editor.pointer=null);await page.keyboard.press('Control+d');
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.placing)).toBe(true);
 expect((await mode(page)).wiring).toBe(false);
 await page.keyboard.press('l');await page.locator('[data-nudge="up"]').click();await page.locator('#commit-preview').click();
 const after=await wires(page);expect(after).toHaveLength(3);expect(after.slice(0,2)).toEqual(original);
 const copy=after[2],source=original[1];expect(copy.id).not.toBe(source.id);expect(copy.kind).toBe('neon');expect(copy.color).toBe('cyan');
 expect(copy.from.point).toEqual(source.from.point.map((v:number,i:number)=>v+(i===1?1:0)));
 expect(copy.to.point).toEqual(source.to.point.map((v:number,i:number)=>v+(i===1?1:0)));
 expect(copy.points).toEqual(source.points.map((p:number[])=>p.map((v:number,i:number)=>v+(i===1?1:0))));
});

for(const kind of ['wire','neon'] as const){
 test(`Move replaces a ${kind} route across its old position and undoes as one edit`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
  const height=kind==='neon'?.155:.145;
  await page.evaluate(({kind,height})=>{
   const e=(window as any).timber.editor;
   e.world.load([],[12],[{id:'route',kind,...(kind==='neon'?{color:'cyan'}:{}),from:{point:[-4,height,-3]},to:{point:[4,height,-3]},points:[],frame:[0,0,0,1]}]);
   e.pickSelection(null);e.view.sync(true);
  },{kind,height});
  const original=await wires(page);await click(page,[0,height,-3]);await page.keyboard.press('g');
  await expect.poll(()=>mode(page)).toEqual({wiring:true,placing:false,gizmo:false});
  if(kind==='neon')await expect(page.locator('#wire-color-toggle')).toHaveAttribute('aria-label',/Cyan/);
  else await expect(page.locator('#wire-palette-panel')).toBeHidden();
  await click(page,[0,0,-7]);await click(page,[0,0,1]);await page.keyboard.press('Enter');
  await expect.poll(()=>mode(page)).toEqual({wiring:false,placing:false,gizmo:false});
  const after=await wires(page);expect(after).toHaveLength(1);
  const moved=after[0];expect(moved.id).toBe(original[0].id);expect(moved.kind).toBe(kind);expect(moved.color).toBe(original[0].color);expect(moved.frame).toEqual(original[0].frame);expect(moved.points).toEqual([]);
  for(const [actual,target] of [[moved.from.point,[0,height,-7]],[moved.to.point,[0,height,1]]] as [number[],number[]][]){
   actual.forEach((v,axis)=>expect(Math.abs(v-target[axis])).toBeLessThan(.04));
  }
  expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(0);
  await expect(page.locator('#wire-length-label')).toBeHidden();
  await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
  await page.keyboard.press('Control+Shift+z');expect(await wires(page)).toEqual(after);
  expect(errors).toEqual([]);
 });
}

test('Loading a project during wire pickup clears the draft and restores same-ID rendering',async({page})=>{
 await setup(page);await click(page,[0,.145,-3]);await page.keyboard.press('g');
 await expect.poll(()=>mode(page)).toEqual({wiring:true,placing:false,gizmo:false});
 await click(page,[-5,0,-7]);await click(page,[3,0,-7]);await expect(page.locator('#wire-length-label')).toBeVisible();
 const loaded=await page.evaluate(()=>{
  const e=(window as any).timber.editor;
  e.world.load([],[12],[{id:'a',kind:'wire',from:{point:[-3,.145,7]},to:{point:[3,.145,7]},points:[]}]);
  e.view.sync(true);return e.world.wires;
 });
 await expect.poll(()=>mode(page)).toEqual({wiring:false,placing:false,gizmo:false});
 expect(await wires(page)).toEqual(loaded);await expect(page.locator('#wire-length-label')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.wireIds)).toEqual(['a']);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.worldRoot.getObjectByName('Wire placement preview')?.visible)).toBe(false);
});
