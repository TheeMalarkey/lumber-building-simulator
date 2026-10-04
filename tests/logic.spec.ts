import {test,expect} from '@playwright/test';
import {CATALOG} from '../src/catalog';
test('builds a visible wired lever circuit, operates lights and persists edits',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.locator('#build-tool').click();await page.locator('[data-category="Logic"]').click();await expect(page.locator('.catalog-card')).toHaveCount(12);
 await page.locator('[data-item="lever"]').click();await expect(page.locator('#wood-picker')).toBeHidden();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'lever',item:'lever',position:[-6,.75,0],rotation:[0,0,0],wood:'oak'},
  {id:'gate',item:'signal-inverter',position:[0,.5,0],rotation:[0,0,0],wood:'oak'},
  {id:'light',item:'worklight',position:[6,1.5,0],rotation:[0,0,0],wood:'oak',lightOn:false}
 ],[12]);e.view.sync(true);e.pickSelection('lever');e.view.camera.camera.position.set(14,13,19);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
 const socket=async(id:string,port:string)=>page.evaluate(async({id,port})=>{const {Vector3}=await import('/node_modules/three/build/three.module.js');const {portPosition}=await import('/src/logic-ports.ts');const e=(window as any).timber.editor,rect=e.view.renderer.domElement.getBoundingClientRect(),v=new Vector3(...portPosition(e.world.pieces.get(id),port)).project(e.view.camera.camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];},{id,port});
 await page.locator('[data-port="out"]').click();let xy=await socket('gate','in');await page.mouse.click(xy[0],xy[1]);
 xy=await socket('gate','out');await page.mouse.click(xy[0],xy[1]);xy=await socket('light','in');await page.mouse.click(xy[0],xy[1]);await page.locator('#wire-done').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(2);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('light'))).toBe(true);
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('lever'));await page.locator('#logic-action').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('light'))).toBe(false);
 await page.locator('#logic-action').click();await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(2);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.pickSelections(['lever','gate','light']);});
 await page.locator('#delete-tool').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(0);await page.locator('#undo').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(2);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.pickSelection(null);e.view.camera.camera.position.set(14,13,19);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
 await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/logic-circuit.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#wire-tool').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#select-tool').click();await expect(page.locator('#wiring-panel')).toBeHidden();expect(await page.evaluate(()=>(window as any).timber.editor.logicTools.wiring)).toBe(false);
 await page.locator('#wire-tool').click();await page.locator('#build-tool').click();await expect(page.locator('#wiring-panel')).toBeHidden();
 expect(errors).toEqual([]);
});
test('walks onto a pressure plate to power a light, then walks off',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'plate',item:'pressure-plate',position:[0,.15,0],rotation:[0,0,0],wood:'oak'},
  {id:'lamp',item:'lamp',position:[8,1.5,0],rotation:[0,0,0],wood:'oak',lightOn:false}], [12],
  [{id:'w',from:{piece:'plate',port:'out'},to:{piece:'lamp',port:'in'},points:[[3,.06,3],[7,.06,3]]}]);e.pickSelection(null);e.view.sync(true);e.view.camera.setWalking(true);e.view.camera.yaw=0;e.view.camera.walker.position.set(-4,0,0);e.view.camera.walker.velocity.set(0,0,0);e.view.camera.walker.grounded=true;});
 await page.keyboard.down('d');await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(true);await page.keyboard.up('d');
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.camera.walker.position.y)).toBeCloseTo(.3,2);
 await page.keyboard.down('a');await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.lightStates.get('lamp'))).toBe(false);await page.keyboard.up('a');
 await page.evaluate(()=>(window as any).timber.editor.pickSelection('lamp'));await expect(page.locator('#light-toggle')).toBeDisabled();await expect(page.locator('#logic-status')).toContainText('Controlled by wire');
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([],[]);});await expect(page.locator('#light-toggle')).toBeEnabled();await expect(page.locator('#light-toggle')).not.toBeChecked();
});
test('renders all twelve logic models and the distinct timer faces',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(items=>{const e=(window as any).timber.editor;e.world.load(items.map((p,i)=>({id:p.id,item:p.id,wood:'oak',position:[(i%4-1.5)*6,p.size[1]/2,(Math.floor(i/4)-1)*6],rotation:[0,0,0],timing:7})),[12]);e.view.sync(true);e.pickSelection(null);e.view.camera.camera.position.set(16,19,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();},CATALOG.filter(p=>p.category==='Logic'));
 await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/logic-gallery.png'});
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load(['signal-delay','signal-sustain'].map((item,i)=>({id:item,item,wood:'oak',position:[i*3-1.5,1,0],rotation:[0,0,0],timing:7})),[12]);e.view.sync(true);e.view.camera.camera.position.set(4.2,3.8,7.6);e.view.camera.controls.target.set(0,1,0);e.view.camera.controls.update();e.view.grid.visible=false;});
 await page.waitForTimeout(600);await page.screenshot({path:'artifacts/logic-timers.png'});expect(errors).toEqual([]);
});

test('shows confirmed circuit dimensions and upgrades old timers without floating or moving sockets',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.locator('#build-tool').click();await page.locator('[data-category="Logic"]').click();
 for(const [id,size] of [['signal-delay','2 × 2 × 2'],['signal-sustain','2 × 2 × 2'],['signal-inverter','2 × 1 × 1']])
  await expect(page.locator(`[data-item="${id}"] .card-size`)).toHaveText(size);
 const old={version:1,logicModelVersion:2,name:'Timer scale',plots:[12],pieces:[
  {id:'delay',item:'signal-delay',position:[-3,1.25,0],rotation:[0,0,0],wood:'oak',timing:12},
  {id:'sustain',item:'signal-sustain',position:[0,1.25,0],rotation:[0,0,0],wood:'oak',timing:7},
  {id:'inverter',item:'signal-inverter',position:[3,.5,0],rotation:[0,0,0],wood:'oak'},
 ],wires:[{id:'w',from:{piece:'delay',port:'out'},to:{piece:'sustain',port:'in'},points:[]}]};
 await page.locator('#file-input').setInputFiles({name:'timers.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
 await page.locator('#confirm-action').click();
 const sockets=await page.evaluate(async()=>{
  const {portPosition}=await import('/src/logic-ports.ts');const e=(window as any).timber.editor;
  return [portPosition(e.world.pieces.get('delay'),'out'),portPosition(e.world.pieces.get('sustain'),'in')];
 });
 expect(sockets).toEqual([[-2,.25,0],[-1,.25,0]]);
 await page.locator('#select-tool').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.pickSelection(null);e.view.camera.camera.position.set(5,5,9);e.view.camera.controls.target.set(0,.7,0);e.view.camera.controls.update();});
 await page.waitForTimeout(200);await page.screenshot({path:'artifacts/logic-circuit-scale.png'});
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 const project=await page.evaluate(()=>(window as any).timber.editor.project);
 expect(project.logicModelVersion).toBe(3);expect(project.wires).toEqual(old.wires);
 expect(project.pieces.find((p:any)=>p.id==='delay').position).toEqual([-3,1,0]);
 expect(project.pieces.find((p:any)=>p.id==='sustain').position).toEqual([0,1,0]);
 expect(project.pieces.find((p:any)=>p.id==='delay').timing).toBe(12);
});

test('legacy levers keep their mounts and wiring across import, save and repeated reloads',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 const legacy={version:1,name:'Lever poses',plots:[12],pieces:[
  {id:'off',item:'lever',position:[-2,1,0],rotation:[0,0,0],wood:'oak'},
  {id:'on',item:'lever',position:[2,1,0],rotation:[0,0,0],wood:'oak',logicOn:true},
  {id:'wall',item:'lever',position:[8,3,0],rotation:[0,0,1],wood:'oak'}
 ],wires:[{id:'tail',from:{piece:'off',port:'out'},to:{point:[0,.18,0]},points:[]}]};
 await page.locator('#file-input').setInputFiles({name:'legacy.timber',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await page.locator('#confirm-action').click();
 for(let i=0;i<2;i++){
  const saved=await page.evaluate(()=>(window as any).timber.editor.project);
  expect(saved.logicModelVersion).toBe(3);expect(saved.pieces.find((p:any)=>p.id==='off').position).toEqual([-2,.75,0]);
  expect(saved.pieces.find((p:any)=>p.id==='wall').position[0]).toBeCloseTo(8.25);
  expect(saved.wires).toEqual(legacy.wires);
  await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 }
 const picked=await page.evaluate(async()=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js');
  const e=(window as any).timber.editor,v=e.view;
  v.camera.camera.position.set(2,12,.001);v.camera.controls.target.set(2,0,0);v.camera.controls.update();
  v.camera.camera.updateMatrixWorld();
  const rect=v.renderer.domElement.getBoundingClientRect(),point=new Vector3(2-.69,1.1,0).project(v.camera.camera);
  return v.pick(rect.x+(point.x+1)*rect.width/2,rect.y+(1-point.y)*rect.height/2);
 });
 expect(picked.id).toBe('on');expect(picked.point[1]).toBeGreaterThan(1);
 await page.evaluate(()=>{
  const e=(window as any).timber.editor;
  e.world.load([...e.world.pieces.values()].filter(p=>p.id!=='wall'),[12]);e.pickSelection(null);e.view.sync(true);
  e.view.camera.camera.position.set(4.5,5.2,7.8);e.view.camera.controls.target.set(0,.6,0);e.view.camera.controls.update();e.view.grid.visible=false;
 });
 await page.waitForTimeout(300);await page.screenshot({path:'artifacts/logic-lever-world.png'});
 expect(errors).toEqual([]);
});
