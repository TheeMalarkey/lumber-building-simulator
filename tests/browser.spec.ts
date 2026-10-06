import { openBuild, openMenu, openWoods, openCoordinates } from "./ui-helpers";
import { test, expect } from "@playwright/test";
test("rotate then tilt tips blueprints sideways in previews and placed edits", async ({ page }) => {
  await page.goto("/"); await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([{ id: "turn", item: "smooth-wall", wood: "oak", position: [0, 8, 0], rotation: [0, 0, 0] }], [12]);
    e.pickSelection("turn");
  });
  const size = () => page.evaluate(() => {
    const b = (window as any).timber.editor.world.bounds.get("turn");
    return b.max.map((v: number, i: number) => v - b.min[i]);
  });
  await page.locator("#rotate").click(); await page.locator("#tilt").click();
  expect(await size()).toEqual([1, 4, 8]);
  const placedRotation = await page.evaluate(() => (window as any).timber.editor.world.pieces.get("turn").rotation);
  await page.locator("#undo").click(); expect(await size()).toEqual([1, 8, 4]);
  await page.locator("#redo").click(); expect(await size()).toEqual([1, 4, 8]);
  await openMenu(page); await page.locator("#save").click(); await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  await page.reload(); await page.waitForFunction(() => !!(window as any).timber);
  expect(await size()).toEqual([1, 4, 8]);
  await openBuild(page);
  await page.locator('[data-item="smooth-wall"]').click();
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    const b = e.view.renderer.domElement.getBoundingClientRect();
    e.pointer = [b.x + b.width / 2, b.y + b.height / 2];
    e.updateGhost();
  });
  const canvas = page.locator("#viewport>canvas"); await canvas.focus();
  await page.keyboard.press("r"); await page.keyboard.press("t");
  expect(await page.evaluate(() => (window as any).timber.editor.rotation)).toEqual(placedRotation);
  expect(await page.evaluate(() => (window as any).timber.editor.ghost.rotation)).toEqual(placedRotation);
});
test("ground boundary blocks placement, moving, numeric edits, and tilting below the map", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const point = await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([]);
    e.choose("tiny-tile");
    const v = e.view.camera.camera.position
      .clone()
      .set(0.26, 0, 0.26)
      .project(e.view.camera.camera);
    const b = e.view.renderer.domElement.getBoundingClientRect();
    return {
      x: b.x + ((v.x + 1) * b.width) / 2,
      y: b.y + ((1 - v.y) * b.height) / 2,
    };
  });
  await page.locator("#elevation").fill("-1");
  await page.mouse.move(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).timber.editor.view.ghost.material.color.getHex(),
      ),
    )
    .toBe(0xe15d4f);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#piece-count")).toHaveText("0 pieces");
  await expect(page.locator("#toast")).toContainText("ground");
  await page.locator("#elevation").fill("0");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  const original = await page.evaluate(() => {
    const e = (window as any).timber.editor;
    const p = [...e.world.pieces.values()][0];
    e.pickSelection(p.id);
    return p;
  });
  await page.locator("#tilt").click();
  await expect(page.locator("#toast")).toContainText("ground");
  await openCoordinates(page);
  await page.locator("#pos-1").fill("-0.9");
  await openCoordinates(page);
  await page.locator("#pos-1").press("Tab");
  await expect(page.locator("#pos-1")).toHaveValue("0.1");
  await page.locator("#move-tool").click();
  await page.locator("#elevation").fill("-1");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#toast")).toContainText("ground");
  expect(
    await page.evaluate(() => [
      ...(window as any).timber.editor.world.pieces.values(),
    ]),
  ).toEqual([original]);
  await page.keyboard.press("Escape");
});
test("double click picks up a placed blueprint, supports cancellation, placement, and undo", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const screen = await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([
      {
        id: "move-me",
        item: "smooth-wall",
        wood: "walnut",
        position: [0, 4, 0.5],
        rotation: [0, 0, 0],
      },
    ]);
    e.pickSelection(null);
    document.getElementById("welcome-note")!.hidden = true;
    const project = (position: number[]) => {
      const v = e.view.camera.camera.position
        .clone()
        .fromArray(position)
        .project(e.view.camera.camera);
      const b = e.view.renderer.domElement.getBoundingClientRect();
      return {
        x: b.x + ((v.x + 1) * b.width) / 2,
        y: b.y + ((1 - v.y) * b.height) / 2,
      };
    };
    return {
      piece: project([0, 4, 0.5]),
      destination: project([10, 0, 0.5]),
      empty: project([-10, 0, 0.5]),
    };
  });
  const state = () =>
    page.evaluate(() => {
      const e = (window as any).timber.editor;
      return {
        moving: e.moving,
        placing: e.placing,
        pieces: [...e.world.pieces.values()],
      };
    });
  const original = (await state()).pieces;
  await page.mouse.click(screen.piece.x, screen.piece.y);
  expect((await state()).moving).toBeNull();
  await page.mouse.dblclick(screen.piece.x, screen.piece.y);
  expect(await state()).toMatchObject({
    moving: "move-me",
    placing: true,
    pieces: original,
  });
  await page.keyboard.press("Escape");
  expect(await state()).toMatchObject({
    moving: null,
    placing: false,
    pieces: original,
  });
  await page.mouse.dblclick(screen.empty.x, screen.empty.y);
  expect((await state()).moving).toBeNull();
  await page.mouse.dblclick(screen.piece.x, screen.piece.y);
  await page.mouse.dblclick(screen.destination.x, screen.destination.y);
  expect(await state()).toMatchObject({
    moving: null,
    placing: false,
    pieces: [{ id: "move-me", wood: "walnut", position: [10, 4, 0.5] }],
  });
  await page.keyboard.press("Control+z");
  expect((await state()).pieces).toEqual(original);
});
test("floor placement follows visible grid cells across rotation and origin shifts", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  for (const offset of [0, -64]) {
    await page.evaluate((offset) => {
      const e = (window as any).timber.editor;
      e.world.load([], Array.from({ length: 25 }, (_, i) => i));
      e.view.camera.camera.position.set(offset + 10, 22, offset + 14);
      e.view.camera.controls.target.set(offset, 0, offset);
      e.view.camera.controls.update();
      e.view.camera.camera.updateMatrixWorld();
      document.getElementById("welcome-note")!.hidden = true;
    }, offset);
    for (const fixture of [
      {
        item: "tiny-floor",
        rotation: [0, 0, 0],
        x: 0.26,
        z: 0.26,
        expected: [0.5, 0.5, 0.5],
      },
      {
        item: "smooth-wall",
        rotation: [0, 1, 0],
        x: 4.26,
        z: 0.26,
        expected: [4.5, 4, 0],
      },
    ]) {
      const point = await page.evaluate(
        ({ fixture, offset }) => {
          const e = (window as any).timber.editor;
          e.choose(fixture.item);
          e.rotation = fixture.rotation;
          const v = e.view.camera.camera.position
            .clone()
            .set(offset + fixture.x, 0, offset + fixture.z)
            .project(e.view.camera.camera);
          const b = e.view.renderer.domElement.getBoundingClientRect();
          return {
            x: b.x + ((v.x + 1) * b.width) / 2,
            y: b.y + ((1 - v.y) * b.height) / 2,
          };
        },
        { fixture, offset },
      );
      await page.mouse.click(point.x, point.y);
      const position = await page.evaluate(
        () =>
          [...(window as any).timber.editor.world.pieces.values()].at(-1)
            .position,
      );
      expect(position).toEqual([
        offset + fixture.expected[0],
        fixture.expected[1],
        offset + fixture.expected[2],
      ]);
      await page.keyboard.press("Escape");
    }
    await expect
      .poll(() =>
        page.evaluate(() => {
          const view = (window as any).timber.editor.view;
          return {
            step: view.grid.material.uniforms.uStep.value,
            offset: view.grid.material.uniforms.uOffset.value.toArray(),
            origin: view.origin.toArray(),
          };
        }),
      )
      .toEqual({
        step: 1,
        offset: [offset, -offset],
        origin: [offset, 0, offset],
      });
  }
  await page.mouse.move(20, 20);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = (window as any).timber.editor.view;
        return [...view.loaded.values()]
          .flatMap((group: any) => group.children)
          .reduce((count: number, mesh: any) => count + mesh.count, 0);
      }),
    )
    .toBe(2);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: "artifacts/grid-alignment.png" });
});
test("placement, position controls, and elevation move in whole studs", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await expect(page.locator("#snap")).toHaveText("1 stud");
  await expect(page.locator("#elevation")).toHaveAttribute("step", "1");
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([
      {
        id: "tile",
        item: "tiny-tile",
        wood: "oak",
        position: [0, 0.1, 0],
        rotation: [0, 0, 0],
      },
    ]);
    e.pickSelection("tile");
  });
  await openCoordinates(page);
  await page.locator("#pos-1").press("ArrowUp");
  await openCoordinates(page);
  await page.locator("#pos-1").press("Tab");
  await expect(page.locator("#pos-1")).toHaveValue("1.1");
  await openCoordinates(page);
  await page.locator("#pos-1").press("ArrowDown");
  await openCoordinates(page);
  await page.locator("#pos-1").press("Tab");
  await expect(page.locator("#pos-1")).toHaveValue("0.1");
  await openCoordinates(page);
  await page.locator("#pos-0").fill("2.7");
  await openCoordinates(page);
  await page.locator("#pos-0").press("Tab");
  await expect(page.locator("#pos-0")).toHaveValue("3");
  await page.locator("#place-selected").click();
  await page.locator("#elevation").fill("1.7");
  await page.locator("#elevation").press("Tab");
  await expect(page.locator("#elevation")).toHaveValue("2");
  const samples = await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([]);
    e.choose("tiny-tile");
    e.pointer = [0, 0];
    const originalPick = e.view.pick;
    try {
      return [0.26, 0.76, 1.26, 1.76, -0.76].map((x) => {
        e.view.pick = () => ({ point: [x, 0, 0], normal: [0, 1, 0] });
        e.updateGhost();
        return [...e.ghost.position];
      });
    } finally {
      e.view.pick = originalPick;
    }
  });
  expect(samples).toEqual([
    [0.5, 2.1, 0.5],
    [0.5, 2.1, 0.5],
    [1.5, 2.1, 0.5],
    [1.5, 2.1, 0.5],
    [-0.5, 2.1, 0.5],
  ]);
});
test("intersecting placement turns red and is blocked while stacking stays valid", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const point = await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([
      {
        id: "base",
        item: "smooth-wall",
        wood: "oak",
        position: [0, 4, 0],
        rotation: [0, 0, 0],
      },
    ]);
    e.choose("smooth-wall");
    const v = e.view.camera.camera.position
      .clone()
      .set(0, 8, 0)
      .project(e.view.camera.camera);
    const b = e.view.renderer.domElement.getBoundingClientRect();
    return {
      x: b.x + ((v.x + 1) * b.width) / 2,
      y: b.y + ((1 - v.y) * b.height) / 2,
    };
  });
  await page.locator("#elevation").fill("-8");
  await page.mouse.move(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).timber.editor.view.ghost.material.color.getHex(),
      ),
    )
    .toBe(0xe15d4f);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  await expect(page.locator("#toast")).toContainText("overlaps");
  await page.locator("#elevation").fill("0");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#piece-count")).toHaveText("2 pieces");
  await expect(page.locator("#overlap")).toHaveCount(0);
});
test("rotation and numeric movement cannot intersect another piece", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([
      {
        id: "a",
        item: "smooth-wall",
        wood: "oak",
        position: [0, 4, 0],
        rotation: [0, 0, 0],
      },
      {
        id: "b",
        item: "smooth-wall",
        wood: "oak",
        position: [0, 4, 2],
        rotation: [0, 0, 0],
      },
    ]);
    e.pickSelection("a");
  });
  await page.locator("#rotate").click();
  expect(
    await page.evaluate(
      () => (window as any).timber.editor.world.pieces.get("a").rotation,
    ),
  ).toEqual([0, 0, 0]);
  await openCoordinates(page);
  await page.locator("#pos-2").fill("2");
  await openCoordinates(page);
  await page.locator("#pos-2").press("Tab");
  await expect(page.locator("#pos-2")).toHaveValue("0");
  expect(
    await page.evaluate(
      () => (window as any).timber.editor.world.pieces.get("a").position,
    ),
  ).toEqual([0, 4, 0]);
});
test("cancelling a recolored duplicate does not alter its original", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => {
    const e = (window as any).timber.editor;
    e.world.load([
      {
        id: "original",
        item: "smooth-wall",
        wood: "oak",
        position: [0, 4, 0],
        rotation: [0, 0, 0],
      },
    ]);
    e.pickSelection("original");
  });
  await page.locator("#duplicate-tool").click();
  await openWoods(page);
  await page.locator('[data-wood="cherry"]').click();
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => (window as any).timber.editor.world.pieces.get("original").wood,
    ),
  ).toBe("oak");
});
test("upward free-camera pose survives releasing the mouse", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const r = (await page.locator("#viewport>canvas").boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height * 0.7);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(r.x + r.width / 2, r.y + r.height * 0.2, { steps: 8 });
  const before = await page.evaluate(() => {
    const c = (window as any).timber.editor.view.camera.camera;
    return { p: c.position.toArray(), q: c.quaternion.toArray() };
  });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const c = (window as any).timber.editor.view.camera.camera;
    return { p: c.position.toArray(), q: c.quaternion.toArray() };
  });
  for (let i = 0; i < 3; i++) expect(after.p[i]).toBeCloseTo(before.p[i], 6);
  for (let i = 0; i < 4; i++) expect(after.q[i]).toBeCloseTo(before.q[i], 6);
});
test("catalog cards stay readable and every category is reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await openBuild(page);
  await expect(page.locator(".catalog-card")).toHaveCount(102);
  expect(
    (await page.locator(".catalog-card").first().boundingBox())!.height,
  ).toBeGreaterThan(120);
  await page.getByRole("button", { name: "Floors", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(8);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByPlaceholder("Find a building piece…").fill("sink");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
});
test("place rotate recolor move delete undo and export preserve a real build", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await openMenu(page); await page.locator("#new").click();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#piece-count")).toHaveText("0 pieces");
  await openBuild(page);
  await page.locator('[data-item="smooth-wall"]').click();
  const canvas = page.locator("#viewport>canvas");
  const r = (await canvas.boundingBox())!;
  const point = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.58 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#undo").click();
  await expect(page.locator("#piece-count")).toHaveText("0 pieces");
  await expect(page.locator("#redo")).toBeEnabled();
  await page.locator("#redo").click();
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  await page.keyboard.press("Escape");
  await page.mouse.click(point.x, point.y - 20);
  // Select the placed geometry through the renderer's real projected center, not a test-only selection hook.
  const screen = await page.evaluate(() => {
    const e = (window as any).timber.editor,
      p = [...e.world.pieces.values()][0] as any;
    const v = e.view.camera.camera.position
      .clone()
      .fromArray(p.position)
      .project(e.view.camera.camera);
    const b = e.view.renderer.domElement.getBoundingClientRect();
    return {
      x: b.x + ((v.x + 1) * b.width) / 2,
      y: b.y + ((1 - v.y) * b.height) / 2,
    };
  });
  await page.mouse.click(screen.x, screen.y);
  await expect(page.locator("#transform-section")).toBeVisible();
  await openWoods(page);
  await page.locator('[data-wood="walnut"]').click();
  await page.locator("#undo").click();
  await expect(page.locator("#wood-name")).toHaveText("Oak");
  await page.keyboard.press("r");
  await openWoods(page);
  await page.locator('[data-wood="cherry"]').click();
  await openCoordinates(page);
  await page.locator("#pos-0").fill("12");
  await openCoordinates(page);
  await page.locator("#pos-0").press("Tab");
  await canvas.focus();
  await page.keyboard.press("Control+z");
  const before = await page.evaluate(() =>
    JSON.stringify([...(window as any).timber.editor.world.pieces.values()]),
  );
  await page.locator("#delete-tool").click();
  await expect(page.locator("#piece-count")).toHaveText("0 pieces");
  await page.keyboard.press("Control+z");
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  expect(
    await page.evaluate(() =>
      JSON.stringify([...(window as any).timber.editor.world.pieces.values()]),
    ),
  ).toBe(before);
  await openMenu(page); await page.locator("#save").click();
  await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  await page.reload();
  await page.waitForFunction(() => !!(window as any).timber);
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  const download = page.waitForEvent("download");
  await openMenu(page); await page.locator("#export").click();
  expect((await download).suggestedFilename()).toMatch(/\.timber$/);
});
test("invalid import leaves existing project untouched", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const count = await page.locator("#piece-count").textContent();
  await page.locator("#file-input").setInputFiles({
    name: "bad.timber",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99,"name":"bad","pieces":[]}'),
  });
  await expect(page.locator("#toast")).toContainText("Unsupported");
  await expect(page.locator("#piece-count")).toHaveText(count!);
});
test("free camera moves without right click and releases on focus loss", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const start = await page.evaluate(() =>
    (window as any).timber.editor.view.camera.camera.position.toArray(),
  );
  const r = (await page.locator("#viewport>canvas").boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("w");
  const end = await page.evaluate(() =>
    (window as any).timber.editor.view.camera.camera.position.toArray(),
  );
  expect(end).not.toEqual(start);
  await page.waitForTimeout(250);
  const still = await page.evaluate(() =>
    (window as any).timber.editor.view.camera.camera.position.toArray(),
  );
  for (let i = 0; i < 3; i++) expect(still[i]).toBeCloseTo(end[i], 8);
});
test("WASD and elevation work independently of mouse look and stop on key release", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const pose = () =>
    page.evaluate(() => {
      const c = (window as any).timber.editor.view.camera;
      return {
        position: c.camera.position.toArray(),
        target: c.controls.target.toArray(),
        rotation: c.camera.quaternion.toArray(),
      };
    });
  for (const key of ["w", "a", "s", "d", "q", "e"]) {
    const before = await pose();
    await page.keyboard.down(key);
    await page.waitForTimeout(120);
    await page.keyboard.up(key);
    const after = await pose();
    expect(after.position).not.toEqual(before.position);
    for (let i = 0; i < 3; i++)
      expect(after.position[i] - before.position[i]).toBeCloseTo(
        after.target[i] - before.target[i],
        6,
      );
    for (let i = 0; i < 4; i++)
      expect(after.rotation[i]).toBeCloseTo(before.rotation[i], 6);
    await page.waitForTimeout(120);
    const stopped = await pose();
    for (let i = 0; i < 3; i++)
      expect(stopped.position[i]).toBeCloseTo(after.position[i], 8);
  }
  const r = (await page.locator("#viewport>canvas").boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.keyboard.down("w");
  await page.mouse.down({ button: "right" });
  await page.mouse.move(r.x + r.width / 2 + 50, r.y + r.height / 2);
  await page.mouse.up({ button: "right" });
  const releasedLook = await pose();
  await page.waitForTimeout(150);
  expect((await pose()).position).not.toEqual(releasedLook.position);
  await page.keyboard.up("w");
});
test("typing, editor shortcuts, and dialogs do not move the camera", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const position = () =>
    page.evaluate(() =>
      (window as any).timber.editor.view.camera.camera.position.toArray(),
    );
  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await openBuild(page);
  await page.locator("#search").focus();
  await page.waitForTimeout(60);
  const typing = await position();
  await page.keyboard.type("wasdqe");
  await page.waitForTimeout(120);
  expect(await position()).toEqual(typing);
  await page.keyboard.up("w");
  await page
    .locator("#search")
    .evaluate((input: HTMLInputElement) => input.blur());
  await page.keyboard.down("Control");
  await page.keyboard.down("s");
  await page.waitForTimeout(150);
  await page.keyboard.up("s");
  await page.keyboard.up("Control");
  expect(await position()).toEqual(typing);
  await openMenu(page); await page.locator("#help").click();
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  await page.keyboard.up("d");
  expect(await position()).toEqual(typing);
});
