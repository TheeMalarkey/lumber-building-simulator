import {test,expect,type Page} from '@playwright/test';
import {openWire,openBuild} from './ui-helpers';

async function setup(page:Page){
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.copyWithArrows=false;e.world.load([],[12]);e.pickSelection(null);e.view.sync(true);e.view.camera.controls.enableDamping=false;e.view.camera.camera.position.set(16,27,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.logicTools.wiring)).toBe(false);
}
async function xy(page:Page,p:number[]){return page.evaluate(async p=>{const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,r=e.view.renderer.domElement.getBoundingClientRect();e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];},p);}
async function click(page:Page,p:number[]){const v=await xy(page,p);await page.mouse.click(v[0],v[1]);}
async function choose(page:Page,kind:'wire'|'neon') {await openWire(page,kind);await page.locator('#collapse').click();}
const draft=(page:Page)=>page.evaluate(()=>{const root=(window as any).timber.editor.view.worldRoot.getObjectByName('Wire placement preview'),tubes=root?.getObjectByName('Wire tubes and ends');return {visible:!!root?.visible,tubes:tubes?.count,opacity:tubes?.material.opacity};});

test('wire tools share compact overlap and copy controls with a neon-only color palette',async({page})=>{
  await setup(page);await choose(page,'wire');
  await expect(page.locator('#wiring-panel,#wire-selection-panel')).toHaveCount(0);
  await expect(page.locator('#wire-palette-panel')).toBeVisible();
  await expect(page.locator('#wire-color-toggle')).toBeHidden();
  await expect(page.locator('#wire-overlap-toggle')).toBeVisible();
  await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();
  await expect(page.locator('#wire-length-label')).toBeHidden();
  await choose(page,'neon');
  await expect(page.locator('#wire-palette-panel')).toBeVisible();
  await expect(page.locator('#wire-colors')).toBeHidden();
  await page.locator('#wire-color-toggle').focus();await page.keyboard.press('Enter');
  await expect(page.locator('[data-wire-color="cyan"]')).toHaveAttribute('title',/Cyan/);
  await page.locator('[data-wire-color="cyan"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#wire-colors')).toBeHidden();
  await expect(page.locator('#wire-color-toggle')).toHaveAttribute('aria-label',/Cyan/);
  await page.locator('#select-tool').click();
  await expect(page.locator('#wire-palette-panel')).toBeHidden();
  await openBuild(page);await page.locator('[data-category="All pieces"]').click();await page.locator('[data-item="smooth-wall"]').click();
  await expect(page.locator('#placement-bar')).toBeHidden();
});

test('placement renders the actual wire body with midpoint length and adds collars only when finished',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page);await choose(page,'wire');await click(page,[-4,0,0]);
  const end=await xy(page,[4,0,0]);await page.mouse.move(end[0],end[1]);
  await expect(page.locator('#wire-length-label')).toHaveText('8.0/20');
  await expect.poll(()=>draft(page)).toEqual({visible:true,tubes:1,opacity:1});
  const midpoint=await xy(page,[0,.145,0]);const bounds=await page.locator('#wire-length-label').boundingBox();
  expect(Math.abs(bounds!.x+bounds!.width/2-midpoint[0])).toBeLessThan(3);
  expect(Math.abs(bounds!.y+bounds!.height/2-midpoint[1])).toBeLessThan(3);
  await click(page,[4,0,0]);await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(1);
  await expect(page.locator('#wire-length-label')).toBeHidden();
  expect((await draft(page)).visible).toBe(false);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.logic.wires.root.getObjectByName('Wire tubes and ends').count)).toBe(3);
  expect(errors).toEqual([]);
});

test('length follows the route midpoint through bends and camera changes, and clears on cancel',async({page})=>{
  await setup(page);await choose(page,'neon');await click(page,[-6,0,-4]);await click(page,[-6,0,2]);
  const end=await xy(page,[4,0,2]);await page.mouse.move(end[0],end[1]);
  await expect(page.locator('#wire-length-label')).toHaveText('16.0/16');
  const center=await xy(page,[-4,.155,2]);let bounds=await page.locator('#wire-length-label').boundingBox();
  expect(Math.abs(bounds!.x+bounds!.width/2-center[0])).toBeLessThan(3);
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.view.camera.camera.position.set(-16,27,30);e.view.camera.controls.update();});
  const newEnd=await xy(page,[4,0,2]);await page.mouse.move(newEnd[0],newEnd[1]);
  await expect(page.locator('#wire-length-label')).toHaveText('16.0/16');
  const newCenter=await xy(page,[-4,.155,2]);bounds=await page.locator('#wire-length-label').boundingBox();
  expect(Math.abs(bounds!.x+bounds!.width/2-newCenter[0])).toBeLessThan(3);
  await page.keyboard.press('Escape');await expect(page.locator('#wire-length-label')).toBeHidden();
  expect((await draft(page)).visible).toBe(false);
  expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.length)).toBe(0);
});

test('selected neon groups use the palette without recoloring regular wires, and undo restores their colors',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12],[
    {id:'a',kind:'neon',color:'cyan',from:{point:[-4,.155,-3]},to:{point:[4,.155,-3]},points:[]},
    {id:'b',kind:'neon',color:'pink',from:{point:[-4,.155,0]},to:{point:[4,.155,0]},points:[]},
    {id:'c',kind:'wire',from:{point:[-4,.145,3]},to:{point:[4,.145,3]},points:[]},
  ]);e.view.sync(true);});
  await click(page,[0,.155,-3]);await page.keyboard.down('Control');await click(page,[0,.155,0]);await click(page,[0,.145,3]);await page.keyboard.up('Control');
  await expect(page.locator('#wire-color-toggle')).toHaveAttribute('aria-label','Neon color: Mixed colors');
  await page.locator('#wire-color-toggle').click();await page.locator('[data-wire-color="red"]').click();
  expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.map((w:any)=>w.color??null))).toEqual(['red','red',null]);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(()=>(window as any).timber.editor.world.wires.map((w:any)=>w.color??null))).toEqual(['cyan','pink',null]);
  await page.keyboard.press('Escape');await expect(page.locator('#wire-palette-panel')).toBeHidden();
});

test('neon palette stays compact on phones and changing color updates an active body preview',async({page})=>{
  await setup(page);await choose(page,'neon');await click(page,[-4,0,0]);const end=await xy(page,[4,0,0]);await page.mouse.move(end[0],end[1]);
  await page.locator('#wire-color-toggle').click();await page.locator('[data-wire-color="blue"]').click();
  await page.mouse.move(end[0],end[1]);
  await expect(page.locator('#wire-color-toggle')).toHaveAttribute('aria-label','Neon color: Blue');
  await expect.poll(()=>page.evaluate(()=>{const e=(window as any).timber.editor,t=e.view.worldRoot.getObjectByName('Wire placement preview').getObjectByName('Wire tubes and ends');return [...t.instanceColor.array.slice(0,3)];})).toEqual([0,0,1]);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#wire-color-toggle')).toBeInViewport();
  const compact=await page.locator('#wire-palette-panel').boundingBox();expect(compact!.width).toBe(245);expect(compact!.height).toBeLessThan(200);
  await expect(page.locator('#wire-overlap-toggle')).toBeInViewport();await expect(page.locator('#wire-axis-copy-toggle')).toBeInViewport();
  await page.locator('#wire-color-toggle').click();await expect(page.locator('[data-wire-color="pink"]')).toBeInViewport();
  await page.mouse.click(180,320);await expect(page.locator('#wire-colors')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const copying of [false,true])test(`multi-wire arrows ${copying?'copy':'move'} when Copy with arrows is ${copying?'enabled':'disabled'}`,async({page})=>{
  await setup(page);await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12],[{id:'w',kind:'wire',from:{point:[-4,.145,0]},to:{point:[4,.145,0]},points:[]},{id:'w2',kind:'wire',from:{point:[-4,.145,4]},to:{point:[4,.145,4]},points:[]}]);e.view.sync(true);});
  await click(page,[0,.145,0]);await page.keyboard.down('Control');await click(page,[0,.145,4]);await page.keyboard.up('Control');
  const original=await page.evaluate(()=>(window as any).timber.editor.world.wires);
  await page.locator('#wire-axis-copy-toggle').setChecked(copying);
  const points=await page.evaluate(()=>{const e=(window as any).timber.editor,g=e.view.gizmo,r=e.view.renderer.domElement.getBoundingClientRect(),p=g.root.position.clone();p.y+=g.root.scale.x*.7;const q=p.clone();q.y+=2;const project=(v:any)=>{v.project(e.view.camera.camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];};return [project(p),project(q)];});
  await page.mouse.move(points[0][0],points[0][1]);await page.mouse.down();await page.mouse.move(points[1][0],points[1][1],{steps:8});await page.mouse.up();
  const wires=await page.evaluate(()=>(window as any).timber.editor.world.wires);
  expect(wires).toHaveLength(copying?4:2);expect(wires[0].id).toBe('w');expect(wires[1].id).toBe('w2');
  if(copying)expect(wires.slice(0,2)).toEqual(original);
  const moved=copying?wires.slice(2):wires;
  moved.forEach((wire:any,index:number)=>{
    expect(wire.kind).toBe(original[index].kind);expect(wire.from.point[1]).toBeCloseTo(2.145);expect(wire.to.point[1]).toBeCloseTo(2.145);
    if(copying)expect(wire.id).not.toBe(original[index].id);
  });
  await page.keyboard.press('Control+z');expect(await page.evaluate(()=>(window as any).timber.editor.world.wires)).toEqual(original);
});
