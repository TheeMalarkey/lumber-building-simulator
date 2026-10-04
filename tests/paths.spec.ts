import { test, expect, type Page } from "@playwright/test";

async function setup(page:Page,item="small-floor",offset=0) {
  await page.goto("/"); await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate(({item,offset})=>{
    const e=(window as any).timber.editor;
    e.pickSelection(null);e.world.load([],offset ? null : [12]);
    const c=e.view.camera;c.controls.enableDamping=false;c.controls.target.set(offset,4,0);c.top();c.camera.updateMatrixWorld();
    e.choose(item);
  },{item,offset});
}
async function screen(page:Page,point:number[]) {
  return page.evaluate(point=>{
    const v=(window as any).timber.editor.view, r=v.renderer.domElement.getBoundingClientRect();
    const p=v.camera.camera.position.clone().fromArray(point).project(v.camera.camera);
    return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2];
  },point);
}
async function dragPath(page:Page,from:number[],to:number[],ctrl=false,finish=true) {
  const a=await screen(page,from),b=await screen(page,to);
  await page.mouse.move(a[0],a[1]);if(ctrl) await page.keyboard.down("Control");
  await page.mouse.down();await page.mouse.move(b[0],b[1],{steps:8});
  if(finish) await page.mouse.up();if(ctrl) await page.keyboard.up("Control");
}
async function clickPoint(page:Page,point:number[]) {const p=await screen(page,point);await page.mouse.click(p[0],p[1]);}
const pieces=(page:Page)=>page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()]);

test("Ctrl drag builds a straight stud run and undo removes the whole run",async({page})=>{
  await setup(page);const camera=await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.toArray());
  await dragPath(page,[-10,0,-6],[2,0,-6],true);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+i*2,.5,-6]));
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.toArray())).toEqual(camera);
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(0);
  await page.locator("#redo").click();expect(await pieces(page)).toHaveLength(7);
});

test("straight mode fills spans only after overlap validation succeeds",async({page})=>{
  await setup(page);await page.locator("#build-mode").selectOption("line");await page.locator("#path-fill").check();
  await dragPath(page,[-10,0,-6],[-6,0,-6]);expect(await pieces(page)).toHaveLength(0);
  await expect(page.locator("#path-status")).toContainText("intersect");
  await page.locator("#overlap-toggle").check();await page.locator("#path-build").click();
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:5},(_,i)=>[-10+i,.5,-6]));
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(0);
});

test("cancelled drags retain the build and release camera controls",async({page})=>{
  await setup(page);await dragPath(page,[-10,0,-6],[2,0,-6],true,false);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.selecting)).toBe(true);
  await page.keyboard.press("Escape");await page.mouse.up();expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>(window as any).timber.editor.placing)).toBe(true);
  await dragPath(page,[-10,0,-6],[2,0,-6],true,false);
  await page.evaluate(()=>window.dispatchEvent(new Event("blur")));await page.mouse.up();expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.selecting)).toBe(false);
  await dragPath(page,[-10,0,-6],[2,0,-6],true);
  expect(await pieces(page)).toHaveLength(7);
});

test("multi-point curves edit height with axis arrows and commit on Enter",async({page})=>{
  await setup(page,"smooth-wall");await page.locator("#build-mode").selectOption("curve");await page.locator("#overlap-toggle").check();
  // Leave clearance for wall corners as the curve gains a vertical tangent.
  await page.locator("#elevation").fill("2");
  for(const p of [[-12,0,0],[0,0,-10],[12,0,0]]) await clickPoint(page,p);
  expect(await pieces(page)).toHaveLength(0);await expect(page.locator("#path-status")).toContainText("3 points");
  await page.evaluate(()=>{
    const e=(window as any).timber.editor,c=e.view.camera;c.camera.position.set(24,25,36);c.controls.target.set(0,5,0);c.controls.update();
  });
  await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
  const drag=await page.evaluate(()=>{
    const e=(window as any).timber.editor,g=e.view.gizmo,r=e.view.renderer.domElement.getBoundingClientRect();
    const a=g.root.position.clone();a.y+=g.root.scale.x*.7;const b=a.clone();b.y+=3;
    const project=(p:any)=>{p.project(e.view.camera.camera);return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]};return [project(a),project(b)];
  });
  await page.mouse.move(drag[0][0],drag[0][1]);await page.mouse.down();await page.mouse.move(drag[1][0],drag[1][1],{steps:8});await page.mouse.up();
  expect(await page.evaluate(()=>(window as any).timber.editor.paths.anchors[2][1])).toBe(9);
  await page.keyboard.press("Enter");const run=await pieces(page);
  expect(run.length).toBeGreaterThan(6);expect(run.some((p:any)=>p.position[1]>6)).toBe(true);
  expect(run.some((p:any)=>p.rotation.some((v:number)=>!Number.isInteger(v)))).toBe(true);
  await page.keyboard.press("Control+s");await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);expect(await pieces(page)).toEqual(run);
});

test("smart wedges expose ramp and wall/arch modes and generate catalog pieces",async({page})=>{
  await setup(page,"1-4-wedge");await page.locator("#build-mode").selectOption("wedge");await page.locator("#overlap-toggle").check();
  await expect(page.locator("#wedge-mode")).toHaveValue("ramp");
  await clickPoint(page,[-10,0,-6]);await clickPoint(page,[2,0,-6]);
  await expect(page.locator("#path-build")).toBeEnabled();await page.locator("#path-build").click();
  const ramp=await pieces(page);expect(ramp.length).toBeGreaterThan(2);expect(ramp.some((p:any)=>p.position[1]>.5)).toBe(true);
  await page.locator("#undo").click();await page.evaluate(()=>(window as any).timber.editor.choose("1-4-wedge"));
  await page.locator("#wedge-mode").selectOption("wall-arch");
  for(const p of [[-12,0,0],[0,0,-10],[12,0,0]]) await clickPoint(page,p);
  await page.locator("#path-build").click();const wall=await pieces(page);
  expect(wall.length).toBeGreaterThan(4);expect(wall.every((p:any)=>p.item.includes("wedge") && p.position[1]===2)).toBe(true);
});

test("paths reject out-of-land batches and support distant point guides",async({page})=>{
  await setup(page);await page.locator("#build-mode").selectOption("line");
  await dragPath(page,[-10,0,-6],[22,0,-6]);expect(await pieces(page)).toHaveLength(0);
  await expect(page.locator("#path-status")).toContainText("active plots");await page.locator("#path-cancel").click();
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([],null);const c=e.view.camera;c.controls.target.set(512,4,0);c.top();
  });
  await dragPath(page,[502,0,-6],[514,0,-6]);expect((await pieces(page)).map((p:any)=>p.position[0])).toEqual([502,504,506,508,510,512,514]);
});

test("curve dots select existing points, remove them, and retain a draft around Ctrl runs",async({page})=>{
  await setup(page,"smooth-wall");await page.locator("#build-mode").selectOption("curve");
  await page.locator("#overlap-toggle").check();
  for(const p of [[-12,0,0],[0,0,-10],[12,0,0]]) await clickPoint(page,p);
  const original=await page.evaluate(()=>(window as any).timber.editor.paths.anchors);
  await clickPoint(page,original[1]);
  expect(await page.evaluate(()=>(window as any).timber.editor.paths.selectedPoint)).toBe(1);
  await page.locator("#path-remove").click();
  expect(await page.evaluate(()=>(window as any).timber.editor.paths.anchors)).toEqual([original[0],original[2]]);
  await dragPath(page,[-8,0,12],[4,0,12],true);
  expect(await pieces(page)).toHaveLength(4);
  expect(await page.evaluate(()=>(window as any).timber.editor.paths.anchors)).toEqual([original[0],original[2]]);
  await page.locator("#path-cancel").click();expect(await pieces(page)).toHaveLength(4);
});

test("curve preview changes wood and pose without extra mesh batches or mutations",async({page})=>{
  await setup(page,"smooth-wall");await page.locator("#build-mode").selectOption("curve");
  await page.locator("#overlap-toggle").check();await page.locator("#elevation").fill("5");
  for(const p of [[-12,0,0],[0,0,-10],[12,0,0]]) await clickPoint(page,p);
  await page.locator("#rotate").click();await page.locator("#tilt").click();
  await page.locator("#wood-toggle").click();await page.locator('[data-wood="pine"]').click();
  expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.groupGhosts.children.length)).toBe(1);
  expect(await page.evaluate(()=>(window as any).timber.editor.paths.preview.every((p:any)=>p.wood==="pine" && p.rotation.every(Number.isFinite)))).toBe(true);
  await expect(page.locator("#path-build")).toBeEnabled();await page.locator("#path-build").click();
  const run=await pieces(page);expect(run.length).toBeGreaterThan(6);expect(run.every((p:any)=>p.wood==="pine")).toBe(true);
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(0);
});

test("an invalid Ctrl path owns ordinary clicks until it is built or cancelled",async({page})=>{
  await setup(page);const a=await screen(page,[-10,0,-6]),b=await screen(page,[22,0,-6]);
  await page.mouse.move(a[0],a[1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.position[0])).toBe(-10);
  await page.keyboard.down("Control");await page.mouse.down();await page.mouse.move(b[0],b[1],{steps:8});await page.mouse.up();await page.keyboard.up("Control");
  await expect(page.locator("#path-status")).toContainText("active plots");
  await clickPoint(page,[-10,0,10]);expect(await pieces(page)).toHaveLength(0);
  await page.locator("#path-cancel").click();await clickPoint(page,[-10,0,10]);expect(await pieces(page)).toHaveLength(1);
});

test("cancelling retained Ctrl runs restores the original curve even after another run",async({page})=>{
  await setup(page,"smooth-wall");await page.locator("#build-mode").selectOption("curve");await page.locator("#overlap-toggle").check();
  for(const p of [[-12,0,0],[0,0,-10],[12,0,0]]) await clickPoint(page,p);
  const original=await page.evaluate(()=>(window as any).timber.editor.paths.anchors);
  await dragPath(page,[-8,0,12],[25,0,12],true);
  await expect(page.locator("#path-status")).toContainText("active plots");
  await dragPath(page,[-8,0,12],[23,0,12],true);
  await page.locator("#path-cancel").click();
  expect(await page.evaluate(()=>(window as any).timber.editor.paths.anchors)).toEqual(original);
  expect(await pieces(page)).toHaveLength(0);
});

test("Ctrl runs can begin at a held preview in the air",async({page})=>{
  await setup(page);await page.locator("#elevation").fill("2");
  const a=await screen(page,[-10,0,-6]);await page.mouse.move(a[0],a[1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.position[1])).toBe(2.5);
  await page.locator("#hold-position").click();
  await dragPath(page,[-10,2.5,-6],[2,2.5,-6],true);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,2.5,-6]));
});
