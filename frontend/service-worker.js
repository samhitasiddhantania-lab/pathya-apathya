const CACHE_NAME = "pathya-advisor-shell-v3"; // bumped: now also caches Admin/Dravya doctor pages
const SHELL_FILES = [
  "./index.html",
  "./admin.html",
  "./dravya.html",
  "./css/style.css",
  "./css/admin.css",
  "./css/dravya.css",
  "./js/config.js",
  "./js/api.js",
  "./js/render.js",
  "./js/app.js",
  "./js/admin.js",
  "./js/dravya.js",
  "./manifest.json",
  "./admin-manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
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

  // Network-first: always try to get the latest file from the server. Only
  // fall back to the cached copy if the network request fails (i.e. the
  // user is actually offline). This ensures a fresh deploy is picked up on
  // the very next reload instead of being masked by a stale cache
  // indefinitely, while still preserving offline support.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});