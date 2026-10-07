import {test,expect,type Page} from '@playwright/test';
import {openWire} from './ui-helpers';

async function point(page:Page,p:number[]){return page.evaluate(async p=>{
 const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=(window as any).timber.editor,r=e.view.renderer.domElement.getBoundingClientRect();
 e.view.camera.camera.updateMatrixWorld();const v=new Vector3(...p).project(e.view.camera.camera);return [r.x+(v.x+1)*r.width/2,r.y+(1-v.y)*r.height/2];
},p);}

for(const kind of ['wire','neon'] as const)test(`${kind} places an acute bend through the actual surface controls and undoes the route`,async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).timber);
 await page.evaluate(()=>{const e=(window as any).timber.editor;e.world.load([],[12]);e.world.allowOverlaps=false;e.copyWithArrows=false;e.logicTools.tick();e.pickSelection(null);e.view.sync(true);e.view.camera.controls.enableDamping=false;e.view.camera.camera.position.set(16,27,30);e.view.camera.controls.target.set(0,0,0);e.view.camera.controls.update();});
 await openWire(page,kind);await page.locator('#collapse').click();await expect(page.locator('#wire-overlap-toggle')).not.toBeChecked();
 for(const p of [[-5,0,0],[0,0,0]]){const xy=await point(page,p);await page.mouse.click(xy[0],xy[1]);}
 // The two legs meet with a 30-degree interior angle, much sharper than a right angle.
 const end=[-3.464101615,0,2],xy=await point(page,end);await page.mouse.move(xy[0],xy[1]);
 await expect(page.locator('#wire-length-label')).toHaveText(`9.0/${kind==='neon'?16:20}`);
 await expect(page.locator('#wire-length-label')).not.toHaveClass(/wire-invalid/);
 await page.mouse.click(xy[0],xy[1]);await page.keyboard.press('Enter');
 const wires=await page.evaluate(()=>(window as any).timber.editor.world.wires);expect(wires).toHaveLength(1);expect(wires[0].kind).toBe(kind);expect(wires[0].points).toHaveLength(1);
 const h=kind==='neon'?.155:.145;
 for(const [actual,wanted] of [[wires[0].from.point,[-5,h,0]],[wires[0].points[0],[0,h,0]],[wires[0].to.point,[-3.464101615,h,2]]])actual.forEach((v:number,i:number)=>expect(v).toBeCloseTo(wanted[i],5));
 await expect(page.locator('#wire-length-label')).toBeHidden();await page.keyboard.press('Control+z');expect(await page.evaluate(()=>(window as any).timber.editor.world.wires)).toEqual([]);
 await page.keyboard.press('Control+Shift+z');expect(await page.evaluate(()=>(window as any).timber.editor.world.wires)).toEqual(wires);
});
