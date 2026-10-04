import { chromium, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { writeFileSync } from "node:fs";

const target = process.env.TIMBER_URL || "http://127.0.0.1:5179/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto(target);
await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
expect(await page.evaluate(() => typeof window.timber)).toBe("undefined");
const fixture = [
  { id: "a", item: "small-floor", wood: "oak", position: [-6, .5, -6], rotation: [0, 1, 0] },
  { id: "b", item: "small-floor", wood: "birch", position: [0, .5, -6], rotation: [0, 0, 0] },
  { id: "c", item: "small-floor", wood: "walnut", position: [6, .5, 6], rotation: [0, 0, 0] },
];
await page.locator("#menu-tool").click();
await page.locator("#file-input").setInputFiles({ name: "selection-check.timber", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({ version: 1, name: "Selection check", pieces: fixture, plots: [12] })) });
await page.locator("#confirm-action").click();
await page.locator("#menu-tool").click();
await page.locator("#top").click();
const rect = await page.locator("#viewport>canvas").boundingBox();
const camera = new PerspectiveCamera(45, rect.width / rect.height, .1, 4000);
camera.position.set(0, 69, .01); camera.lookAt(0, 4, 0); camera.updateMatrixWorld();
const project = p => {
  const v = new Vector3(...p).project(camera);
  return [rect.x + (v.x + 1) * rect.width / 2, rect.y + (1 - v.y) * rect.height / 2];
};
await page.keyboard.down("Control");
await page.mouse.move(...project([-9, 0, -9])); await page.mouse.down();
await page.mouse.move(...project([3, 0, -3]), { steps: 5 });
await expect(page.locator("#selection-marquee")).toBeVisible();
await page.mouse.up(); await page.keyboard.up("Control");
await expect(page.locator("#selection-count")).toHaveText("2 selected");
await page.keyboard.down("Control"); await page.mouse.click(...project([6, .5, 6]));
await expect(page.locator("#selection-count")).toHaveText("3 selected");
await page.mouse.click(...project([6, .5, 6])); await page.keyboard.up("Control");
await page.keyboard.press("g"); await page.mouse.click(...project([3, 0, 6]));
await expect(page.locator("#toast")).toContainText("overlap");
await page.mouse.click(...project([-3, 0, 6]));
await page.keyboard.press("Control+d"); await page.mouse.click(...project([-3, 0, 0]));
await expect(page.locator("#piece-count")).toHaveText("5 pieces");
await page.keyboard.press("Delete"); await expect(page.locator("#piece-count")).toHaveText("3 pieces");
await page.keyboard.press("Control+z"); await expect(page.locator("#piece-count")).toHaveText("5 pieces");
await page.locator("#menu-tool").click();
const downloadPromise = page.waitForEvent("download"); await page.locator("#export").click();
const download = await downloadPromise, stream = await download.createReadStream(), chunks = [];
for await (const chunk of stream) chunks.push(chunk);
const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
expect(result.pieces.find(p => p.id === "a")).toEqual({ ...fixture[0], position: [-6, .5, 6] });
expect(result.pieces.find(p => p.id === "b")).toEqual({ ...fixture[1], position: [0, .5, 6] });
expect(result.pieces.find(p => p.id === "c")).toEqual(fixture[2]);
const copies = result.pieces.filter(p => !fixture.some(original => original.id === p.id));
expect(copies.map(p => [p.wood, p.position, p.rotation]).sort()).toEqual([
  ["birch", [0, .5, 0], [0, 0, 0]], ["oak", [-6, .5, 0], [0, 1, 0]],
]);
expect(errors).toEqual([]);
writeFileSync("artifacts/group-live-check.json", JSON.stringify({ target, selected: 2, copied: copies.length,
  exportedPieces: result.pieces.length, debugAPI: false, errors, controlsVerified: ["Ctrl-drag", "Ctrl-click", "move", "copy", "delete", "undo", "export"] }, null, 2));
await browser.close();
console.log("Production UI verified: Ctrl-drag, Ctrl-click, blocked collision, group move/copy/delete/undo and exported transforms.");
