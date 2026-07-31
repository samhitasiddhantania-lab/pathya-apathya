const CACHE_NAME = "pathya-advisor-shell-v1";
const SHELL_FILES = [
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/api.js",
  "./js/render.js",
  "./js/app.js",
  "./manifest.json",
];

// Cache the app shell (HTML/CSS/JS) on install so the UI itself loads offline.
// Actual disease data is cached separately in localStorage by app.js, since
// it's fetched dynamically per search.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls — always go to network so data stays fresh.
  if (url.pathname.startsWith("/api/") || url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
