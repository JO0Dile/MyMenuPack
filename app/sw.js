// Service worker for the hosted / app-store version.
// Strategy: cache-first with background refresh ("stale-while-revalidate").
// The app opens instantly from cache even with no connection — exactly like
// the standalone file — and quietly picks up new versions when online,
// which is the whole reason the hosted version exists (shipping updated
// and newly-contributed study plans to everyone automatically).
var CACHE = 'student-study-plans-v14';
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

// Stale-while-revalidate hides updates by design (you always get the fast
// cached copy first) — which is exactly what confused a real user testing
// this: a merged, deployed change silently didn't show up until a second
// reload, with nothing telling them a reload would even help. For the app
// shell specifically (plan.html), diff the freshly-fetched body against
// what was already cached and tell every open tab if they differ, so the
// page can offer a one-tap refresh instead of a "why isn't this here" reload
// loop the size of everything else this file was already fetching anyway.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var isAppShell = e.request.mode === 'navigate' || /\/plan\.html(\?|$)/.test(e.request.url);
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      // cache: 'no-store' on the background-refresh fetch specifically —
      // this call's entire purpose is "what does the server actually have
      // right now," so it must never be satisfied by the browser's own
      // regular HTTP cache. Without this, a same-origin response cached at
      // that layer (independent of the Cache Storage this file manages
      // above) could make even this diff-and-notify check itself compare
      // against a stale copy and silently never detect a real update.
      var fetched = fetch(e.request, { cache: 'no-store' }).then(function (resp) {
        if (resp && resp.ok) {
          var copyForCache = resp.clone();
          var copyForDiff = isAppShell ? resp.clone() : null;
          caches.open(CACHE).then(function (c) { c.put(e.request, copyForCache); });
          if (isAppShell && cached) {
            Promise.all([cached.clone().text(), copyForDiff.text()]).then(function (texts) {
              if (texts[0] !== texts[1]) { notifyUpdate(); }
            }).catch(function () {});
          }
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || fetched;
    })
  );
});

function notifyUpdate() {
  self.clients.matchAll({ type: 'window' }).then(function (clients) {
    clients.forEach(function (c) { c.postMessage({ type: 'AAUP_UPDATE_AVAILABLE' }); });
  });
}
