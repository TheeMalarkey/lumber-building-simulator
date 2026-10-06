import {test,expect,type Page} from '@playwright/test';
import {openWire} from './ui-helpers';

async function setup(page:Page){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12]);e.pickSelection(null);e.view.sync(true);e.view.camera.camera.position.set(16,27,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
 await openWire(page);
}
async function xy(page:Page,p:number[]){return page.evaluate(async p=>{const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,rect=e.view.renderer.domElement.getBoundingClientRect();e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];},p);}
async function click(page:Page,p:number[]){const v=await xy(page,p);await page.mouse.click(v[0],v[1]);}
const count=(page:Page)=>page.evaluate(()=>(window as any).timber.editor.world.wires.length);

test('Select picks individual wires for button or keyboard deletion and undo',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12],[
  {id:'regular',kind:'wire',from:{point:[-5,.145,-3]},to:{point:[5,.145,-3]},points:[]},
  {id:'neon',kind:'neon',color:'cyan',from:{point:[-5,.155,3]},to:{point:[5,.155,3]},points:[]},
 ]);e.view.sync(true);});
 await click(page,[0,.145,-3]);
 await expect(page.locator('#wire-selection-panel')).toBeVisible();
 await expect(page.locator('#wire-selection-name')).toHaveText('Wire selected');
 await page.locator('#delete-wire').click();
 expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.map((w:any)=>w.id))).toEqual(['neon']);
 await expect(page.locator('#wire-selection-panel')).toBeHidden();
 await page.keyboard.press('Control+z');expect(await count(page)).toBe(2);
 await click(page,[0,.155,3]);await expect(page.locator('#wire-selection-name')).toHaveText('Cyan neon selected');
 await page.keyboard.press('Delete');
 expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.map((w:any)=>w.id))).toEqual(['regular']);
 await page.keyboard.press('Control+z');expect(await count(page)).toBe(2);
 await click(page,[0,.155,3]);await page.keyboard.press('Escape');await page.keyboard.press('Delete');expect(await count(page)).toBe(2);
});

test('Select picks the front wire at a crossing and respects blueprint occlusion',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12],[
  {id:'lower',kind:'wire',from:{point:[-5,.145,0]},to:{point:[5,.145,0]},points:[]},
  {id:'upper',kind:'neon',color:'pink',from:{point:[0,.6,-5]},to:{point:[0,.6,5]},points:[]},
 ]);e.view.sync(true);e.view.camera.camera.position.set(0,25,.001);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
 await click(page,[0,.6,0]);await page.keyboard.press('Backspace');
 expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.map((w:any)=>w.id))).toEqual(['lower']);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([{before:null,after:{id:'cover',item:'large-floor',wood:'oak',position:[0,1,0],rotation:[0,0,0]}}]);e.view.sync(true);});
 await click(page,[0,1.1,0]);await expect(page.locator('#wire-selection-panel')).toBeHidden();
 expect(await page.evaluate(()=>(window as any).timber.editor.selected)).toBe('cover');
 expect(await count(page)).toBe(1);
});

test('wire picking tolerance does not steal a click on a neighboring blueprint',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([
  {id:'gate',item:'signal-inverter',wood:'oak',position:[0,.5,0],rotation:[0,0,0]},
 ],[12],[{id:'beside',kind:'wire',from:{point:[-4,.145,.65]},to:{point:[4,.145,.65]},points:[]}]);
 e.view.sync(true);e.view.camera.camera.position.set(0,30,.001);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
 await click(page,[0,1,.47]);
 expect(await page.evaluate(()=>(window as any).timber.editor.selected)).toBe('gate');
 await expect(page.locator('#wire-selection-panel')).toBeHidden();
});

test('a just-deleted wire cannot be selected before the next render frame',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12],[{id:'wire',kind:'wire',from:{point:[-5,.145,0]},to:{point:[5,.145,0]},points:[]}]);e.view.sync(true);});
 await click(page,[0,.145,0]);await expect(page.locator('#wire-selection-panel')).toBeVisible();
 const point=await xy(page,[0,.145,0]);
 expect(await page.evaluate(([x,y])=>{const e=(window as any).timber.editor;e.world.execute([],[]);return e.logicTools.selectAt(x,y);},point)).toBe(false);
 await expect(page.locator('#wire-selection-panel')).toBeHidden();
});

test('surface routing finishes without a second socket and enforces the full 20-stud route',async({page})=>{
 await setup(page);await click(page,[-8,0,-6]);await click(page,[-8,0,6]);await click(page,[1,0,6]);
 await expect(page.locator('#toast')).toContainText('20');expect(await count(page)).toBe(0);
 await click(page,[-1,0,6]);await page.locator('#wire-finish').click();expect(await count(page)).toBe(1);
 const w=await page.evaluate(()=>(window as any).timber.editor.world.wires[0]);expect(w.kind).toBe('wire');expect(w.points).toHaveLength(1);expect(w.from.point[1]).toBeCloseTo(.145);expect(w.to.point[0]).toBeCloseTo(-1);
 await page.keyboard.press('Control+z');expect(await count(page)).toBe(0);await page.keyboard.press('Control+Shift+z');expect(await count(page)).toBe(1);
});
test('neon has its own budget and preserves chosen color on save/reload',async({page})=>{
 await setup(page);await page.locator('[data-wire-kind="neon"]').click();await page.locator('[data-wire-color="pink"]').click();
 await click(page,[-8,0,-4]);await click(page,[9,0,-4]);await expect(page.locator('#wire-feedback')).toContainText('16');expect(await count(page)).toBe(0);
 await click(page,[7.9,0,-4]);await page.keyboard.press('Enter');expect(await count(page)).toBe(1);
 await page.keyboard.press('Control+s');await expect(page.locator('#save-state')).toHaveText('Saved on this device');await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
 const w=await page.evaluate(()=>(window as any).timber.editor.world.wires[0]);expect(w.kind).toBe('neon');expect(w.color).toBe('pink');expect(w.from.point[1]).toBeCloseTo(.155);
});
test('routes up a wall, updates after Backspace, and rejects unowned ground',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'wall',item:'fat-door',wood:'birch',position:[0,4,0],rotation:[0,0,0]}],[12]);e.view.sync(true);e.view.camera.camera.position.set(3,7,16);e.view.camera.controls.target.set(0,4,0);e.view.camera.controls.update();});
 await openWire(page);await click(page,[-1,1,.25]);await click(page,[-1,6,.25]);await click(page,[1,6,.25]);await page.keyboard.press('Backspace');
 await expect(page.locator('#wire-status')).toContainText('1 surface points');await page.keyboard.press('Enter');
 const w=await page.evaluate(()=>(window as any).timber.editor.world.wires[0]);expect(w.from.point[2]).toBeCloseTo(.395);expect(w.to.point[1]).toBeCloseTo(6,1);expect(w.to.point[0]).toBeCloseTo(-1,1);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.view.camera.camera.position.set(30,26,38);e.view.camera.controls.target.set(12,0,0);e.view.camera.controls.update();});
 await click(page,[23,0,0]);await expect(page.locator('#toast')).toContainText('active plots');expect(await count(page)).toBe(1);
});
test('renders powered and unpowered wire variants without WebGL errors while walking',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor,colors=['white','red','orange','yellow','green','cyan','blue','violet','pink'];
  const pieces=colors.map((color,i)=>({id:'l'+i,item:'lever',wood:'oak',position:[-5,.75,(i-4)*2],rotation:[0,0,0],logicOn:true}));
  const wires=colors.map((color,i)=>({id:'n'+i,kind:'neon',color,from:{piece:'l'+i,port:'out'},to:{point:[5,.18,(i-4)*2]},points:[]}));
  pieces.push({id:'regular',item:'lever',wood:'oak',position:[-5,.75,10],rotation:[0,0,0],logicOn:true});wires.push({id:'basic',kind:'wire',from:{piece:'regular',port:'out'},to:{point:[5,.18,10]},points:[]} as any);
  e.world.load(pieces,[12],wires);e.pickSelection(null);e.view.sync(true);e.view.grid.visible=false;e.view.camera.camera.position.set(9,17,22);e.view.camera.controls.target.set(0,0,1);e.view.camera.controls.update();
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.wires.root.getObjectByName('Neon glow').count)).toBe(8);
 await page.screenshot({path:'artifacts/wires-powered.png'});
 await page.locator('#menu-tool').click();await page.locator('#settings').click();await page.locator('#night-preview').check();await page.locator('#close-modal').click();
 await page.screenshot({path:'artifacts/wires-night.png'});
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([...e.world.pieces.values()].map((p:any)=>({before:p,after:{...p,logicOn:false}})));});
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.wires.root.getObjectByName('Neon glow').count)).toBe(0);
 await page.screenshot({path:'artifacts/wires-off.png'});
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([...e.world.pieces.values()].map((p:any)=>({before:p,after:{...p,logicOn:true}})));e.view.camera.setWalking(true);e.view.camera.walker.position.set(0,0,3);e.view.camera.walker.velocity.set(0,0,0);e.view.camera.walker.grounded=true;});
 await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
 await page.screenshot({path:'artifacts/wires-walk.png'});
 expect(errors).toEqual([]);
});
test('duplicates a single wired lever, and joins neon at a regular wire end',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'l',item:'lever',wood:'oak',position:[-7,.75,-3],rotation:[0,0,0],logicOn:true}],[12],[{id:'n',kind:'neon',color:'green',from:{piece:'l',port:'out'},to:{point:[-1,.18,-3]},points:[]},{id:'b',kind:'wire',from:{piece:'l',port:'out'},to:{point:[-1,.18,3]},points:[[-6,.18,3]]}]);e.view.sync(true);e.pickSelection('l');});
 await page.keyboard.press('Control+d');await click(page,[6,0,-3]);
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(2);
 expect(await count(page)).toBe(4);expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.filter((w:any)=>w.kind==='neon'&&w.color==='green').length)).toBe(2);
 await openWire(page,'neon');await page.locator('[data-wire-color="red"]').click();
 await click(page,[-1.05,.18,3]);await click(page,[4,0,6]);await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>{const e=(window as any).timber.editor;return e.view.logic.circuit.wireOn(e.world.wires.at(-1).id);})).toBe(true);
 expect(await count(page)).toBe(5);
});
test('a rejected stretch restores inspector coordinates and keeps move placement active',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;const a={id:'a',item:'lever',wood:'oak',position:[-8,.75,0],rotation:[0,0,0]},b={...a,id:'b',position:[7,.75,0]};e.world.load([a,b],[12],[{id:'w',kind:'neon',color:'cyan',from:{piece:'a',port:'out'},to:{piece:'b',port:'out'},points:[]}]);e.view.sync(true);e.pickSelection('b');});
 await page.locator('#coordinates-details summary').click();await page.locator('#pos-0').fill('10');await page.locator('#pos-0').press('Tab');await expect(page.locator('#toast')).toContainText('16-stud');await expect(page.locator('#pos-0')).toHaveValue('7');
 await page.locator('#move-tool').click();await click(page,[11,0,0]);expect(await page.evaluate(()=>(window as any).timber.editor.placing)).toBe(true);expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.get('b').position[0])).toBe(7);
});
test('undoing a starting component cancels its unfinished wire safely',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);await page.locator('#wire-done').click();await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.execute([{before:null,after:{id:'l',item:'lever',wood:'oak',position:[0,.75,0],rotation:[0,0,0]}}]);e.pickSelection('l');});
 await page.locator('[data-port="out"]').click();await page.keyboard.press('Control+z');
 await expect(page.locator('#wire-status')).toContainText('Click a surface');expect(errors).toEqual([]);
});

test('blocks a crossing and uses Shift-click to continue over an existing wire',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12],[{id:'host',kind:'neon',color:'cyan',from:{point:[-4,.155,0]},to:{point:[4,.155,0]},points:[]}]);e.view.sync(true);});
 // Loading a build closes the tool; reopen after the frame has observed it.
 await expect(page.locator('#wiring-panel')).toBeHidden();await openWire(page);
 await click(page,[0,0,-4]);await click(page,[0,0,4]);
 await expect(page.locator('#wire-feedback')).toContainText('cannot pass through');
 expect(await count(page)).toBe(1);
 await page.keyboard.down('Shift');await click(page,[0,.155,0]);await page.keyboard.up('Shift');
 await expect(page.locator('#wire-status')).toContainText('1 surface points');expect(await count(page)).toBe(1);
 await click(page,[0,0,4]);await page.keyboard.press('Enter');expect(await count(page)).toBe(2);
 const over=await page.evaluate(()=>(window as any).timber.editor.world.wires[1]);
 expect(over.points).toHaveLength(1);expect(over.points[0][1]).toBeGreaterThan(.4);
 await page.screenshot({path:'artifacts/wires-overpass.png'});
});

test('can build on a wire body without power, and connect power at its end cap',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'l',item:'lever',wood:'oak',position:[-6,.75,0],rotation:[0,0,0],logicOn:true}],[12],[{id:'host',kind:'wire',from:{piece:'l',port:'out'},to:{point:[4,.18,0]},points:[]}]);e.view.sync(true);});
 await openWire(page,'neon');
 await click(page,[0,.18,0]);await click(page,[0,0,5]);await page.keyboard.press('Enter');
 expect(await count(page)).toBe(2);
 const from=await page.evaluate(()=>(window as any).timber.editor.world.wires[1].from.point);expect(from[1]).toBeGreaterThan(.42);
 await expect.poll(()=>page.evaluate(()=>{const e=(window as any).timber.editor;return e.view.logic.circuit.wireOn(e.world.wires[1].id);})).toBe(false);
 await click(page,[6,0,3]);await click(page,[3.95,.18,0]);expect(await count(page)).toBe(3);
 await expect.poll(()=>page.evaluate(()=>{const e=(window as any).timber.editor;return e.view.logic.circuit.wireOn(e.world.wires[2].id);})).toBe(true);
});

test('builds directly along another wire without sharing power through their bodies',async({page})=>{
 await setup(page);await page.locator('#wire-done').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([{id:'l',item:'lever',wood:'oak',position:[-6,.75,0],rotation:[0,0,0],logicOn:true}],[12],[{id:'host',kind:'wire',from:{piece:'l',port:'out'},to:{point:[4,.18,0]},points:[]}]);e.view.sync(true);e.view.camera.camera.position.set(6,4,8);e.view.camera.controls.target.set(0,.3,0);e.view.camera.controls.update();e.view.grid.visible=false;});
 await openWire(page);await click(page,[-2,.18,0]);await click(page,[2,.18,0]);
 expect(await count(page)).toBe(2);
 await expect.poll(()=>page.evaluate(()=>{const e=(window as any).timber.editor;return e.view.logic.circuit.wireOn(e.world.wires[1].id);})).toBe(false);
 const placed=await page.evaluate(()=>(window as any).timber.editor.world.wires[1]);expect(placed.from.point[1]).toBeGreaterThan(.4);expect(placed.to.point[1]).toBeGreaterThan(.4);
 await page.locator('#wire-done').click();await page.screenshot({path:'artifacts/wires-stacked.png'});
});
