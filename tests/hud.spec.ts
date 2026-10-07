import { test, expect } from "@playwright/test";
import { openWire } from "./ui-helpers";
test("compact HUD keeps the world full screen and reveals only relevant controls", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const canvas = page.locator("#viewport>canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).toEqual({ x: 0, y: 0, width: 1440, height: 960 });
  for (const id of ["build-panel", "edit-panel", "project-menu", "woods"])
    await expect(page.locator("#" + id)).toBeHidden();
  await page.keyboard.press("b");
  await expect(canvas).toBeFocused();
  await page.locator("#search").click();
  await page.locator("#search").fill("smooth wall");
  await page.locator('[data-item="smooth-wall"]').click();
  await expect(page.locator("#build-panel")).toBeVisible();
  await expect(page.locator("#edit-panel")).toBeVisible();
  await expect(page.locator("#placement-bar")).toBeHidden();
  await expect(canvas).toBeFocused();
  await page.keyboard.press("r");
  expect(await page.evaluate(() => (window as any).timber.editor.rotation)).toEqual([0, 1, 0]);
  await page.keyboard.press("t");
  expect(await page.evaluate(() => (window as any).timber.editor.rotation)).not.toEqual([0, 1, 0]);
  await expect(page.locator("#build-panel")).toBeVisible();
  expect(await canvas.boundingBox()).toEqual(bounds);
  await page.locator("#wood-toggle").click();
  await expect(page.locator("#woods")).toBeVisible();
  await page.locator('[data-wood="cherry"]').click();
  await expect(page.locator("#woods")).toBeHidden();
  await expect(page.locator("#wood-toggle")).toHaveAttribute("aria-label", "Wood finish: Cherry");
  await expect(page.locator("#build-panel")).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.locator("#build-panel")).toBeHidden();
  await expect(page.locator("#edit-panel")).toBeVisible();
  expect(await page.evaluate(() => (window as any).timber.editor.placing)).toBe(true);
  await page.locator("#build-tool").click();
  await expect(page.locator("#build-panel")).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.locator("#build-panel")).toBeHidden();
  await page.locator("#build-tool").click();
  await page.locator("#collapse").click();
  await expect(page.locator("#build-panel")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#edit-panel")).toBeHidden();
  await expect(page.locator("#placement-bar")).toBeHidden();
  await page.locator("#menu-tool").click();
  await page.locator("#help").click();
  await expect(page.locator("#modal")).toBeVisible();
  await expect(page.locator("#project-menu")).toBeHidden();
});

test("opening Build keeps movement active until the search bar is clicked", async ({page}) => {
  await page.goto('/');await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e=(window as any).timber.editor;e.world.load([],[12]);e.pickSelection(null);
    e.view.camera.controls.enableDamping=false;e.view.camera.home();
  });
  const canvas=page.locator('#viewport>canvas'),search=page.locator('#search');
  const position=() => page.evaluate(() => {
    const c=(window as any).timber.editor.view.camera;
    return (c.walking ? c.walker.position : c.camera.position).toArray();
  });
  for(const walking of [false,true]) {
    await page.evaluate(walking => (window as any).timber.editor.view.camera.setWalking(walking),walking);
    await page.locator('#build-tool').click();
    await expect(canvas).toBeFocused();await expect(search).not.toBeFocused();
    const before=await position();
    await page.keyboard.down('w');
    await expect.poll(async () => {
      const after=await position();return Math.hypot(...after.map((n:number,i:number)=>n-before[i]));
    }).toBeGreaterThan(.5);
    await page.keyboard.up('w');await expect(search).toHaveValue('');
    await search.click();await page.waitForTimeout(80);
    const stationary=await position();await page.keyboard.type('wasd');await page.waitForTimeout(120);
    await expect(search).toHaveValue('wasd');expect(await position()).toEqual(stationary);
    await search.fill('');await page.keyboard.press('Escape');
    for(const key of ['b','/']) {
      await page.keyboard.press(key);await expect(canvas).toBeFocused();
      await page.keyboard.press('w');await expect(search).toHaveValue('');
      await page.keyboard.press('Escape');
    }
  }
});

test("catalog stays open while choosing and placing blueprints and wires", async ({ page }) => {
  await page.goto('/');await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e=(window as any).timber.editor;e.world.load([],[12]);e.pickSelection(null);
    e.view.camera.controls.enableDamping=false;e.view.camera.home();
  });
  const catalog=page.locator('#build-panel'),canvas=page.locator('#viewport>canvas');
  await page.locator('#build-tool').click();
  await page.locator('[data-item="small-floor"]').click();
  await expect(catalog).toBeVisible();await expect(canvas).toBeFocused();
  await expect(page.locator('#edit-panel')).toBeVisible();
  const point=await page.evaluate(() => {
    const c=(window as any).timber.editor.view.camera.camera;
    const v=c.position.clone().fromArray([4,.1,0]).project(c);
    return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
  });
  await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
  await expect(page.locator('#piece-count')).toHaveText('1 pieces');
  await expect(catalog).toBeVisible();
  await page.locator('[data-item="smooth-wall"]').click();
  await expect(catalog).toBeVisible();
  expect(await page.evaluate(() => (window as any).timber.editor.item)).toBe('smooth-wall');
  await page.locator('#build-tool').click();await expect(catalog).toBeHidden();
  expect(await page.evaluate(() => (window as any).timber.editor.placing)).toBe(true);
  await page.keyboard.press('b');await expect(catalog).toBeVisible();
  await page.locator('#collapse').click();await expect(catalog).toBeHidden();
  await openWire(page);await expect(catalog).toBeVisible();
  await page.locator('[data-wire-item="neon"]').click();await expect(catalog).toBeVisible();
  await expect(page.locator('#wire-palette-panel')).toBeVisible();
  await expect(page.locator('#wire-length-label')).toBeHidden();
  expect(await page.evaluate(() => (window as any).timber.editor.logicTools.selectedKind)).toBe('neon');
  await page.locator('#build-tool').click();await expect(catalog).toBeHidden();
  expect(await page.evaluate(() => (window as any).timber.editor.logicTools.wiring)).toBe(true);
  await page.locator('#build-tool').click();await expect(catalog).toBeVisible();
  await page.locator('#select-tool').click();await expect(catalog).toBeVisible();
  await page.locator('#menu-tool').click();await expect(catalog).toBeVisible();
});

test("catalog drag and resize preserve layout and never build or move the camera", async ({ page }) => {
  await page.goto('/');await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e=(window as any).timber.editor;e.view.camera.controls.enableDamping=false;e.view.camera.home();
  });
  await page.locator('#build-tool').click();
  const catalog=page.locator('#build-panel');
  const before=(await catalog.boundingBox())!;
  const state=await page.evaluate(() => {
    const e=(window as any).timber.editor;
    return {position:e.view.camera.camera.position.toArray(),pieces:e.world.pieces.size};
  });
  const grip=await page.getByRole('button',{name:'Move build catalog',exact:true}).boundingBox();
  expect(grip).not.toBeNull();
  await page.mouse.move(grip!.x+grip!.width/2,grip!.y+grip!.height/2);
  await page.mouse.down();await page.mouse.move(grip!.x+grip!.width/2+140,grip!.y+grip!.height/2-110,{steps:5});await page.mouse.up();
  const moved=(await catalog.boundingBox())!;
  expect(moved.x).toBeCloseTo(before.x+140,0);expect(moved.y).toBeCloseTo(before.y-110,0);
  const resize=await page.getByRole('button',{name:'Resize build catalog',exact:true}).boundingBox();
  await page.mouse.move(resize!.x+resize!.width/2,resize!.y+resize!.height/2);
  await page.mouse.down();await page.mouse.move(resize!.x+resize!.width/2+160,resize!.y+resize!.height/2-120,{steps:5});await page.mouse.up();
  const resized=(await catalog.boundingBox())!;
  expect(resized.width).toBeCloseTo(moved.width+160,0);expect(resized.height).toBeCloseTo(moved.height-120,0);
  const cancelGrip=(await page.locator('#catalog-move').boundingBox())!;
  await page.mouse.move(cancelGrip.x+cancelGrip.width/2,cancelGrip.y+cancelGrip.height/2);
  await page.mouse.down();await page.mouse.move(cancelGrip.x+cancelGrip.width/2+35,cancelGrip.y+cancelGrip.height/2+30,{steps:3});
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(catalog).toBeVisible();expect(await catalog.boundingBox()).toEqual(resized);
  const after=await page.evaluate(() => {
    const e=(window as any).timber.editor;
    return {position:e.view.camera.camera.position.toArray(),pieces:e.world.pieces.size};
  });
  expect(after).toEqual(state);
  await page.locator('#collapse').click();await page.locator('#build-tool').click();
  expect(await catalog.boundingBox()).toEqual(resized);
  await page.reload();await page.waitForFunction(() => !!(window as any).timber);await page.locator('#build-tool').click();
  expect(await catalog.boundingBox()).toEqual(resized);
  await page.locator('#catalog-resize').focus();await page.keyboard.press('ArrowRight');
  const keyboardSize=(await catalog.boundingBox())!;expect(keyboardSize.width).toBeCloseTo(resized.width+8,0);
  await page.setViewportSize({width:390,height:844});
  const compact=(await catalog.boundingBox())!;
  expect(compact.x).toBeGreaterThanOrEqual(8);expect(compact.x+compact.width).toBeLessThanOrEqual(382);
  expect(compact.y).toBeGreaterThanOrEqual(8);expect(compact.y+compact.height).toBeLessThanOrEqual(836);
  await page.locator('.catalog-card').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.catalog-card').last()).toBeInViewport();
  await page.setViewportSize({width:1440,height:960});expect(await catalog.boundingBox()).toEqual(keyboardSize);
});

test("catalog resize handle stays usable beside blueprint and wire controls on phones", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.waitForFunction(() => !!(window as any).timber);
  for(const wiring of [false,true]) {
    await page.evaluate(() => localStorage.removeItem('timber-catalog-layout'));
    await page.reload();await page.waitForFunction(() => !!(window as any).timber);
    await page.locator('#build-tool').click();
    if(wiring) {
      await page.locator('[data-category="Wires"]').click();
      await page.locator('[data-wire-item="wire"]').click();
    } else await page.locator('[data-item="small-floor"]').click();
    const before=(await page.locator('#build-panel').boundingBox())!;
    const handle=(await page.locator('#catalog-resize').boundingBox())!;
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
    await page.mouse.move(handle.x+handle.width/2-40,handle.y+handle.height/2-80,{steps:3});await page.mouse.up();
    const after=(await page.locator('#build-panel').boundingBox())!;
    expect(after.width).toBeCloseTo(before.width-40,0);expect(after.height).toBeCloseTo(before.height-80,0);
    expect(await page.evaluate(() => (window as any).timber.editor.logicTools.wiring)).toBe(wiring);
  }
});

test("selected inspector keeps the header palette and reveals the arrow pad only for held previews", async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([{id:'a',item:'stairs',wood:'oak',position:[-4,5.1,0],rotation:[0,0,0]},
      {id:'b',item:'stairs',wood:'pine',position:[4,5.1,0],rotation:[0,0,0]}],[12]);
    e.pickSelections(['a']);
    e.view.camera.home();
  });
  await expect(page.locator('#rotate,#tilt,#coordinates-details,#place-selected,#step-buttons-details,#axis-hint,#nudge-label')).toHaveCount(0);
  await expect(page.locator('.piece-summary #wood-toggle')).toBeVisible();
  await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', 'Wood finish: Oak');
  await expect(page.locator('#nudge-buttons')).toBeHidden();
  await page.keyboard.press('r');
  await page.keyboard.press('t');
  expect(await page.evaluate(() => (window as any).timber.editor.world.pieces.get('a').rotation)).not.toEqual([0,0,0]);
  await page.evaluate(() => (window as any).timber.editor.pickSelections(['a','b']));
  await expect(page.locator('#wood-toggle')).toHaveAttribute('aria-label', 'Wood finish: Mixed woods');
  await page.locator('#wood-toggle').click();
  await page.locator('[data-wood="oak"]').focus();
  await expect(page.getByRole('tooltip')).toHaveText('Oak');
  await page.locator('[data-wood="cherry"]').hover();
  await expect(page.getByRole('tooltip')).toHaveText('Cherry');
  await page.locator('[data-wood="cherry"]').click();
  await expect(page.getByRole('tooltip')).toBeHidden();
  expect(await page.evaluate(() => [...(window as any).timber.editor.world.pieces.values()].map((p:any) => p.wood))).toEqual(['cherry','cherry']);
  for (const [width,height] of [[1440,960],[390,844],[844,390]]) {
    await page.setViewportSize({width,height});
    await expect(page.locator('#nudge-buttons')).toBeHidden();
    await expect(page.locator('#duplicate-tool')).toBeInViewport();
    await expect(page.locator('#delete-tool')).toBeInViewport();
    const bounds = (await page.locator('#edit-panel').boundingBox())!;
    expect(bounds.height).toBeLessThanOrEqual(280);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  }
  const originalPieces = await page.evaluate(() => [...(window as any).timber.editor.world.pieces.values()]);
  await page.locator('#move-tool').click();
  await expect(page.locator('#nudge-buttons')).toBeHidden();
  await page.locator('#hold-position').click();
  expect(await page.locator('#nudge-buttons').innerText()).toBe('');
  for (const direction of ['left','right','forward','back','up','down']) await expect(page.locator(`[data-nudge="${direction}"]`)).toBeVisible();
  const preview = () => page.evaluate(() => (window as any).timber.editor.groupPreview.map((p:any) => p.position));
  const frozen = await preview();
  await page.locator('[data-nudge="up"]').click();
  expect(await preview()).toEqual(frozen.map((p:number[]) => [p[0],p[1]+1,p[2]]));
  await page.locator('[data-nudge="down"]').click();
  expect(await preview()).toEqual(frozen);
  expect(await page.evaluate(() => [...(window as any).timber.editor.world.pieces.values()])).toEqual(originalPieces);
  await expect(page.locator('#nudge-buttons')).toBeInViewport();
  await page.keyboard.press('Escape');await expect(page.locator('#nudge-buttons')).toBeHidden();
  await page.evaluate(async () => {
    const e = (window as any).timber.editor;
    e.world.load([],[12],[{id:'w1',kind:'wire',from:{point:[-2,.18,0]},to:{point:[2,.18,0]},points:[]}]);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    e.pickSelections([],['w1']);
  });
  await expect(page.locator('#nudge-buttons')).toBeHidden();
  await page.keyboard.press('Control+d');
  await expect(page.locator('#nudge-buttons')).toBeHidden();
  await page.keyboard.press('l');await expect(page.locator('#nudge-buttons')).toBeVisible();
  const before = await page.evaluate(() => (window as any).timber.editor.groupWirePreview[0].from.point);
  await page.locator('[data-nudge="up"]').click();
  expect(await page.evaluate(() => (window as any).timber.editor.groupWirePreview[0].from.point)).toEqual([before[0],before[1]+1,before[2]]);
  expect(await page.evaluate(() => (window as any).timber.editor.world.wires[0].from.point)).toEqual([-2,.18,0]);
  await page.keyboard.press('Escape');await expect(page.locator('#nudge-buttons')).toBeHidden();
});
test("HUD and scrollable catalog fit compact screens", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  for (const [width, height] of [[1024,768],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.locator("#build-tool").click();
    for (const selector of [".build-toolbar","#build-panel",".view-controls"]) {
      const b = (await page.locator(selector).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x+b.width).toBeLessThanOrEqual(width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y+b.height).toBeLessThanOrEqual(height);
    }
    await page.locator(".catalog-card").last().scrollIntoViewIfNeeded();
    await expect(page.locator(".catalog-card").last()).toBeInViewport();
    await page.keyboard.press("Escape");
  }
});

test("Settings and Land are bounded popups with an accessible world and Escape dismissal", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  for (const [width, height] of [[1440, 960], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const canvas = page.locator("#viewport>canvas");
    await expect.poll(() => canvas.boundingBox()).toEqual({ x: 0, y: 0, width, height });
    const worldBounds = await canvas.boundingBox();
    for (const name of ["settings", "land"] as const) {
      if (name === "settings") {
        await page.locator("#menu-tool").click();
        await page.locator("#settings").click();
      } else await page.locator("#land-tool").click();
      const popup = page.locator("#modal");
      await expect(popup).toBeVisible();
      expect(await popup.evaluate(el => el.matches(":modal"))).toBe(false);
      const bounds = (await popup.boundingBox())!;
      expect(bounds.width).toBeLessThanOrEqual(360);
      expect(bounds.height).toBeLessThanOrEqual(height - 140);
      expect(bounds.x).toBeGreaterThanOrEqual(8);
      expect(bounds.y).toBeGreaterThanOrEqual(56);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 8);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 76);
      expect(await canvas.boundingBox()).toEqual(worldBounds);
      // Native modal dialogs make every world control inert. Popups must not.
      await page.locator("#home").click();
      await expect(popup).toBeVisible();
      await page.locator("#close-modal").scrollIntoViewIfNeeded();
      await expect(page.locator("#close-modal")).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(popup).toBeHidden();
      await expect(page.locator(name === "settings" ? "#menu-tool" : "#land-tool")).toBeFocused();
    }
  }
});

test("popup switching and close controls keep destructive confirmations modal", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await page.locator("#land-tool").click();
  await page.locator("#menu-tool").click();
  await expect(page.locator("#modal")).toBeHidden();
  await page.locator("#settings").click();
  await page.locator("#popup-close").click();
  await expect(page.locator("#modal")).toBeHidden();
  await page.locator("#land-tool").click();
  await page.locator("#land-tool").click();
  await expect(page.locator("#modal")).toBeHidden();
  await page.locator("#land-tool").click();
  await openWire(page);
  await expect(page.locator("#modal")).toBeHidden();
  expect(await page.evaluate(() => (window as any).timber.editor.logicTools.wiring)).toBe(true);
  await page.locator("#select-tool").click();
  await page.locator("#menu-tool").click();
  await page.locator("#settings").click();
  await page.locator("#walk-tool").click();
  await expect(page.locator("#modal")).toBeHidden();
  expect(await page.evaluate(() => (window as any).timber.editor.view.camera.keyboardBlocked())).toBe(false);
  await page.locator("#walk-tool").click();
  await page.locator("#menu-tool").click();
  await page.locator("#settings").click();
  await page.locator("#load-demo").scrollIntoViewIfNeeded();
  await page.locator("#load-demo").click();
  await expect(page.locator("#confirm-action")).toBeVisible();
  expect(await page.locator("#modal").evaluate(el => el.matches(":modal"))).toBe(true);
  await page.locator("#cancel-action").click();
  await expect(page.locator("#modal")).toBeHidden();
});

test("compact toolbars keep wire building and land controls accessible", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  expect(await page.locator('.build-toolbar>button').evaluateAll(buttons => buttons.map(b => b.id))).toEqual(['build-tool','select-tool','move-tool']);
  expect(await page.locator('.view-controls>button').evaluateAll(buttons => buttons.map(b => b.id))).toEqual(['home','walk-tool','land-tool','undo','redo']);
  await openWire(page);
  expect(await page.evaluate(() => (window as any).timber.editor.logicTools.selectedKind)).toBe('wire');
  await expect(page.locator('#wire-palette-panel')).toBeHidden();
  await expect(page.locator('#wire-length-label')).toBeHidden();
  await openWire(page, 'neon');
  expect(await page.evaluate(() => (window as any).timber.editor.logicTools.selectedKind)).toBe('neon');
  await expect(page.locator('#wire-length-label')).toBeHidden();
  await expect(page.locator('#wire-colors')).toBeHidden();
  await page.locator('#wire-color-toggle').click();
  await expect(page.locator('#wire-colors')).toBeVisible();
  await page.locator('#select-tool').click();
  await expect(page.locator('#wire-palette-panel')).toBeHidden();
  for (const [width,height] of [[1440,960],[390,844],[320,640]]) {
    await page.setViewportSize({width,height});
    const top = (await page.locator('.view-controls').boundingBox())!;
    const menu = (await page.locator('.hud-corner').boundingBox())!;
    expect(top.x).toBeGreaterThanOrEqual(menu.x + menu.width);
    expect(top.x + top.width).toBeLessThanOrEqual(width - 8);
    await page.locator('#land-tool').click();
    await expect(page.locator('#land-grid')).toBeVisible();
    await page.locator('#land-grid').uncheck();
    expect(await page.evaluate(() => (window as any).timber.editor.view.grid.visible)).toBe(false);
    await page.locator('#land-grid').check();
    const popup = (await page.locator('#modal').boundingBox())!;
    expect(popup.y).toBeGreaterThan(top.y + top.height);
    expect(popup.x + popup.width).toBeCloseTo(top.x + top.width, 0);
    await page.keyboard.press('Escape');
  }
});
