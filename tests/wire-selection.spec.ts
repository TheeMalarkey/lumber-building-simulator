import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,circuit=false){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(circuit=>{const e=(window as any).timber.editor;
 const pieces=circuit?[{id:'lever',item:'lever',wood:'oak',position:[-5,.75,0],rotation:[0,0,0],logicOn:true},{id:'lamp',item:'lamp',wood:'oak',position:[5,1,0],rotation:[0,0,0]}]:[];
 const wires=circuit?[{id:'lead',kind:'neon',color:'cyan',from:{piece:'lever',port:'out'},to:{piece:'lamp',port:'in'},points:[[0,.18,0]]},{id:'loose',kind:'wire',from:{point:[-4,.145,5]},to:{point:[4,.145,5]},points:[]}]:[
  {id:'a',kind:'wire',from:{point:[-4,.145,-3]},to:{point:[4,.145,-3]},points:[]},
  {id:'b',kind:'neon',color:'pink',from:{point:[-4,.155,0]},to:{point:[4,.155,0]},points:[]},
  {id:'c',kind:'wire',from:{point:[-4,.145,5]},to:{point:[4,.145,5]},points:[]},
 ];e.world.load(pieces,[12],wires);e.pickSelection(null);e.view.sync(true);e.view.camera.controls.enableDamping=false;e.view.camera.camera.position.set(12,24,28);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();},circuit);
}
async function xy(page:Page,p:number[]){return page.evaluate(async p=>{const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,rect=e.view.renderer.domElement.getBoundingClientRect();e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);return [rect.x+(v.x+1)*rect.width/2,rect.y+(1-v.y)*rect.height/2];},p);}
async function click(page:Page,p:number[],ctrl=false){if(ctrl)await page.keyboard.down('Control');await page.mouse.click(...await xy(page,p) as [number,number]);if(ctrl)await page.keyboard.up('Control');}
const selected=(page:Page)=>page.evaluate(()=>{const e=(window as any).timber.editor;return {pieces:[...e.selection].sort(),wires:[...(e.wireSelection??[])].sort()};});
const wires=(page:Page)=>page.evaluate(()=>(window as any).timber.editor.world.wires);
async function rectangle(page:Page,from:number[],to:number[]){const a=await xy(page,from),b=await xy(page,to);await page.keyboard.down('Control');await page.mouse.move(a[0],a[1]);await page.mouse.down();await page.mouse.move(b[0],b[1],{steps:6});await page.mouse.up();await page.keyboard.up('Control');}
async function arrowUp(page:Page,studs=6){
 const points=await page.evaluate(studs=>{const e=(window as any).timber.editor,g=e.view.gizmo,r=e.view.renderer.domElement.getBoundingClientRect();const p=g.root.position.clone();p.y+=g.root.scale.x*.7;const q=p.clone();q.y+=studs;const project=(v:any)=>{v.project(e.view.camera.camera);return [r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2];};return [project(p),project(q)];},studs);
 await page.mouse.move(points[0][0],points[0][1]);await page.mouse.down();await page.mouse.move(points[1][0],points[1][1],{steps:8});await page.mouse.up();
}

test('Ctrl-click toggles multiple wires and Delete removes only the selected routes in one undo',async({page})=>{
 await setup(page);const original=await wires(page);await click(page,[0,.145,-3]);await click(page,[0,.155,0],true);await click(page,[0,.145,5],true);await click(page,[0,.155,0],true);
 expect(await selected(page)).toEqual({pieces:[],wires:['a','c']});await expect(page.locator('#wire-selection-name')).toHaveText('2 wires selected');
 await page.keyboard.press('Delete');expect((await wires(page)).map((w:any)=>w.id)).toEqual(['b']);
 await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);await page.keyboard.press('Control+Shift+z');expect((await wires(page)).map((w:any)=>w.id)).toEqual(['b']);
});

test('Ctrl-drag selects wires in either direction and clears on Escape',async({page})=>{
 await setup(page);await rectangle(page,[-6,0,-5],[6,0,1]);expect(await selected(page)).toEqual({pieces:[],wires:['a','b']});
 await page.keyboard.press('Escape');expect((await selected(page)).wires).toEqual([]);
 await rectangle(page,[6,0,1],[-6,0,-5]);expect(await selected(page)).toEqual({pieces:[],wires:['a','b']});
});

test('mixed deletion preserves unselected leads with a free end and undoes the whole group',async({page})=>{
 await setup(page,true);const original=await wires(page);await click(page,[-5,.3,0]);await click(page,[0,.145,5],true);
 expect(await selected(page)).toEqual({pieces:['lever'],wires:['loose']});await page.keyboard.press('Delete');
 const after=await wires(page);expect(after).toHaveLength(1);expect(after[0].id).toBe('lead');expect(after[0].from.point).toHaveLength(3);
 expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(1);
 await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(2);
});

test('copies wire-only selections with Ctrl+D and the held placement controls',async({page})=>{
 await setup(page);await click(page,[0,.145,-3]);await click(page,[0,.155,0],true);const original=await wires(page);
 await page.keyboard.press('Control+d');await page.keyboard.press('l');await page.locator('[data-nudge="up"]').click();await page.locator('[data-nudge="up"]').click();await page.locator('#commit-preview').click();
 const after=await wires(page);expect(after).toHaveLength(5);expect(after.slice(0,3)).toEqual(original);
 const copies=after.filter((w:any)=>!['a','b','c'].includes(w.id));expect(copies.map((w:any)=>w.kind)).toEqual(['wire','neon']);expect(copies[1].color).toBe('pink');
 expect((await selected(page)).wires).toHaveLength(2);await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);
});

test('copies mixed circuit selections with axis arrows and reconnects the copied sockets',async({page})=>{
 await setup(page,true);await rectangle(page,[-8,0,-3],[8,2,2]);
 expect(await selected(page)).toEqual({pieces:['lamp','lever'],wires:['lead']});const original=await wires(page);
 await page.locator('#axis-copy-toggle').check();
 await arrowUp(page);
 const after=await wires(page);expect(after).toHaveLength(3);expect(after.slice(0,2)).toEqual(original);const copy=after[2];expect(copy.from.piece).not.toBe('lever');expect(copy.to.piece).not.toBe('lamp');
 await expect.poll(()=>page.evaluate((id:string)=>(window as any).timber.editor.view.logic.circuit.input(id),copy.to.piece)).toBe(true);
 await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(original);expect(await page.evaluate(()=>(window as any).timber.editor.world.pieces.size)).toBe(2);
});

test('moving components with arrows does not select their unselected leads for deletion',async({page})=>{
 await setup(page,true);await page.evaluate(()=>{const e=(window as any).timber.editor,p=e.world.pieces.get('lever');e.world.load([p],[12],[{id:'lead',kind:'wire',from:{piece:p.id,port:'out'},to:{point:[4,.18,0]},points:[]}]);e.pickSelection(p.id);e.view.sync(true);});
 await arrowUp(page,3);expect(await selected(page)).toEqual({pieces:['lever'],wires:[]});const moved=await wires(page);
 expect(moved[0].to.point[1]).toBeGreaterThan(2);await page.keyboard.press('Delete');const after=await wires(page);expect(after).toHaveLength(1);expect(after[0].from.point).toHaveLength(3);
 await page.keyboard.press('Control+z');expect(await wires(page)).toEqual(moved);
});
