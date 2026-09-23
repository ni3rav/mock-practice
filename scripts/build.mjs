import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

const precache = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./fonts/newsreader-400.woff2",
  "./fonts/newsreader-600.woff2",
  "./fonts/atkinson-400.woff2",
  "./fonts/atkinson-700.woff2",
  "./fonts/OFL.txt",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "dist/app.js",
  legalComments: "none",
});

await cp(resolve(root, "styles.css"), resolve(dist, "styles.css"));
await cp(resolve(root, "manifest.webmanifest"), resolve(dist, "manifest.webmanifest"));
await cp(resolve(root, "fonts"), resolve(dist, "fonts"), { recursive: true });
await cp(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });

await writeFile(
  resolve(dist, "index.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#F4F1EA">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">
  <link rel="apple-touch-icon" href="./icons/icon-192.png">
  <title>Mock Practice</title>
  <link rel="stylesheet" href="./styles.css?v=7">
</head>
<body>
  <div id="app"></div>
  <script src="./app.js?v=7"></script>
</body>
</html>
`
);

await writeFile(
  resolve(dist, "sw.js"),
  `const CACHE_NAME = "mock-practice-v7";

const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (response && response.status === 200 && response.type !== "opaque") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
`
);

console.log("Built dist/. Open it with npm run open.");
