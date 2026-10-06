import { chromium, expect } from "@playwright/test";

// An isolated browser context leaves the user's saved project untouched.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.goto("http://127.0.0.1:5178/");
await page.waitForFunction(() => !!window.timber);
await page.evaluate(() => {
  const e = window.timber.editor;
  e.pickSelections([...e.world.pieces.values()].filter(p => p.item === "short-fence").map(p => p.id));
});
await expect(page.locator("#piece-name")).toHaveText("8 blueprints selected");
await page.waitForTimeout(5000); // Let startup frames leave the FPS window.
await page.screenshot({ path: "artifacts/group-selection.png" });
await page.evaluate(() => window.timber.editor.view.camera.top());
await page.keyboard.down("Control");
await page.mouse.move(485, 620);
await page.mouse.down();
await page.mouse.move(950, 745, { steps: 5 });
await expect(page.locator("#selection-marquee")).toBeVisible();
await page.screenshot({ path: "artifacts/group-selection-drag.png" });
await page.keyboard.press("Escape");
await page.mouse.up();
await page.keyboard.up("Control");
await expect(page.locator("#selection-marquee")).toBeHidden();
await page.setViewportSize({ width: 1024, height: 768 });
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
expect(errors).toEqual([]);
await browser.close();
console.log("Group selection outlines, rectangle, compact layout, and browser errors checked.");
