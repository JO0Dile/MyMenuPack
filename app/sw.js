// Service worker for the hosted / app-store version.
// Strategy: cache-first with background refresh ("stale-while-revalidate").
// The app opens instantly from cache even with no connection — exactly like
// the standalone file — and quietly picks up new versions when online,
// which is the whole reason the hosted version exists (shipping updated
// and newly-contributed study plans to everyone automatically).
var CACHE = 'student-study-plans-v2';
var CORE = [
  './plan.html', './manifest.json',
  './icons/icon-any.svg',
  './icons/icon-any-192.png', './icons/icon-any-384.png', './icons/icon-any-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-384.png', './icons/icon-maskable-512.png'
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
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request).then(function (resp) {
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
