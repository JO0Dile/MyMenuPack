// Service worker for the hosted app.
//
// The app itself is one self-contained file, so the shell is just that plus
// the icons. Deliberately does NOT cache anything under /api/ — the catalogue
// must always come from the database live; caching it here would reintroduce
// exactly the stale-embedded-data problem this architecture removes.
var CACHE = 'studyplan-shell-v2';
var CORE = [
  './index.html', './manifest.json', './css/app.css', './js/01-catalogue.js',
  './js/02-shared-cross.js', './js/03-search.js', './js/05-collapse-finished-years.js',
  './js/06-per.js', './js/07-plan-overview-print.js', './js/08-celebrations.js',
  './js/10-progress-core.js', './js/11-module11.js', './js/12-removed.js',
  './js/13-pair-mode-toggle.js', './js/14-storage.js', './js/15-student.js', './js/16-data.js',
  './js/17-theme.js', './js/18-gpa.js', './js/19-audit.js', './js/20-personal.js',
  './js/21-course-modal-extras.js', './js/22-feedback.js', './js/23-legend.js',
  './js/24-achievements.js', './js/25-advisor.js', './js/26-dev.js', './js/27-community.js',
  './js/28-imported.js', './js/29-home.js', './js/30-sync.js', './js/31-collect.js',
  './js/32-tutorial.js', './js/33-plan-editor.js', './js/34-structure.js', './js/35-links.js',
  './js/36-dashboard.js', './js/37-sidebar.js', './js/38-accounts.js', './js/39-orphans.js',
  './js/40-retakes.js', './assets/icons/icon-any-192.png', './assets/icons/icon-any-384.png',
  './assets/icons/icon-any-512.png', './assets/icons/icon-any.svg',
  './assets/icons/icon-maskable-192.png', './assets/icons/icon-maskable-384.png',
  './assets/icons/icon-maskable-512.png', './assets/icons/icon-maskable.svg'
];

// Precached at install rather than opportunistically on first fetch. The
// worker does not control the very first page load, so anything cached only by
// the fetch handler is missed on a first visit — which meant the app looked
// offline-capable but wasn't until you had loaded it twice.
//
// addAll is atomic: one missing file fails the whole install. That is the
// behaviour we want (a half-cached shell is worse than none), but it does mean
// adding a module under js/ requires adding it here too.
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
