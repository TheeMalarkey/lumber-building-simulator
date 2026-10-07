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
async function dragPath(page:Page,from:number[],to:number[],finish=true) {
  const a=await screen(page,from),b=await screen(page,to);
  await page.mouse.move(a[0],a[1]);
  await page.mouse.down();await page.mouse.move(b[0],b[1],{steps:8});
  if(finish) await page.mouse.up();
}
async function clickPoint(page:Page,point:number[]) {const p=await screen(page,point);await page.mouse.click(p[0],p[1]);}
const pieces=(page:Page)=>page.evaluate(()=>[...(window as any).timber.editor.world.pieces.values()]);

test("plain clicks and small pointer jitter place one piece in one history action",async({page})=>{
  await setup(page);const start=await screen(page,[-10,0,-6]);
  await page.mouse.move(start[0],start[1]);await page.mouse.down();
  await page.mouse.move(start[0]+3,start[1]+1);await page.mouse.up();
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual([[-10,.5,-6]]);
  await page.locator('#undo').click();expect(await pieces(page)).toHaveLength(0);
  await expect(page.locator('#undo')).toBeDisabled();
  await page.locator('#redo').click();expect(await pieces(page)).toHaveLength(1);
  await page.keyboard.press('Escape');expect(await pieces(page)).toHaveLength(1);
});

test("diagonal pointer drags project onto the dominant world axis without diagonal pieces",async({page})=>{
  await setup(page);await dragPath(page,[-10,0,-6],[2,0,-2]);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,.5,-6]));
  await page.locator('#undo').click();
  await page.evaluate(()=>{const e=(window as any).timber.editor;e.choose('small-floor');});
  await dragPath(page,[-6,0,-10],[-2,0,2]);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-6,.5,-10+2*i]));
});

test("drag building repeats pieces across the top of an existing blueprint",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"platform",item:"large-floor",wood:"oak",position:[0,.5,0],rotation:[0,0,0]}],[12]);
  });
  await dragPath(page,[-2,1,-1],[2,1,-1]);
  expect((await pieces(page)).filter((p:any)=>p.id!=="platform").map((p:any)=>p.position)).toEqual([[-2,1.5,-1],[0,1.5,-1],[2,1.5,-1]]);
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(1);
});

test("dragging up a blueprint side builds a vertical run beyond its top",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"wall",item:"smooth-wall",wood:"oak",position:[0,4,0],rotation:[0,0,0]}],[12]);
    const c=e.view.camera;c.camera.position.set(12,10,24);c.controls.target.set(0,4,0);c.controls.update();c.camera.updateMatrixWorld();
  });
  // Use cell interiors so floating-point ray hits do not straddle a snap boundary.
  await dragPath(page,[0,1.2,.5],[0,10.2,.5]);
  const run=(await pieces(page)).filter((p:any)=>p.id!=="wall");
  expect(run.map((p:any)=>p.position)).toEqual(Array.from({length:10},(_,i)=>[0,1.5+i,1.5]));
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(1);
});

test("side drags reject the whole run when it crosses below ground",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"wall",item:"smooth-wall",wood:"oak",position:[0,4,0],rotation:[0,0,0]}],[12]);
    const c=e.view.camera;c.camera.position.set(12,10,24);c.controls.target.set(0,4,0);c.controls.update();c.camera.updateMatrixWorld();
  });
  await dragPath(page,[0,4,.5],[0,-2,.5]);
  expect(await pieces(page)).toHaveLength(1);await expect(page.locator("#path-status")).toContainText("below ground");
  await page.locator("#path-cancel").click();expect(await pieces(page)).toHaveLength(1);
});

test("a stationary plain click places one blueprint flush with a wall side",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"wall",item:"smooth-wall",wood:"oak",position:[0,4,0],rotation:[0,0,0]}],[12]);
    const c=e.view.camera;c.camera.position.set(12,10,24);c.controls.target.set(0,4,0);c.controls.update();c.camera.updateMatrixWorld();
  });
  await clickPoint(page,[0,1.2,.5]);
  expect((await pieces(page)).filter((p:any)=>p.id!=="wall").map((p:any)=>p.position)).toEqual([[0,1.5,1.5]]);
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(1);
  await expect(page.locator("#undo")).toBeDisabled();
});

test("surface drags follow a rotated wall side",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"wall",item:"smooth-wall",wood:"oak",position:[0,4,0],rotation:[0,1,0]}],[12]);
    const c=e.view.camera;c.camera.position.set(12,10,24);c.controls.target.set(0,4,0);c.controls.update();c.camera.updateMatrixWorld();
  });
  await dragPath(page,[.5,1.2,.2],[.5,3.2,.2]);
  expect((await pieces(page)).filter((p:any)=>p.id!=="wall").map((p:any)=>p.position)).toEqual([[1.5,1.5,0],[1.5,2.5,0],[1.5,3.5,0]]);
});

test("a world-axis run across a wedge starts flush and keeps height and depth fixed",async({page})=>{
  await setup(page,"tiny-tile");await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"wedge",item:"1-4-wedge",wood:"oak",position:[0,.5,0],rotation:[0,0,0]}],[12]);
    const c=e.view.camera;c.camera.position.set(12,10,24);c.controls.target.set(0,1,0);c.controls.update();c.camera.updateMatrixWorld();
  });
  await dragPath(page,[.2,.2,1.2],[2.2,.2,1.2]);
  expect((await pieces(page)).filter((p:any)=>p.id!=="wedge").map((p:any)=>p.position)).toEqual([[.5,.35,1.5],[1.5,.35,1.5],[2.5,.35,1.5]]);
});

test("plain drag builds a footprint-spaced straight run and undo removes the whole run",async({page})=>{
  await setup(page);const camera=await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.toArray());
  await dragPath(page,[-10,0,-6],[2,0,-6]);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+i*2,.5,-6]));
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.camera.position.toArray())).toEqual(camera);
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(0);
  await page.locator("#redo").click();expect(await pieces(page)).toHaveLength(7);
});

test("an intersecting plain run commits only after overlap validation succeeds",async({page})=>{
  await setup(page);await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([{id:"obstacle",item:"small-floor",wood:"pine",position:[-6,.5,-6],rotation:[0,0,0]}],[12]);
  });
  await dragPath(page,[-10,0,-6],[-2,0,-6]);expect(await pieces(page)).toHaveLength(1);
  await expect(page.locator("#path-status")).toContainText("intersect");
  await page.locator("#overlap-toggle").check();await page.locator("#path-build").click();
  expect((await pieces(page)).filter((p:any)=>p.id!=="obstacle").map((p:any)=>p.position)).toEqual(Array.from({length:5},(_,i)=>[-10+2*i,.5,-6]));
  await page.locator("#undo").click();expect(await pieces(page)).toHaveLength(1);
});

test("cancelled drags retain the build and release camera controls",async({page})=>{
  await setup(page);await dragPath(page,[-10,0,-6],[2,0,-6],false);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.selecting)).toBe(true);
  await page.keyboard.press("Escape");await page.mouse.up();expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>(window as any).timber.editor.placing)).toBe(true);
  await dragPath(page,[-10,0,-6],[2,0,-6],false);
  await page.evaluate(()=>window.dispatchEvent(new Event("blur")));await page.mouse.up();expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>(window as any).timber.editor.view.camera.selecting)).toBe(false);
  await dragPath(page,[-10,0,-6],[2,0,-6]);
  expect(await pieces(page)).toHaveLength(7);
});

test("a real drag without a valid plane endpoint cancels instead of placing a single piece",async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    const ray=(window as any).timber.editor.paths.ray.ray,original=ray.intersectPlane;
    ray.intersectPlane=()=>null;
    (window as any).restoreTestPlane=()=>{ray.intersectPlane=original;};
  });
  await dragPath(page,[-10,0,-6],[2,0,-6]);
  expect(await pieces(page)).toHaveLength(0);
  expect(await page.evaluate(()=>{
    const e=(window as any).timber.editor;return {selecting:e.view.camera.selecting,enabled:e.view.camera.controls.enabled,draft:e.paths.hasDraft};
  })).toEqual({selecting:false,enabled:true,draft:false});
  await page.evaluate(()=>{(window as any).restoreTestPlane();delete (window as any).restoreTestPlane;});
  await clickPoint(page,[-10,0,-6]);expect(await pieces(page)).toHaveLength(1);
});

test("runs reject out-of-land batches and support distant previews",async({page})=>{
  await setup(page);
  await dragPath(page,[-10,0,-6],[22,0,-6]);expect(await pieces(page)).toHaveLength(0);
  await expect(page.locator("#path-status")).toContainText("active plots");await page.locator("#path-cancel").click();
  await page.evaluate(()=>{
    const e=(window as any).timber.editor;e.world.load([],null);const c=e.view.camera;c.controls.target.set(512,4,0);c.top();c.camera.updateMatrixWorld();
  });
  await dragPath(page,[502,0,-6],[514,0,-6]);expect((await pieces(page)).map((p:any)=>p.position[0])).toEqual([502,504,506,508,510,512,514]);
});

test("an invalid run owns ordinary clicks until built or cancelled",async({page})=>{
  await setup(page);await dragPath(page,[-10,0,-6],[22,0,-6]);
  await expect(page.locator("#path-status")).toContainText("active plots");
  await clickPoint(page,[-10,0,10]);expect(await pieces(page)).toHaveLength(0);
  await page.locator("#path-cancel").click();await clickPoint(page,[-10,0,10]);expect(await pieces(page)).toHaveLength(1);
});

test("plain runs can begin at a held preview raised with the arrow pad",async({page})=>{
  await setup(page);
  const a=await screen(page,[-10,0,-6]);await page.mouse.move(a[0],a[1]);
  await expect(page.locator('#nudge-buttons')).toBeHidden();
  await page.locator("#hold-position").click();
  await page.locator('[data-nudge="up"]').click();await page.locator('[data-nudge="up"]').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.position[1])).toBe(2.5);
  await dragPath(page,[-10,2.5,-6],[2,2.5,-6]);
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

test("build controls hide removed options and show the pad only while holding",async({page})=>{
  await setup(page,"1-4-wedge");
  await expect(page.locator("#build-mode,#path-fill,#elevation,#wedge-mode,#path-remove")).toHaveCount(0);
  await expect(page.locator('#nudge-buttons')).toBeHidden();
  const start=await screen(page,[-10,0,-6]);await page.mouse.move(start[0],start[1]);
  await page.locator('#hold-position').click();
  await expect(page.locator('#nudge-buttons')).toBeVisible();
  await page.setViewportSize({width:1024,height:768});
  await expect(page.locator('#nudge-buttons')).toBeInViewport();
  const box=await page.locator("#edit-panel").boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(768);
  await page.keyboard.press('Escape');await expect(page.locator('#nudge-buttons')).toBeHidden();
});

test("held preview gizmo arrows adjust height before a plain drag builds a run",async({page})=>{
  await setup(page);const start=await screen(page,[-10,0,-6]);await page.mouse.move(start[0],start[1]);
  await expect.poll(()=>page.evaluate(()=>(window as any).timber.editor.ghost?.position[0])).toBe(-10);
  await page.locator("#hold-position").click();
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
  await expect(page.locator("#hold-position")).toBeVisible();await expect(page.locator("#commit-preview")).toBeVisible();
  await dragPath(page,[-10,2.5,-6],[2,2.5,-6]);
  expect((await pieces(page)).map((p:any)=>p.position)).toEqual(Array.from({length:7},(_,i)=>[-10+2*i,2.5,-6]));
});
