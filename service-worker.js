const CACHE_NAME = "team-revolution-v3-invoices";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./firebase-config.js",
  "./firebase-connection.js",
  "./auth-gate.js",
  "./attendance.html",
  "./bookings.html",
  "./finance.html",
  "./invoices.html",
  "./members.html",
  "./memberships.html",
  "./member-profile.html",
  "./reports.html",
  "./settings.html",
  "./trainers.html",
  "./manifest.json",
  "./assets/tribal-logo-192.png",
  "./assets/tribal-logo-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});