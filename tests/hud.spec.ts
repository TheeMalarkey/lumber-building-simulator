import { test, expect } from "@playwright/test";
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
  await expect(page.locator("#wood-name")).toHaveText("Cherry");
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
