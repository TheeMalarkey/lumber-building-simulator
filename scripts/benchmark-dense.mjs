import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:5178/?benchmark=1000");
await page.waitForFunction(() => window.timber);
const results = [];
for (const count of [10000, 100000]) {
  const setupMs = await page.evaluate((count) => {
    const e = window.timber.editor;
    e.view.adaptive = false;
    e.view.setQuality("balanced");
    e.view.renderer.setPixelRatio(1);
    e.view.renderDistance = 640;
    const start = performance.now();
    window.timber.benchmark(count, true);
    const pieces = [...e.world.pieces.values()].map((p, i) => ({
      ...p,
      position: [
        (i % 100) * 2,
        Math.floor(i / 10000) * 10 + 4,
        (Math.floor(i / 100) % 100) * 2,
      ],
    }));
    e.world.load(pieces);
    e.view.camera.controls.target.set(100, 25, 100);
    e.view.camera.camera.position.set(330, 190, 350);
    e.view.sync(true);
    return performance.now() - start;
  }, count);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const v = window.timber.editor.view;
    v.frames = [];
    v.camera.controls.autoRotate = true;
    v.camera.controls.autoRotateSpeed = 0.7;
  });
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => {
    const e = window.timber.editor;
    e.view.camera.controls.autoRotate = false;
    const f = [...e.view.frames].sort((a, b) => a - b);
    let resident = 0;
    for (const g of e.view.loaded.values())
      for (const m of g.children) resident += m.count;
    const rect = e.view.renderer.domElement.getBoundingClientRect();
    const start = performance.now();
    e.view.pick(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      ...e.view.stats,
      residentPieces: resident,
      medianMs: f[Math.floor(f.length / 2)],
      p95Ms: f[Math.floor(f.length * 0.95)],
      pickMs: performance.now() - start,
      samples: f.length,
    };
  });
  results.push({
    count,
    layout: "100 x 100 columns, 2-stud spacing, stacked 10-stud layers",
    setupMs,
    ...data,
  });
  console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(
  "artifacts/benchmarks-dense.json",
  JSON.stringify(results, null, 2),
);
await browser.close();
