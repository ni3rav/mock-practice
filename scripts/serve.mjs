import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = 8765;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function findDist() {
  const candidates = [
    path.resolve(import.meta.dir, "dist"),
    path.resolve(import.meta.dir, "../dist"),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, "index.html"))) ?? null;
}

const distDir = findDist();
if (!distDir) {
  console.error("The built desk is missing. Run npm run binary from the project.");
  process.exit(1);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest")) {
    return "application/manifest+json; charset=utf-8";
  }
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function openWindow() {
  if (process.env.ASTOUND_PREP_NO_OPEN === "1") {
    return Promise.resolve(null);
  }
  const browsers = [
    "chromium-browser",
    "chromium",
    "google-chrome",
    "google-chrome-stable",
  ];
  return new Promise((resolve) => {
    const tryNext = (index) => {
      if (index >= browsers.length) {
        console.log(`Open ${ORIGIN}/`);
        resolve(null);
        return;
      }
      const child = spawn(browsers[index], [`--app=${ORIGIN}/`], { stdio: "ignore" });
      child.once("error", () => tryNext(index + 1));
      child.once("spawn", () => resolve(child));
    };
    tryNext(0);
  });
}

let server;
try {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = path.resolve(distDir, `.${requested}`);
      if (!filePath.startsWith(`${distDir}${path.sep}`) || !existsSync(filePath)) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(Bun.file(filePath), {
        headers: { "content-type": contentType(filePath) },
      });
    },
  });
} catch (error) {
  if (error?.code !== "EADDRINUSE") {
    throw error;
  }
  await openWindow();
  process.exit(0);
}

const browser = await openWindow();
if (!browser) {
  console.log(server.url.href);
} else {
  await new Promise((resolve) => browser.once("exit", resolve));
  server.stop(true);
}
