import type { Page } from "@playwright/test";
export async function openBuild(page: Page) {
  if (!await page.locator("#build-panel").isVisible()) await page.locator("#build-tool").click();
}
export async function openMenu(page: Page) {
  if (!await page.locator("#project-menu").isVisible()) await page.locator("#menu-tool").click();
}
export async function openWoods(page: Page) {
  if (!await page.locator("#woods").isVisible()) await page.locator("#wood-toggle").click();
}
