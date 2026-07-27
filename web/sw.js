// Service worker for the hosted app shell only. Deliberately does NOT cache
// anything under /api/ — course, prerequisite, and grading data must always
// come from the database live; caching it here would silently reintroduce
// the "stale hardcoded data" problem this whole migration exists to remove.
var CACHE = 'studyplan-shell-v1';
var CORE = [
  './index.html', './manifest.json', './src/css/style.css',
  './src/js/app.js', './src/js/api.js', './src/js/store.js',
  './src/js/prerequisites.js', './src/js/gpa.js', './src/js/assessment.js',
  './src/js/i18n.js', './src/js/achievements.js', './src/js/editmode.js',
  './assets/icons/icon-any.svg',
  './assets/icons/icon-any-192.png', './assets/icons/icon-any-384.png', './assets/icons/icon-any-512.png',
  './assets/icons/icon-maskable-192.png', './assets/icons/icon-maskable-384.png', './assets/icons/icon-maskable-512.png',
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

// Stale-while-revalidate for the shell; the API is never intercepted here.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.pathname.includes('/api/')) return;

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
