// Service worker for the hosted app.
//
// The app itself is one self-contained file, so the shell is just that plus
// the icons. Deliberately does NOT cache anything under /api/ — the catalogue
// must always come from the database live; caching it here would reintroduce
// exactly the stale-embedded-data problem this architecture removes.
var CACHE = 'studyplan-shell-v2';
var CORE = [
  './index.html', './manifest.json',
  './assets/icons/icon-any.svg',
  './assets/icons/icon-any-192.png', './assets/icons/icon-any-384.png', './assets/icons/icon-any-512.png',
  './assets/icons/icon-maskable-192.png', './assets/icons/icon-maskable-384.png', './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).pathname.indexOf('/api/') !== -1) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request, { cache: 'no-store' }).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || fetched;
    })
  );
});
