import { defineConfig, devices } from "@playwright/test";

// BASE_URL set (CI): Playwright targets the preview the CI step already started and does not manage a server.
// BASE_URL unset (local): Playwright builds and starts its own fresh preview on :4321 and tears it down after.
const baseURL = process.env.BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "e2e",
  // One flake is a signal to investigate, not to hide: no retries, and a stray `.only` fails CI instead of running.
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Coordinator flow seeds data through the same preview/database; parallel workers would race on it.
  workers: 1,
  // CI: the HTML report (with traces and screenshots) is what the failure-only artifact upload in ci.yml ships;
  // the default CI reporter ("dot") writes no playwright-report/ at all.
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      // A narrow Chromium viewport, not a device descriptor: no touch/UA emulation, just the layout.
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  ...(process.env.BASE_URL
    ? {}
    : {
        // On Windows Playwright kills the wrapper with taskkill /F, so its SIGTERM handler never runs;
        // this stops the detached preview daemon instead of leaving a stale build on :4321.
        globalTeardown: "./e2e/global-teardown.ts",
        webServer: {
          // See scripts/preview-blocking.mjs: `astro preview` daemonizes and exits once
          // it confirms the server is up, which this wrapper absorbs so the spawned
          // process stays alive for Playwright to watch.
          command: "node scripts/preview-blocking.mjs",
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      }),
});
