import {test,expect,type Page} from '@playwright/test';
import {openWire} from './ui-helpers';

type Kind='wire'|'neon';
const routes=[
 {id:'regular',kind:'wire',from:{point:[-4,.145,-3]},to:{point:[4,.145,-1]},points:[[0,.145,-3],[0,.145,-1]],frame:[0,0,0,1]},
 {id:'neon',kind:'neon',color:'cyan',from:{point:[-4,.155,3]},to:{point:[4,.155,5]},points:[[-1,.155,3],[-1,.155,5]],frame:[0,0,0,1]},
];
async function setup(page:Page,pieces:any[]=[],wires:any[]=[]){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(({pieces,wires})=>{
  const e=(window as any).timber.editor;e.world.load(pieces,[12],wires);e.world.allowOverlaps=false;e.copyWithArrows=false;e.pickSelection(null);e.view.sync(true);
  e.view.camera.controls.enableDamping=false;e.view.camera.camera.position.set(16,27,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();e.inspect();
 },{pieces,wires});
 await page.waitForFunction(()=>{const e=(window as any).timber.editor;return e.logicTools.generation===e.world.generation;});
}
async function choose(page:Page,kind:Kind){await openWire(page,kind);await page.locator('#collapse').click();}
async function xy(page:Page,point:number[]){return page.evaluate(async p=>{
 const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,r=e.view.renderer.domElement.getBoundingClientRect();
 e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];
},point);}
async function click(page:Page,point:number[],ctrl=false){
 if(ctrl)await page.keyboard.down('Control');const p=await xy(page,point);await page.mouse.click(p[0],p[1]);if(ctrl)await page.keyboard.up('Control');
}
const wires=(page:Page)=>page.evaluate(()=>(window as any).timber.editor.world.wires);
const selected=(page:Page)=>page.evaluate(()=>[...(window as any).timber.editor.wireSelection].sort());
async function selectRoutes(page:Page){
 await click(page,[-2,.145,-3]);await click(page,[-3,.155,3],true);await expect.poll(()=>selected(page)).toEqual(['neon','regular']);
 await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();
}
async function arrowUp(page:Page,studs:number){
 const points=await page.evaluate(studs=>{
  const e=(window as any).timber.editor,g=e.view.gizmo,r=e.view.renderer.domElement.getBoundingClientRect(),p=g.root.position.clone();p.y+=g.root.scale.x*.7;
  const q=p.clone();q.y+=studs;const project=(v:any)=>{v.project(e.view.camera.camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];};return [project(p),project(q)];
 },studs);
 await page.mouse.move(points[0][0],points[0][1]);await page.mouse.down();await page.mouse.move(points[1][0],points[1][1],{steps:8});await page.mouse.up();
}
function expectTranslated(actual:any,source:any,dy:number){
 expect(actual.kind).toBe(source.kind);expect(actual.color).toBe(source.color);expect(actual.frame).toEqual(source.frame);
 const want=[source.from.point,...source.points,source.to.point],got=[actual.from.point,...actual.points,actual.to.point];
 expect(got).toHaveLength(want.length);got.forEach((p:number[],i:number)=>p.forEach((v,axis)=>expect(v).toBeCloseTo(want[i][axis]+(axis===1?dy:0),8)));
}

for(const kind of ['wire','neon'] as const){
 test(`${kind} placement and single selection expose overlap and arrow-copy controls`,async({page})=>{
  await setup(page,[],[routes[kind==='wire'?0:1]]);await choose(page,kind);
  await expect(page.locator('#wire-palette-panel')).toBeVisible();await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();
  await expect(page.locator('#wire-overlap-toggle')).not.toBeChecked();await expect(page.locator('#wire-axis-copy-toggle')).not.toBeChecked();
  if(kind==='wire')await expect(page.locator('#wire-color-toggle')).toBeHidden();else await expect(page.locator('#wire-color-toggle')).toBeVisible();
  await page.locator('#select-tool').click();await expect(page.locator('#wire-palette-panel')).toBeHidden();
  await click(page,kind==='wire'?[-2,.145,-3]:[-3,.155,3]);await expect(page.locator('#wire-palette-panel')).toBeVisible();
  await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).timber.editor.view.gizmo.root.visible)).toBe(false);
  await page.locator('#wire-axis-copy-toggle').check();await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.gizmo.root.visible)).toBe(true);
  await page.locator('#wire-axis-copy-toggle').uncheck();await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.gizmo.root.visible)).toBe(false);
  await page.locator('#viewport>canvas').focus();await page.keyboard.press('g');await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.logicTools.wiring)).toBe(true);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.gizmo.root.visible)).toBe(false);await expect(page.locator('#wire-overlap-toggle')).toBeVisible();
  await page.keyboard.press('Escape');expect(await wires(page)).toHaveLength(1);
 });

 test(`Allow overlap permits a crossing ${kind} draft and disabling it preserves placed routes`,async({page})=>{
  const host={id:'host',kind:'neon',color:'pink',from:{point:[-4,.155,0]},to:{point:[4,.155,0]},points:[]};
  await setup(page,[],[host]);await choose(page,kind);await expect(page.locator('#wire-overlap-toggle')).toBeVisible();
  await click(page,[0,0,-4]);await click(page,[0,0,4]);await expect(page.locator('#toast')).toContainText('cannot pass through');expect(await wires(page)).toHaveLength(1);
  await expect(page.locator('#wire-length-label')).toHaveClass(/wire-invalid/);await page.locator('#wire-overlap-toggle').check();
  await expect(page.locator('#wire-length-label')).not.toHaveClass(/wire-invalid/);
  await click(page,[0,0,4]);await page.keyboard.press('Enter');await expect.poll(async()=>(await wires(page)).length).toBe(2);
  const placed=await wires(page);expect(placed[1].kind).toBe(kind);expect(placed[1].points).toEqual([]);
  await page.locator('#wire-overlap-toggle').uncheck();expect(await wires(page)).toEqual(placed);
  await page.locator('#viewport>canvas').focus();await page.keyboard.press('Control+z');expect(await wires(page)).toEqual([host]);
 });

 test(`Allow overlap retains ${kind} length, ground, and active-plot draft limits`,async({page})=>{
  await setup(page);await choose(page,kind);await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await page.locator('#wire-overlap-toggle').check();
  const height=kind==='neon'?.155:.145;
  for(const fixture of [
   {from:[-12,height,0],to:[12,height,0],message:/limited to/},
   {from:[0,height,-4],to:[0,0,4],message:/above the ground/},
   {from:[18,height,-4],to:[21,height,-4],message:/active plots/},
  ]){
   await page.evaluate(({from,to})=>{const t=(window as any).timber.editor.logicTools;t.begin({point:from});t.addBend(to);t.finishSurface();},{from:fixture.from,to:fixture.to});
   await expect(page.locator('#toast')).toContainText(fixture.message);expect(await wires(page)).toEqual([]);
   await expect(page.locator('#wire-length-label')).toHaveClass(/wire-invalid/);await page.locator('#viewport>canvas').focus();await page.keyboard.press('Escape');
  }
  await expect(page.locator('#wire-overlap-toggle')).toBeChecked();
 });
}

test('wire overlap and blueprint overlap controls share the same placement setting',async({page})=>{
 await setup(page,[{id:'floor',item:'small-floor',wood:'oak',position:[-4,.5,0],rotation:[0,0,0]}]);await choose(page,'wire');
 await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await page.locator('#wire-overlap-toggle').check();await page.locator('#select-tool').click();
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.pickSelection('floor');e.move(true);e.pointer=null;e.held=true;e.ghost={...structuredClone(e.world.pieces.get('floor')),id:'ghost'};e.inspect();e.updateGhost();});
 await expect(page.locator('#overlap-toggle')).toBeChecked();await page.locator('#commit-preview').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(2);
 await page.locator('#overlap-toggle').uncheck();await page.locator('#commit-preview').click();expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(2);
 await page.locator('#select-tool').click();await choose(page,'neon');await expect(page.locator('#wire-overlap-toggle')).not.toBeChecked();
});

test('Allow overlap permits moving a wire group through existing routes in one undo',async({page})=>{
 const original=[
  {id:'a',kind:'wire',from:{point:[-4,2,-3]},to:{point:[4,2,-3]},points:[]},
  {id:'b',kind:'neon',color:'cyan',from:{point:[-4,2,3]},to:{point:[4,2,3]},points:[]},
  {id:'block-a',kind:'wire',from:{point:[-4,3,-3]},to:{point:[4,3,-3]},points:[]},
  {id:'block-b',kind:'wire',from:{point:[-4,3,3]},to:{point:[4,3,3]},points:[]},
 ];
 await setup(page,[],original);await page.evaluate(()=>{const e=(window as any).timber.editor;e.pickSelections([],['a','b']);});
 await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await page.evaluate(()=>(window as any).timber.editor.nudge('up'));expect(await wires(page)).toEqual(original);
 await page.locator('#wire-overlap-toggle').check();await page.evaluate(()=>(window as any).timber.editor.nudge('up'));
 const after=await wires(page);expect(after).toHaveLength(4);expect(after.slice(2)).toEqual(original.slice(2));expect(after[0].from.point).toEqual([-4,3,-3]);expect(after[1].from.point).toEqual([-4,3,3]);
 await page.locator('#viewport>canvas').focus();await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
});

test('Copy with arrows duplicates two complete wire routes and undoes both copies together',async({page})=>{
 await setup(page,[],routes);await selectRoutes(page);const original=await wires(page);await page.locator('#wire-axis-copy-toggle').check();await arrowUp(page,3);
 const after=await wires(page);expect(after).toHaveLength(4);expect(after.slice(0,2)).toEqual(original);const copies=after.slice(2);
 copies.forEach((copy:any,i:number)=>{expect(copy.id).not.toBe(original[i].id);expectTranslated(copy,original[i],3);});expect(new Set(after.map((w:any)=>w.id)).size).toBe(4);
 expect(await selected(page)).toEqual(copies.map((w:any)=>w.id).sort());await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
 await page.keyboard.press('Control+Shift+z');expect(await wires(page)).toEqual(after);
});

test('Copy with arrows gives a single selected wire an intact-route copy and one undo',async({page})=>{
 await setup(page,[],[routes[0]]);await click(page,[-2,.145,-3]);const original=await wires(page);
 await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();await page.locator('#wire-axis-copy-toggle').check();
 await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.view.gizmo.root.visible)).toBe(true);await arrowUp(page,2);
 const after=await wires(page);expect(after).toHaveLength(2);expect(after[0]).toEqual(original[0]);expect(after[1].id).not.toBe(original[0].id);expectTranslated(after[1],original[0],2);
 await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
});

test('disabling Copy with arrows moves both wire routes without creating copies',async({page})=>{
 await setup(page,[],routes);await selectRoutes(page);const original=await wires(page);await page.locator('#wire-axis-copy-toggle').check();await page.locator('#wire-axis-copy-toggle').uncheck();await arrowUp(page,2);
 const after=await wires(page);expect(after).toHaveLength(2);after.forEach((route:any,i:number)=>{expect(route.id).toBe(original[i].id);expectTranslated(route,original[i],2);});
 expect(await selected(page)).toEqual(['neon','regular']);await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
});
