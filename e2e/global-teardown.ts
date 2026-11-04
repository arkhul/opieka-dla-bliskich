import { spawnSync } from "node:child_process";

// Used only when Playwright manages its own preview (BASE_URL unset); see playwright.config.ts.
export default function globalTeardown() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  spawnSync(npx, ["astro", "preview", "stop"], { stdio: "inherit", shell: true });
}
