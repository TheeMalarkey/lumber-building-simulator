import { openBuild, openMenu, openWoods } from "./ui-helpers";
import { test, expect } from "@playwright/test";

test("walk camera toggles a grounded avatar with WASD, jumping, look, zoom, and free-camera return", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => (window as any).timber.editor.world.load([]));
  await page.locator("#walk-tool").click();
  await expect(page.locator("#walk-tool")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#camera-hint")).toContainText("Jump");
  const state = () =>
    page.evaluate(() => {
      const c = (window as any).timber.editor.view.camera;
      return {
        walking: c.walking,
        feet: c.walker.position.toArray(),
        grounded: c.walker.grounded,
        avatar: c.walker.avatar.visible,
        rotation: c.camera.quaternion.toArray(),
      };
    });
  await expect.poll(async () => (await state()).grounded).toBe(true);
  const start = await state();
  expect(start.avatar).toBe(true);
  expect(start.feet[1]).toBeCloseTo(-.1, 5);
  await page.keyboard.down("w");
  await page.waitForTimeout(300);
  await page.keyboard.up("w");
  const moved = await state();
  expect(
    Math.hypot(moved.feet[0] - start.feet[0], moved.feet[2] - start.feet[2]),
  ).toBeGreaterThan(1);
  expect(moved.feet[1]).toBeCloseTo(-.1, 5);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state()).feet[1]).toBeGreaterThan(0.3);
  await expect.poll(async () => (await state()).grounded).toBe(true);
  expect((await state()).feet[1]).toBeCloseTo(-.1, 5);
  const canvas = (await page.locator("#viewport>canvas").boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2,
  );
  const beforeLook = (await state()).rotation;
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    canvas.x + canvas.width / 2 + 90,
    canvas.y + canvas.height / 2,
    { steps: 5 },
  );
  await page.mouse.up({ button: "right" });
  expect((await state()).rotation).not.toEqual(beforeLook);
  await page.mouse.wheel(0, -3000);
  await expect.poll(async () => (await state()).avatar).toBe(false);
  expect((await state()).walking).toBe(true);
  await page.mouse.wheel(0, 1800);
  await expect.poll(async () => (await state()).avatar).toBe(true);
  await page.keyboard.press("c");
  await expect(page.locator("#walk-tool")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect((await state()).avatar).toBe(false);
  expect(errors).toEqual([]);
});

test("walk inputs pause in fields and on focus loss, and home restores free camera", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  await page.evaluate(() => (window as any).timber.editor.world.load([]));
  await page.keyboard.press("c");
  await expect(page.locator("#walk-tool")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const feet = () =>
    page.evaluate(() =>
      (window as any).timber.editor.view.camera.walker.position.toArray(),
    );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).timber.editor.view.camera.walker.grounded,
      ),
    )
    .toBe(true);
  await openBuild(page);
  await page.locator("#search").focus();
  const before = await feet();
  await page.keyboard.type("wasd c");
  await page.waitForTimeout(150);
  expect(await feet()).toEqual(before);
  await expect(page.locator("#walk-tool")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#viewport>canvas").focus();
  await page.keyboard.down("w");
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("w");
  const blurred = await feet();
  await page.waitForTimeout(150);
  expect(await feet()).toEqual(blurred);
  await page.locator("#home").click();
  await expect(page.locator("#walk-tool")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("#camera-hint")).toContainText("Fly");
});
