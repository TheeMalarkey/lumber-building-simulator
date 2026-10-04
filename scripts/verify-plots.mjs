import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5178');
await page.waitForFunction(() => window.timber);
await page.evaluate(() => {
  const e = window.timber.editor; e.world.load([], [12]);
  document.getElementById('welcome-note').hidden = true;
  e.view.adaptive = false; e.view.setQuality('balanced');
  e.view.camera.camera.position.set(47, 42, 53); e.view.camera.controls.target.set(0, 0, 0); e.view.camera.controls.update();
});
await page.waitForTimeout(4500);
await page.screenshot({ path: 'artifacts/plots-starter.png' });
await page.evaluate(() => {
  const c = window.timber.editor.view.camera;
  c.camera.position.set(0, 58, .01); c.controls.target.set(0, 0, 0); c.controls.update();
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'artifacts/plots-grid-top.png' });
await page.locator('#land-tool').click();
await page.locator('[data-plot="13"]').click();
await page.locator('[data-plot="8"]').click();
await page.screenshot({ path: 'artifacts/plots-selector.png' });
await page.locator('#close-modal').click();
await page.evaluate(() => {
  const e = window.timber.editor; e.world.load([], [12]);
  e.view.grid.visible = false; e.view.terrain.borders.visible = false;
  e.view.camera.camera.position.set(24, .85, 26); e.view.camera.controls.target.set(8, 0, 8); e.view.camera.controls.update();
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'artifacts/plots-edge.png' });
await page.evaluate(() => { window.timber.editor.view.grid.visible = true; });
await page.waitForTimeout(300);
await page.screenshot({ path: 'artifacts/plots-grid-low.png' });
await page.evaluate(() => {
  const e = window.timber.editor; e.world.load([], Array.from({ length: 25 }, (_, i) => i));
  e.view.terrain.borders.visible = true;
  e.view.camera.camera.position.set(185, 200, 200); e.view.camera.controls.target.set(0, 0, 0); e.view.camera.controls.update();
});
await page.waitForTimeout(4500);
await page.screenshot({ path: 'artifacts/plots-full.png' });
const full = await page.evaluate(() => ({ ...window.timber.editor.view.stats, plots: window.timber.editor.world.plots.length }));
await page.setViewportSize({ width: 1024, height: 768 });
await page.locator('#land-tool').click();
const compact = await page.evaluate(() => {
  const box = document.querySelector('#modal').getBoundingClientRect();
  return box.top >= 0 && box.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
});
await page.screenshot({ path: 'artifacts/plots-compact.png' });
const result = { errors, full, compact }; console.log(JSON.stringify(result, null, 2));
writeFileSync('artifacts/plots-check.json', JSON.stringify(result, null, 2));
await browser.close();
if (errors.length || !compact || full.plots !== 25) process.exitCode = 1;
