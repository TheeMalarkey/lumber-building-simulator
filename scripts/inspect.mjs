import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5178");
await page.waitForFunction(() => window.timber, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.screenshot({ path: "artifacts/editor-desktop.png" });
console.log(
  JSON.stringify(
    {
      errors,
      stats: await page.evaluate(() => window.timber.stats()),
      cards: await page.locator(".catalog-card").count(),
    },
    null,
    2,
  ),
);
writeFileSync(
  "artifacts/smoke.json",
  JSON.stringify(
    { errors, stats: await page.evaluate(() => window.timber.stats()) },
    null,
    2,
  ),
);
await browser.close();
