import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: [
    "browser.spec.ts",
    "hud.spec.ts",
    "persistence.spec.ts",
    "materials.spec.ts",
    "walk.spec.ts",
    "plots.spec.ts",
    "selection.spec.ts",
  ],
  timeout: 40000,
  workers: 1,
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 960 },
    baseURL: "http://127.0.0.1:5178",
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
