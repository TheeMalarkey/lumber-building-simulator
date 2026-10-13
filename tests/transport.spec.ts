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
 ],[12]);e.pickSelection(null);});
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
 await page.locator('#transport-run').click();await page.evaluate(()=>{const e=(window as any).timber.editor,p=e.world.pieces.get('wood');e.world.execute([{before:p,after:{...p,position:[0,3,-1]}}]);});await expect(page.locator('#transport-run')).toHaveText('Test wood');
 await page.locator('#transport-run').click();await page.evaluate(()=>{const w=(window as any).timber.editor.world;w.plots=[12,13];w.revision++;});await expect(page.locator('#transport-run')).toHaveText('Test wood');
 await expect.poll(()=>controlSide(page,'belt1')).toBeLessThan(0);
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('belt1'));await expect(page.locator('#logic-action')).toHaveText('Reverse direction');await page.locator('#logic-action').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('belt1').logicOn)).toBe(true);
 await expect.poll(()=>controlSide(page,'belt1')).toBeGreaterThan(0);
 await expect.poll(()=>controlSide(page,'belt2')).toBeLessThan(0);
 await page.locator('#build-tool').click();await page.locator('#search').fill('conveyor');await expect(page.locator('[data-item="straight-conveyor"]')).toBeVisible();
 expect(errors).toEqual([]);
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
