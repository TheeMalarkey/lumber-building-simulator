import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:5178/?benchmark=1000");
await page.waitForFunction(() => window.timber, { timeout: 60000 });
const environment = await page.evaluate(() => {
  const r = window.timber.editor.view.renderer,
    gl = r.getContext(),
    ex = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    browser: navigator.userAgent,
    gpu: ex
      ? gl.getParameter(ex.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER),
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
  };
});
const results = [];
for (const count of [1000, 10000, 100000])
  for (const mixed of [false, true]) {
    const setup = await page.evaluate(
      ({ count, mixed }) => {
        const e = window.timber.editor;
        e.view.adaptive = false;
        e.view.setQuality("balanced");
        e.view.renderer.setPixelRatio(1);
        const start = performance.now();
        window.timber.benchmark(count, mixed);
        const side = Math.ceil(Math.sqrt(count)) * 5;
        e.view.camera.controls.target.set(
          Math.min(side / 2, 200),
          4,
          Math.min(side / 2, 200),
        );
        e.view.camera.camera.position.set(
          Math.min(side / 2, 200) + 130,
          100,
          Math.min(side / 2, 200) + 150,
        );
        e.view.sync(true);
        return performance.now() - start;
      },
      { count, mixed },
    );
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.timber.editor.view.frames = [];
      window.timber.editor.view.camera.controls.autoRotate = true;
      window.timber.editor.view.camera.controls.autoRotateSpeed = 0.7;
    });
    await page.waitForTimeout(3000);
    const result = await page.evaluate(() => {
      const e = window.timber.editor;
      e.view.camera.controls.autoRotate = false;
      const times = [...e.view.frames].sort((a, b) => a - b);
      let visible = 0;
      for (const g of e.view.loaded.values())
        for (const m of g.children) visible += m.count;
      const r = e.view.renderer.domElement.getBoundingClientRect();
      const pickStart = performance.now();
      e.view.pick(r.x + r.width / 2, r.y + r.height * 0.6);
      const pickMs = performance.now() - pickStart;
      const fileStart = performance.now();
      const json = JSON.stringify(e.project);
      return {
        ...e.view.stats,
        residentPieces: visible,
        medianMs: times[Math.floor(times.length / 2)],
        p95Ms: times[Math.floor(times.length * 0.95)],
        samples: times.length,
        pickMs,
        serializeMs: performance.now() - fileStart,
        fileBytes: json.length,
        jsHeapEstimateBytes: performance.memory?.usedJSHeapSize,
      };
    });
    results.push({ count, mixed, setupMs: setup, ...result });
    console.log(JSON.stringify(results.at(-1)));
  }
writeFileSync(
  "artifacts/benchmarks.json",
  JSON.stringify({ environment, results }, null, 2),
);
await browser.close();
