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
  await expect(page.locator("#search")).toBeFocused();
  await page.locator("#search").fill("smooth wall");
  await page.locator('[data-item="smooth-wall"]').click();
  await expect(page.locator("#build-panel")).toBeHidden();
  await expect(page.locator("#edit-panel")).toBeVisible();
  await expect(page.locator("#placement-bar")).toBeVisible();
  expect(await canvas.boundingBox()).toEqual(bounds);
  await page.locator("#wood-toggle").click();
  await expect(page.locator("#woods")).toBeVisible();
  await page.locator('[data-wood="cherry"]').click();
  await expect(page.locator("#woods")).toBeHidden();
  await expect(page.locator("#wood-toggle")).toHaveAttribute("aria-label", "Wood finish: Cherry");
  await page.keyboard.press("b");
  await page.keyboard.press("Escape");
  await expect(page.locator("#build-panel")).toBeHidden();
  await expect(page.locator("#edit-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#edit-panel")).toBeHidden();
  await expect(page.locator("#placement-bar")).toBeHidden();
  await page.locator("#menu-tool").click();
  await page.locator("#help").click();
  await expect(page.locator("#modal")).toBeVisible();
  await expect(page.locator("#project-menu")).toBeHidden();
});

test("selected inspector uses a header palette and an always-visible arrow pad", async ({ page }) => {
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
  expect(await page.locator('#nudge-buttons').innerText()).toBe('');
  for (const direction of ['left','right','forward','back','up','down']) await expect(page.locator(`[data-nudge="${direction}"]`)).toBeVisible();
  const position = () => page.evaluate(() => (window as any).timber.editor.world.pieces.get('a').position);
  const original = await position();
  await page.locator('[data-nudge="up"]').click();
  expect(await position()).toEqual([original[0],original[1]+1,original[2]]);
  await page.locator('[data-nudge="down"]').click();
  expect(await position()).toEqual(original);
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
    await expect(page.locator('#nudge-buttons')).toBeInViewport();
    await expect(page.locator('#duplicate-tool')).toBeInViewport();
    await expect(page.locator('#delete-tool')).toBeInViewport();
    const bounds = (await page.locator('#edit-panel').boundingBox())!;
    expect(bounds.height).toBeLessThanOrEqual(280);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  }
  await page.evaluate(async () => {
    const e = (window as any).timber.editor;
    e.world.load([],[12],[{id:'w1',kind:'wire',from:{point:[-2,.18,0]},to:{point:[2,.18,0]},points:[]}]);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    e.pickSelections([],['w1']);
  });
  await page.locator('[data-nudge="up"]').click();
  expect(await page.evaluate(() => (window as any).timber.editor.world.wires[0].from.point)).toEqual([-2,1.18,0]);
  const wirePanel = (await page.locator('#wire-selection-panel').boundingBox())!;
  const pad = (await page.locator('#nudge-buttons').boundingBox())!;
  expect(pad.y + pad.height).toBeLessThanOrEqual(wirePanel.y + wirePanel.height);
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
  await expect(page.locator("#wiring-panel")).toBeVisible();
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
  await expect(page.locator('#wiring-panel')).toBeVisible();
  await expect(page.locator('#wire-length')).toHaveText('0.00 / 20 studs');
  await openWire(page, 'neon');
  await expect(page.locator('#wire-length')).toHaveText('0.00 / 16 studs');
  await expect(page.locator('#wire-colors')).toBeVisible();
  await page.locator('#wire-done').click();
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
