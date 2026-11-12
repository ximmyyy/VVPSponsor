import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 45_000,
  reporter: "list",
  use: {
    browserName: "chromium",
    launchOptions: { executablePath },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testMatch: "design.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:3100",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      testMatch: ["design.spec.ts", "mobile-menu.spec.ts"],
      use: {
        baseURL: "http://127.0.0.1:3100",
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "production",
      testMatch: "production.spec.ts",
      use: { baseURL: "http://127.0.0.1:3200" },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 3100",
      url: "http://127.0.0.1:3100",
      env: { APP_ENV: "local", NEXT_TELEMETRY_DISABLED: "1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    // Bewust APP_ENV=local: NODE_ENV=production moet alsnog elke preview blokkeren.
    {
      command: "npm start -- --port 3200",
      url: "http://127.0.0.1:3200",
      env: { APP_ENV: "local", NEXT_TELEMETRY_DISABLED: "1" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
