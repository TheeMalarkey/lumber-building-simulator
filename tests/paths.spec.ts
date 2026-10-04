import { test, expect, type Page } from "@playwright/test";

async function setup(page:Page,item="small-floor") {
  await page.goto("/"); await page.waitForFunction(()=>!!(window as any).timber);
  await page.evaluate(item=>{
    const e=(window as any).timber.editor;
    e.pickSelection(null);e.world.load([],[12]);
    const c=e.view.camera;c.controls.enableDamping=false;c.controls.target.set(0,4,0);c.top();c.camera.updateMatrixWorld();
    e.choose(item);
  },item);
}
async function screen(page:Page,point:number[]) {
  return page.evaluate(point=>{
    const v=(window as any).timber.editor.view, r=v.renderer.domElement.getBoundingClientRect();
    v.camera.camera.updateMatrixWorld();
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

test("runs reject out-of-land batches and support distant previews",async({page})=>{
  await setup(page);await page.locator("#build-mode").selectOption("line");
  await dragPath(page,[-10,0,-6],[22,0,-6]);expect(await pieces(page)).toHaveLength(0);
  await expect(page.locator("#path-status")).toContainText("active plots");await page.locator("#path-cancel").click();
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([],null);const c=e.view.camera;c.controls.target.set(512,4,0);c.top();c.camera.updateMatrixWorld();
  });
  await dragPath(page,[502,0,-6],[514,0,-6]);expect((await pieces(page)).map((p:any)=>p.position[0])).toEqual([502,504,506,508,510,512,514]);
});

test("an invalid Ctrl run owns ordinary clicks until built or cancelled",async({page})=>{
  await setup(page);await dragPath(page,[-10,0,-6],[22,0,-6],true);
  await expect(page.locator("#path-status")).toContainText("active plots");
  await clickPoint(page,[-10,0,10]);expect(await pieces(page)).toHaveLength(0);
  await page.locator("#path-cancel").click();await clickPoint(page,[-10,0,10]);expect(await pieces(page)).toHaveLength(1);
});

test("Ctrl runs can begin at a held preview in the air",async({page})=>{
  await setup(page);await page.locator("#elevation").fill("2");
  const a=await screen(page,[-10,0,-6]);await page.mouse.move(a[0],a[1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.position[1])).toBe(2.5);
  await page.locator("#hold-position").click();
  await dragPath(page,[-10,2.5,-6],[2,2.5,-6],true);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,2.5,-6]));
  expect(await page.evaluate(()=>(window as any).timber.editor.view.ghost.visible)).toBe(true);
  expect(await page.evaluate(()=>(window as any).timber.editor.held)).toBe(true);
});

test("removing curve tools still loads the current saved project from the published update",async({page})=>{
  await setup(page);
  const saved={id:"published-pose",item:"small-floor",wood:"pine",position:[-4,.5,0],rotation:[0,.5,0]};
  await page.evaluate(async piece=>{const e=(window as any).timber.editor;e.world.load([piece],[12]);await e.save();},saved);
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
  expect(await pieces(page)).toEqual([saved]);
  await page.evaluate(async()=>{await (window as any).timber.editor.save();});
  await page.reload();await page.waitForFunction(()=>!!(window as any).timber);
  expect(await pieces(page)).toEqual([saved]);
});

test("build controls offer only single pieces and straight drag without curve controls",async({page})=>{
  await setup(page,"1-4-wedge");
  await expect(page.locator("#build-mode option")).toHaveText(["Single piece","Straight drag"]);
  await expect(page.locator("#wedge-mode, #path-remove")).toHaveCount(0);
  await expect(page.locator("#path-fill")).toBeVisible();
  await page.setViewportSize({width:1024,height:768});
  await expect(page.locator("#build-mode")).toBeVisible();
  await expect(page.locator("#elevation")).toBeVisible();
  const box=await page.locator("#edit-panel").boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(768);
});

test("straight mode lets held preview arrows adjust height before building a run",async({page})=>{
  await setup(page);const start=await screen(page,[-10,0,-6]);await page.mouse.move(start[0],start[1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.position[0])).toBe(-10);
  await page.locator("#hold-position").click();await page.locator("#build-mode").selectOption("line");
  await page.evaluate(()=>{
    const c=(window as any).timber.editor.view.camera;c.camera.position.set(12,16,24);c.controls.target.set(-10,.5,-6);c.controls.update();
  });
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const points=await page.evaluate(()=>{
    const v=(window as any).timber.editor.view,g=v.gizmo,r=v.renderer.domElement.getBoundingClientRect();
    const a=g.root.position.clone();a.y+=g.root.scale.x*.7;const b=a.clone();b.y+=2;
    const project=(p:any)=>{p.project(v.camera.camera);return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2];};
    return [project(a),project(b)];
  });
  await page.mouse.move(points[0][0],points[0][1]);await page.mouse.down();
  await page.mouse.move(points[1][0],points[1][1],{steps:8});await page.mouse.up();
  expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>(window as any).timber.editor.ghost?.position)).toEqual([-10,2.5,-6]);
  await expect(page.locator("#hold-position")).toBeVisible();await expect(page.locator("#commit-preview")).toBeHidden();
  await dragPath(page,[-10,2.5,-6],[2,2.5,-6],true);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,2.5,-6]));
});
