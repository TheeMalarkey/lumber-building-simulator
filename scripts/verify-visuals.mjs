import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5178');
await page.waitForFunction(() => window.timber);
await page.evaluate(() => {
  const e = window.timber.editor;
  document.getElementById('welcome-note').hidden = true;
  const woods = ['oak', 'walnut', 'cherry', 'spooky', 'frost', 'phantom'];
  e.world.load(woods.flatMap((wood, i) => [
    { id: 'wall-' + wood, item: 'smooth-wall', wood, position: [(i - 2.5) * 6, 4, 0], rotation: [0, 0, 0] },
    { id: 'floor-' + wood, item: 'floor', wood, position: [(i - 2.5) * 6, .5, 4], rotation: [0, 0, 0] },
  ]));
  e.view.camera.camera.position.set(17, 17, 42);
  e.view.camera.controls.target.set(0, 3, 1);
  e.view.camera.controls.update();
  e.view.sync(true);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/wood-materials.png' });
await page.evaluate(() => {
  const e = window.timber.editor;
  // A modest showroom where the character gives the pieces a readable scale.
  const pieces = [...e.world.pieces.values()].filter(p => p.wood === 'oak' || p.wood === 'walnut' || p.wood === 'cherry');
  e.world.load(pieces);
  e.view.camera.camera.position.set(-10, 9, 13);
  e.view.camera.controls.target.set(-9, 3, 0);
  e.view.camera.controls.update();
  e.view.sync(true);
});
await page.locator('#walk-tool').click();
await page.mouse.move(20, 20);
await page.waitForTimeout(4000);
await page.screenshot({ path: 'artifacts/walk-camera.png' });
await page.evaluate(() => { window.timber.editor.view.camera.walker.avatar.rotation.y += Math.PI; });
await page.waitForTimeout(200);
await page.screenshot({ path: 'artifacts/walk-avatar-front.png' });
const state = await page.evaluate(() => {
  const e = window.timber.editor, c = e.view.camera;
  return { walking: c.walking, grounded: c.walker.grounded, avatar: c.walker.avatar.visible,
    pieces: e.world.pieces.size, ...e.view.stats };
});
writeFileSync('artifacts/visual-check.json', JSON.stringify({ errors, ...state }, null, 2));
console.log(JSON.stringify({ errors, ...state }, null, 2));
await browser.close();
if (errors.length || !state.walking || !state.grounded || !state.avatar) process.exitCode = 1;
