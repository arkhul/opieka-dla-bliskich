#!/usr/bin/env node
// `astro preview` confirms the daemon is up then exits, so Playwright's webServer
// (which watches the process it spawned, not just the port) sees that exit and
// reports "Process from config.webServer exited early" even though the preview
// daemon keeps serving requests. This wrapper stays alive after the handoff so
// Playwright has a long-lived process to watch, and stops the daemon on teardown.
import { spawnSync } from "node:child_process";

const port = process.env.PREVIEW_PORT ?? "4321";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function stopDaemon() {
  spawnSync(npx, ["astro", "preview", "stop"], { stdio: "inherit", shell: true });
}

stopDaemon();

const build = spawnSync(npm, ["run", "build"], { stdio: "inherit", shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

const start = spawnSync(npm, ["run", "preview", "--", "--port", port], { stdio: "inherit", shell: true });
if (start.status !== 0) process.exit(start.status ?? 1);

process.on("SIGTERM", () => {
  stopDaemon();
  process.exit(0);
});
process.on("SIGINT", () => {
  stopDaemon();
  process.exit(0);
});

// Top-level await on a never-resolving promise trips Node's unsettled-await exit (code 13),
// so keep the event loop alive with a long-interval timer instead.
// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op keep-alive tick
setInterval(() => {}, 2 ** 31 - 1);
