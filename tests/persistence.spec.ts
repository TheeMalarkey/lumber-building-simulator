import { openBuild, openMenu, openWoods } from "./ui-helpers";
import { test, expect } from "@playwright/test";
test("valid import, atomic backup recovery, and storage failure keep data safe", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).timber);
  const fixture = {
    version: 1,
    name: "Recovery fixture",
    pieces: [
      {
        id: "recovery-1",
        item: "tiny-tile",
        wood: "birch",
        position: [-0.5, 0.1, 1.25],
        rotation: [0, 3, 0],
      },
    ],
  };
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "fixture.timber",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.locator("#confirm-action").click();
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  await openMenu(page); await page.locator("#save").click();
  await expect(page.locator("#save-state")).toHaveText("Saved on this device");
  // Corrupt only the current record; the previous atomic snapshot must still load.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const q = indexedDB.open("timber-studio-v1");
        q.onsuccess = () => {
          const db = q.result,
            tx = db.transaction("projects", "readwrite");
          tx.objectStore("projects").put("broken", "current");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.waitForFunction(() => !!(window as any).timber);
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  await expect(page.locator("#toast")).toContainText("Recovered");
  const restored = await page.evaluate(
    () => (window as any).timber.editor.project,
  );
  expect(restored).toEqual({ ...fixture, plots: [12] });
  // Simulate an unavailable storage API; saving must not clear the live scene or report success.
  await page.evaluate(() => {
    Object.defineProperty(indexedDB, "open", {
      value: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      configurable: true,
    });
  });
  await openMenu(page); await page.locator("#save").click();
  await expect(page.locator("#save-state")).toHaveText("Save failed · export");
  await expect(page.locator("#piece-count")).toHaveText("1 pieces");
  const download = page.waitForEvent("download");
  await openMenu(page); await page.locator("#export").click();
  expect((await download).suggestedFilename()).toBe("Recovery fixture.timber");
});
