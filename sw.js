const CACHE_NAME = "astound-prep-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/main.js",
  "./src/db.js",
  "./src/attempt.js",
  "./src/ui/desk.js",
  "./src/ui/attempt.js",
  "./src/ui/review.js",
  "./src/logic/validate.js",
  "./src/logic/numeric.js",
  "./src/logic/score.js",
  "./src/logic/shuffle.js",
  "./src/logic/paper.js",
  "./src/logic/time.js",
  "./src/logic/attempt-state.js",
  "./sample/percentages.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./fonts/newsreader-400.woff2",
  "./fonts/newsreader-600.woff2",
  "./fonts/atkinson-400.woff2",
  "./fonts/atkinson-700.woff2",
  "./fonts/OFL.txt",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
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
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
