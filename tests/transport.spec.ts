import {test,expect,type Page} from '@playwright/test';
// Observe the rendered orange control, including circuit-driven batch refreshes.
async function controlSide(page:Page,id:string){
 return page.evaluate(id=>{
  const v=(window as any).timber.editor.view;
  for(const group of v.loaded.values())for(const mesh of group.children)if(mesh.userData.ids?.includes(id)){
   const g=mesh.geometry,s=g.groups.find((s:any)=>s.materialIndex===2),p=g.getAttribute('position');
   let min=Infinity,max=-Infinity;for(let i=s.start;i<s.start+s.count;i++){min=Math.min(min,p.getX(i));max=Math.max(max,p.getX(i));}
   return (min+max)/2;
  }
  return 0;
 },id);
}
test('transport controls, reference views and reset preserve authored wood',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'belt1',item:'straight-conveyor',wood:'oak',position:[0,.5,0],rotation:[0,0,0]},
  {id:'belt2',item:'straight-conveyor',wood:'oak',position:[4,.5,0],rotation:[0,0,0]},
  {id:'wood',item:'loose-plank',wood:'oak',position:[-1,1.5,0],rotation:[0,0,0]},
 ],[12]);e.view.transport.update(0,e.view.logic.circuit);e.view.transport.paused=true;e.pickSelection(null);});
 for(const [name,pos] of [['three-quarter',[12,10,18]],['side',[13,3,3]],['top',[.01,22,4]],['low',[10,.7,12]]] as const){
  await page.evaluate(pos=>{const v=(window as any).timber.editor.view;v.camera.camera.position.set(...pos);v.camera.controls.target.set(2,.5,0);v.camera.controls.update();v.sync(true);},pos);
  await page.waitForTimeout(200);await page.screenshot({path:`release/conveyor-${name}.png`});
 }
 await page.locator('#transport-run').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood')?.position.x),{timeout:10000}).toBeGreaterThan(2);
 await page.locator('#transport-run').click();await expect(page.locator('#transport-run')).toHaveText('Resume wood');
 const paused=await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position.x);await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position.x)).toBe(paused);
 await page.locator('#transport-reset').click();
 expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('wood').position)).toEqual([-1,1.5,0]);
 await page.locator('#transport-run').click();await page.evaluate(()=>{const e=(window as any).timber.editor,p=e.world.pieces.get('wood');e.world.execute([{before:p,after:{...p,position:[0,3,-1]}}]);});await expect(page.locator('#transport-run')).toHaveText('Pause wood');
 await page.evaluate(()=>{const w=(window as any).timber.editor.world;w.plots=[12,13];w.revision++;});await expect(page.locator('#transport-run')).toHaveText('Pause wood');
 await expect.poll(()=>controlSide(page,'belt1')).toBeLessThan(0);
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('belt1'));await expect(page.locator('#logic-action')).toHaveText('Reverse direction');await page.locator('#logic-action').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('belt1').logicOn)).toBe(true);
 await expect.poll(()=>controlSide(page,'belt1')).toBeGreaterThan(0);
 await expect.poll(()=>controlSide(page,'belt2')).toBeLessThan(0);
 await page.locator('#build-tool').click();await page.locator('#search').fill('conveyor');await expect(page.locator('[data-item="straight-conveyor"]')).toBeVisible();
 expect(errors).toEqual([]);
});

async function setupLooseWood(page:Page,walking=false){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(walking=>{
  const e=(window as any).timber.editor,c=e.view.camera;e.world.load([{id:'wood',item:'loose-plank',wood:'oak',position:[0,.5,0],rotation:[0,0,0]}],[12]);e.pickSelection(null);c.controls.enableDamping=false;
  c.camera.position.set(0,6,14);c.controls.target.set(0,.5,0);c.controls.update();
  if(walking){c.setWalking(true);c.walkDistance=0;c.update(0);}e.view.sync(true);
 },walking);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.has('wood'))).toBe(true);
}
async function woodPoint(page:Page){return page.evaluate(async()=>{
 const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,b=e.view.transport.simulation.bodies.get('wood'),c=e.view.camera.camera;
 c.updateMatrixWorld();const p=new Vector3(b.position.x,b.position.y+.3,b.position.z).project(c),r=e.view.renderer.domElement.getBoundingClientRect();return [r.x+(p.x+1)*r.width/2,r.y+(1-p.y)*r.height/2] as [number,number];
});}
test('free camera grabs unsnapped live wood, scrolls its distance, drops, saves and selects it',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setupLooseWood(page);
 const [x,y]=await woodPoint(page);await page.mouse.move(x,y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBe('wood');
 await page.mouse.move(x+97,y-120,{steps:8});
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position.y)).toBeGreaterThan(1.5);
 const before=await page.evaluate(()=>{const e=(window as any).timber.editor,b=e.view.transport.simulation.bodies.get('wood'),c=e.view.camera.camera.position;return {camera:c.toArray(),distance:Math.hypot(b.position.x-c.x,b.position.y-c.y,b.position.z-c.z)};});
 await page.mouse.wheel(0,-160);
 await expect.poll(()=>page.evaluate(()=>{const e=(window as any).timber.editor,b=e.view.transport.simulation.bodies.get('wood'),c=e.view.camera.camera.position;return Math.hypot(b.position.x-c.x,b.position.y-c.y,b.position.z-c.z);})).toBeLessThan(before.distance-1);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.toArray())).toEqual(before.camera);
 const held=await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position);
 expect([held.x,held.y,held.z].some(n=>Math.abs(n-Math.round(n))>.03)).toBe(true);
 await page.screenshot({path:'release/wood-free-drag.png'});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBeNull();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position.y),{timeout:10000}).toBeLessThan(1.2);
 await page.locator('#transport-run').click();
 const snapshot=await page.evaluate(()=>{const e=(window as any).timber.editor,b=e.view.transport.simulation.bodies.get('wood');return {saved:e.project.pieces.find((p:any)=>p.id==='wood').position,live:[b.position.x,b.position.y,b.position.z]};});
 snapshot.saved.forEach((n:number,i:number)=>expect(n).toBeCloseTo(snapshot.live[i],4));expect(snapshot.saved).not.toEqual([0,.5,0]);
 await page.mouse.move(...await woodPoint(page));await page.keyboard.down('Control');await page.mouse.click(...await woodPoint(page));await page.keyboard.up('Control');
 expect(await page.evaluate(()=>(window as any).timber.editor.selected)).toBe('wood');
 await page.keyboard.press('Delete');await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.size)).toBe(0);
 await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.size)).toBe(1);
 const stored=await page.evaluate(async()=>{const e=(window as any).timber.editor,t=e.view.transport;t.paused=true;t.simulation.bodies.get('wood').position.x+=.123;await e.save();return e.project.pieces[0].position;});
 await expect(page.locator('#save-state')).toHaveText('Saved on this device',{timeout:500});
 await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.bodies.get('wood')?.position.x)).toBeCloseTo(stored[0],1);
 expect(errors).toEqual([]);
});
test('walk camera can carry wood and Escape or focus loss releases the grab',async({page})=>{
 await setupLooseWood(page,true);const [x,y]=await woodPoint(page);await page.mouse.move(x,y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBe('wood');
 await page.mouse.move(x+40,y-80,{steps:5});await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');
 expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.walking)).toBe(true);
 expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.walker.position.z)).toBeLessThan(13);
 await page.screenshot({path:'release/wood-walk-drag.png'});await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBeNull();await page.mouse.up();
 await page.mouse.move(...await woodPoint(page));await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBe('wood');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBeNull();await page.mouse.up();
});
test('wood remains draggable outside the plot after shifting the render origin',async({page})=>{
 await setupLooseWood(page);
 await page.evaluate(()=>{
  const e=(window as any).timber.editor,c=e.view.camera,p=e.world.pieces.get('wood');e.world.execute([{before:p,after:{...p,position:[256,.4,256]}}]);
  c.camera.position.set(256,6,270);c.controls.target.set(256,.4,256);c.controls.update();
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.origin.x)).toBe(256);
 await page.mouse.move(...await woodPoint(page));await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.transport.simulation.grabbedId)).toBe('wood');
 const [x,y]=await woodPoint(page);await page.mouse.move(x+80,y-100,{steps:8});
 await expect.poll(()=>page.evaluate(()=>{const p=(window as any).timber.editor.view.transport.simulation.bodies.get('wood').position;return Math.hypot(p.x-256,p.y-.4,p.z-256);})).toBeGreaterThan(.5);
 await page.mouse.up();
});
test('wired reversal updates the visible knob independently of the manual setting',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{
  const e=(window as any).timber.editor;
  e.world.load([
   {id:'belt',item:'straight-conveyor',wood:'oak',position:[0,.5,0],rotation:[0,0,0],logicOn:true},
   {id:'lever',item:'lever',wood:'oak',position:[6,.75,0],rotation:[0,0,0],logicOn:false},
  ],[12],[{id:'control',from:{piece:'lever',port:'out'},to:{piece:'belt',port:'in'},points:[]}]);
  e.view.sync(true);e.pickSelection('belt');
 });
 await expect.poll(()=>controlSide(page,'belt')).toBeLessThan(0);
 await expect(page.locator('#logic-action')).toBeDisabled();
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('lever'));
 await page.locator('#logic-action').click();
 await expect.poll(()=>controlSide(page,'belt')).toBeGreaterThan(0);
 await page.locator('#logic-action').click();
 await expect.poll(()=>controlSide(page,'belt')).toBeLessThan(0);
});
