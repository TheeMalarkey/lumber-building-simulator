import { openBuild, openMenu, openWoods } from "./ui-helpers";
import { expect, test } from "@playwright/test";

test("raised plots remain visible over grass across free-camera origin shifts", async ({ page }) => {
  await page.goto("/"); await page.waitForFunction(() => (window as any).timber);
  const failures = await page.evaluate(() => {
    const e = (window as any).timber.editor, v = e.view, t = v.terrain, c = v.camera;
    e.world.load([], [12]); v.renderer.setAnimationLoop(null); v.adaptive = false;
    v.renderer.shadowMap.enabled = false; c.controls.enableDamping = false;
    t.borders.visible = false;
    // Distinct materials make depth loss observable in real rendered pixels.
    for (const [mesh, color] of [[t.plots, "#ff0000"], [t.grass, "#00ff00"]]) {
      mesh.material.color.set(color); mesh.material.map = mesh.material.normalMap = null; mesh.material.needsUpdate = true;
    }
    const gl = v.renderer.getContext(), failures: unknown[] = [];
    for (const grid of [false, true]) for (const height of [1, 30, 65]) for (const distance of [30, 65, 100]) for (let step = 0; step < 24; step++) {
      v.grid.visible = grid;
      const angle = step * Math.PI / 12;
      c.camera.position.set(Math.cos(angle) * distance, height, Math.sin(angle) * distance);
      c.controls.target.set(0, 0, 0); c.controls.update(); v.tick();
      const pixel = new Uint8Array(4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (pixel[1] >= pixel[0]) failures.push({ grid, height, distance, step, pixel: [...pixel] });
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test("land expands by edges, protects bridges and occupied plots, persists and undoes", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/"); await page.waitForFunction(() => (window as any).timber);
  await page.evaluate(() => (window as any).timber.editor.world.load([], [12]));
  await page.locator("#land-tool").click();
  const cell = (id: number) => page.locator(`[data-plot="${id}"]`);
  await expect(page.locator(".plot-cell")).toHaveCount(25);
  await expect(cell(18)).toHaveAttribute("aria-disabled", "true");
  await cell(13).click(); await cell(14).click();
  await expect(cell(13)).toHaveAttribute("aria-disabled", "true");
  await expect(cell(12)).toHaveAttribute("aria-disabled", "true");
  await page.locator("#land-grid").uncheck();
  expect(await page.evaluate(() => (window as any).timber.editor.view.terrain.borders.visible)).toBe(true);
  await page.locator("#land-borders").uncheck();
  await page.locator("#land-grid").check();
  expect(await page.evaluate(() => (window as any).timber.editor.view.terrain.borders.visible)).toBe(false);
  await page.locator("#close-modal").click();
  await page.locator("#undo").click();
  expect(await page.evaluate(() => (window as any).timber.editor.project.plots)).toEqual([12, 13]);
  await page.locator("#redo").click();
  await page.evaluate(() => { const e = (window as any).timber.editor; e.world.execute([{ before: null, after: { id: "occupied", item: "large-floor", wood: "oak", position: [80, .5, 0], rotation: [0, 0, 0] } }]); });
  await page.locator("#land-tool").click();
  await expect(cell(14)).toHaveAttribute("aria-disabled", "true");
  await expect(cell(14)).toHaveAttribute("title", /Move or delete/);
  await page.locator("#close-modal").click();
  await openMenu(page); await page.locator("#save").click(); await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  await page.reload(); await page.waitForFunction(() => (window as any).timber);
  expect(await page.evaluate(() => (window as any).timber.editor.project.plots)).toEqual([12, 13, 14]);
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  const download = page.waitForEvent("download"); await openMenu(page); await page.locator("#export").click();
  const stream = await (await download).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).plots).toEqual([12, 13, 14]);
  expect(errors).toEqual([]);
});

test("placement, moving and rotation require the whole footprint on land; terrain has a raised edge", async ({ page }) => {
  await page.goto("/"); await page.waitForFunction(() => (window as any).timber);
  const result = await page.evaluate(() => {
    const e = (window as any).timber.editor; e.world.load([], [12]);
    e.setMode(true);
    const p = { id: "ghost", item: "large-floor", wood: "oak", position: [18, .5, 0], rotation: [0, 0, 0] };
    e.ghost = p; e.place(); const rejected = e.world.pieces.size === 0;
    e.world.togglePlot(13); e.ghost = p; e.place();
    const placed = [...e.world.pieces.values()][0] as any;
    e.pickSelection(placed.id); e.move(); e.ghost = { ...placed, position: [100, .5, 0] }; e.place();
    const moveRejected = e.world.pieces.get(placed.id).position[0] === 18;
    e.world.load([{ id: "post", item: "post", wood: "oak", position: [19, 2, 0], rotation: [0, 0, 0] }], [12]);
    e.pickSelection("post"); e.rotate(2);
    const rotationRejected = e.world.pieces.get("post").rotation[2] === 0;
    const t = e.view.terrain, matrix = e.view.camera.camera.matrix.clone();
    t.plots.geometry.computeBoundingBox(); t.plots.getMatrixAt(0, matrix);
    const box = t.plots.geometry.boundingBox.clone().applyMatrix4(matrix);
    return { rejected, countAfterPlacement: !!placed, moveRejected, rotationRejected,
      top: box.max.y, grass: t.grass.position.y, thickness: box.max.y - box.min.y,
      texturesReady: [t.grass.material.map, t.plots.material.map].every(m => m.image.complete),
      borderY: t.borders.geometry.getAttribute("position").getY(0) };
  });
  expect(result.rejected && result.countAfterPlacement && result.moveRejected && result.rotationRejected).toBe(true);
  expect(result.top).toBeCloseTo(0); expect(result.grass).toBe(-.1); expect(result.thickness).toBeCloseTo(.1);
  expect(result.borderY).toBeGreaterThan(0); expect(result.texturesReady).toBe(true);
  await page.locator("#pos-0").fill("40"); await page.locator("#pos-0").press("Tab");
  await expect(page.locator("#pos-0")).toHaveValue("19");
  await expect(page.locator("#toast")).toContainText("active plots");
});
