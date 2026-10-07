import type { Page } from "@playwright/test";
export async function openBuild(page: Page) {
  if (!await page.locator("#build-panel").isVisible()) await page.locator("#build-tool").click();
}
export async function openWire(page: Page, kind: "wire" | "neon" = "wire") {
  await openBuild(page);
  await page.locator("#search").fill("");
  await page.locator('[data-category="Wires"]').click();
  await page.locator(`[data-wire-item="${kind}"]`).click();
}
export async function openMenu(page: Page) {
  if (!await page.locator("#project-menu").isVisible()) await page.locator("#menu-tool").click();
}
export async function openWoods(page: Page) {
  if (!await page.locator("#woods").isVisible()) await page.locator("#wood-toggle").click();
}
