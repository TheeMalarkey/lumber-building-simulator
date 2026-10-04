import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('http://127.0.0.1:5178'); await page.waitForFunction(() => window.timber);
const result = await page.evaluate(() => {
  const e = window.timber.editor, v = e.view, t = v.terrain, c = v.camera;
  e.world.load([], [12]); v.renderer.setAnimationLoop(null); v.adaptive = false;
  v.renderer.shadowMap.enabled = false; c.controls.enableDamping = false;
  v.grid.visible = t.borders.visible = false;
  t.plots.material.color.set('#ff0000'); t.plots.material.map = t.plots.material.normalMap = null; t.plots.material.needsUpdate = true;
  t.grass.material.color.set('#00ff00'); t.grass.material.map = t.grass.material.normalMap = null; t.grass.material.needsUpdate = true;
  const gl = v.renderer.getContext(), failures = [];
  let draws = 0; t.plots.onBeforeRender = () => { draws++; };
  const sample = () => { const p = new Uint8Array(4); gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; };
  for (const height of [.3, 1, 5, 30, 63, 65, 90]) for (const distance of [30, 63, 65, 100, 160]) for (let step = 0; step < 24; step++) {
    const angle = step * Math.PI / 12;
    c.camera.position.set(Math.cos(angle) * distance, height, Math.sin(angle) * distance);
    c.controls.target.set(0, 0, 0); c.controls.update(); const before = draws; v.tick();
    const pixel = sample();
    if (pixel[1] > pixel[0]) {
      t.grass.visible = false; v.tick(); const withoutGrass = sample(); t.grass.visible = true;
      failures.push({ height, distance, step, pixel, withoutGrass, submitted: draws > before, origin: v.origin.toArray() });
      if (failures.length >= 8) return failures;
    }
  }
  return failures;
});
const evidence = { cameraViews: 840, failures: result };
writeFileSync('artifacts/terrain-depth-check.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2)); await browser.close();
if (result.length) process.exitCode = 1;
