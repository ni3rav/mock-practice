import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const index = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/index.html");
if (!existsSync(index)) {
  console.error("dist/index.html is missing. Run npm run build first.");
  process.exit(1);
}

const url = pathToFileURL(index).href;
const browsers = [
  "chromium-browser",
  "chromium",
  "google-chrome",
  "google-chrome-stable",
];

function launch(bin) {
  const child = spawn(bin, [`--app=${url}`], {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {});
  child.unref();
  return child;
}

let opened = false;
for (const bin of browsers) {
  const child = launch(bin);
  const failed = await new Promise((resolve) => {
    child.once("error", () => resolve(true));
    setTimeout(() => resolve(false), 400);
  });
  if (!failed) {
    opened = true;
    break;
  }
}

if (!opened) {
  console.error(`No Chromium or Chrome found. Open this file instead:\n${url}`);
  process.exit(1);
}

console.log(url);
