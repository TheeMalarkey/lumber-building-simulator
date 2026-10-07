import {test,expect,type Page} from '@playwright/test';
import {openBuild,openWire} from './ui-helpers';

const routes=[
 {id:'regular',kind:'wire',from:{point:[-4,.145,-3]},to:{point:[4,.145,-3]},points:[]},
 {id:'neon',kind:'neon',color:'cyan',from:{point:[-4,.155,5]},to:{point:[4,.155,5]},points:[]},
];
async function setup(page:Page,pieces:any[]=[],wires:any[]=[]){
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(({pieces,wires})=>{
  const e=(window as any).timber.editor;e.world.load(pieces,[12],wires);e.world.allowOverlaps=false;e.copyWithArrows=false;e.pickSelection(null);e.view.sync(true);
  e.view.camera.controls.enableDamping=false;e.view.camera.camera.position.set(16,27,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();e.inspect();
 },{pieces,wires});
 await page.waitForFunction(()=>{const e=(window as any).timber.editor;return e.logicTools.generation===e.world.generation;});
}
async function choose(page:Page,kind:'wire'|'neon'){
 await openWire(page,kind);await page.locator('#collapse').click();
}
async function xy(page:Page,point:number[]){return page.evaluate(async p=>{
 const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,r=e.view.renderer.domElement.getBoundingClientRect();
 e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];
},point);}
async function click(page:Page,point:number[],ctrl=false){
 if(ctrl)await page.keyboard.down('Control');const p=await xy(page,point);await page.mouse.click(p[0],p[1]);if(ctrl)await page.keyboard.up('Control');
}
const wires=(page:Page)=>page.evaluate(()=>(window as any).timber.editor.world.wires);
async function imageReady(page:Page){
 await expect(page.locator('#wire-preview')).toBeVisible();
 await expect.poll(()=>page.locator('#wire-preview').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
}
async function blueprintBounds(page:Page){
 await openBuild(page);await page.locator('[data-category="All pieces"]').click();await page.locator('[data-item="small-floor"]').click();await page.locator('#collapse').click();
 await expect(page.locator('#edit-panel')).toBeVisible();return (await page.locator('#edit-panel').boundingBox())!;
}

test('regular wire placement uses the blueprint inspector header without a color selector',async({page})=>{
 await setup(page);const blueprint=await blueprintBounds(page);await choose(page,'wire');
 await expect(page.locator('#wire-palette-panel')).toBeVisible();await expect(page.locator('#edit-panel')).toBeHidden();
 await expect(page.locator('#wire-name')).toHaveText('Wire');await expect(page.locator('#wire-category')).toHaveText('WIRES');await imageReady(page);
 await expect(page.locator('#wire-size')).toBeHidden();await expect(page.locator('#wire-color-toggle')).toBeHidden();await expect(page.locator('#wire-colors')).toBeHidden();
 await expect(page.locator('#wire-close')).toBeVisible();await expect(page.locator('#wire-overlap-toggle')).toBeVisible();await expect(page.locator('#wire-axis-copy-toggle')).toBeVisible();
 await expect(page.locator('#wire-selection-actions')).toBeHidden();
 const panel=(await page.locator('#wire-palette-panel').boundingBox())!;expect(panel.width).toBeCloseTo(blueprint.width,0);expect(panel.x).toBeCloseTo(blueprint.x,0);expect(panel.y+panel.height).toBeCloseTo(blueprint.y+blueprint.height,0);
 const image=(await page.locator('#wire-preview').boundingBox())!;expect(image.width).toBe(46);expect(image.height).toBe(54);
 const close=(await page.locator('#wire-close').boundingBox())!;expect(close.width).toBe(24);expect(close.height).toBe(24);
});

test('neon placement keeps its color selector beside the wire header and recolors the preview',async({page})=>{
 await setup(page);await choose(page,'neon');await expect(page.locator('#wire-name')).toHaveText('Neon Wire');await expect(page.locator('#wire-category')).toHaveText('WIRES');await imageReady(page);
 await expect(page.locator('#wire-color-toggle')).toBeVisible();await expect(page.locator('#wire-colors')).toBeHidden();
 const header=(await page.locator('#wire-palette-panel .piece-summary').boundingBox())!,palette=(await page.locator('#wire-color-toggle').boundingBox())!;
 expect(palette.width).toBe(32);expect(palette.height).toBe(32);expect(palette.y).toBeGreaterThanOrEqual(header.y);expect(palette.y+palette.height).toBeLessThanOrEqual(header.y+header.height);
 await page.locator('#wire-color-toggle').click();await page.locator('[data-wire-color="pink"]').click();await expect(page.locator('#wire-color-toggle')).toHaveAttribute('aria-label','Neon color: Pink');
 await click(page,[-4,0,0]);const end=await xy(page,[4,0,0]);await page.mouse.move(end[0],end[1]);await expect(page.locator('#wire-length-label')).toHaveText('8.0/16');
 await click(page,[4,0,0]);await page.keyboard.press('Enter');await expect.poll(async()=>(await wires(page)).length).toBe(1);expect((await wires(page))[0]).toMatchObject({kind:'neon',color:'pink'});
});

for(const kind of ['wire','neon'] as const)test(`${kind} inspector close cancels a draft and deselects a route without deleting it`,async({page})=>{
 const route=routes[kind==='wire'?0:1];await setup(page,[],[route]);await choose(page,kind);
 await click(page,[-4,0,0]);const end=await xy(page,[4,0,0]);await page.mouse.move(end[0],end[1]);await expect(page.locator('#wire-length-label')).toBeVisible();
 await page.locator('#wire-close').click();await expect(page.locator('#wire-palette-panel')).toBeHidden();await expect(page.locator('#wire-length-label')).toBeHidden();await expect(page.locator('#select-tool')).toHaveClass(/active/);expect(await wires(page)).toEqual([route]);
 await click(page,kind==='wire'?[0,.145,-3]:[0,.155,5]);await expect(page.locator('#wire-name')).toHaveText(kind==='wire'?'Wire':'Neon Wire');await expect(page.locator('#wire-selection-actions')).toBeVisible();
 await expect(page.locator('#wire-duplicate')).toBeVisible();await expect(page.locator('#wire-delete')).toBeVisible();await page.locator('#wire-close').click();
 await expect(page.locator('#wire-palette-panel')).toBeHidden();expect(await wires(page)).toEqual([route]);
});

test('a mixed wire group uses one inspector and keeps the neon palette and selection actions',async({page})=>{
 await setup(page,[],routes);await click(page,[0,.145,-3]);await click(page,[0,.155,5],true);
 await expect(page.locator('#wire-name')).toHaveText('2 wires');await expect(page.locator('#wire-category')).toHaveText('GROUP SELECTION');await expect(page.locator('#wire-preview')).toBeHidden();await expect(page.locator('#edit-panel')).toBeHidden();
 await expect(page.locator('#wire-color-toggle')).toHaveAttribute('aria-label','Neon color: Cyan');await expect(page.locator('#wire-duplicate')).toBeVisible();await expect(page.locator('#wire-delete')).toBeVisible();
 await page.locator('#wire-color-toggle').click();await page.locator('[data-wire-color="red"]').click();expect((await wires(page)).map((w:any)=>w.color??null)).toEqual([null,'red']);
 const beforeCopy=await wires(page);await page.locator('#wire-duplicate').click();await expect(page.locator('#edit-panel')).toBeVisible();await expect(page.locator('#hold-position')).toBeVisible();expect(await wires(page)).toEqual(beforeCopy);
 await page.locator('#close-edit').click();await click(page,[0,.145,-3]);await click(page,[0,.155,5],true);
 await page.locator('#wire-delete').click();expect(await wires(page)).toEqual([]);await page.locator('#undo').click();expect((await wires(page)).map((w:any)=>w.id)).toEqual(['regular','neon']);
});

test('mixed blueprint and neon selection retains the blueprint inspector with one usable neon color control',async({page})=>{
 await setup(page,[{id:'floor',item:'small-floor',wood:'oak',position:[-6,.5,0],rotation:[0,0,0]}],[routes[1]]);
 await click(page,[-6,.8,0]);await click(page,[0,.155,5],true);await expect(page.locator('#edit-panel')).toBeVisible();await expect(page.locator('#piece-name')).toHaveText('1 blueprint · 1 wire');
 await expect(page.locator('#wire-preview')).toBeHidden();await expect(page.locator('#wire-name')).toBeHidden();await expect(page.locator('#wire-close')).toBeHidden();await expect(page.locator('#wire-selection-actions')).toBeHidden();
 await expect(page.locator('#overlap-toggle')).toBeVisible();await expect(page.locator('#axis-copy-toggle')).toBeVisible();await expect(page.locator('#wire-overlap-toggle')).toBeHidden();await expect(page.locator('#wire-axis-copy-toggle')).toBeHidden();
 await expect(page.locator('#wire-color-toggle')).toBeVisible();await page.locator('#wire-color-toggle').click();await page.locator('[data-wire-color="blue"]').click();expect((await wires(page))[0].color).toBe('blue');
});

test('wire inspector and header palette fit phone and landscape viewports like blueprint controls',async({page})=>{
 await setup(page);
 for(const [width,height] of [[390,844],[320,640],[844,390]]){
  await page.setViewportSize({width,height});const blueprint=await blueprintBounds(page);
  for(const kind of ['wire','neon'] as const){
   await choose(page,kind);await imageReady(page);await expect(page.locator('#wire-close')).toBeInViewport();await expect(page.locator('#wire-overlap-toggle')).toBeInViewport();await expect(page.locator('#wire-axis-copy-toggle')).toBeInViewport();
   const panel=(await page.locator('#wire-palette-panel').boundingBox())!;expect(panel.width).toBeCloseTo(blueprint.width,0);expect(panel.x).toBeGreaterThanOrEqual(8);expect(panel.x+panel.width).toBeLessThanOrEqual(width-8);expect(panel.y).toBeGreaterThanOrEqual(50);expect(panel.height).toBeLessThan(200);
   if(kind==='neon'){await page.locator('#wire-color-toggle').click();await expect(page.locator('[data-wire-color="pink"]')).toBeInViewport();await page.locator('[data-wire-color="pink"]').click();}
   else await expect(page.locator('#wire-color-toggle')).toBeHidden();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
});
