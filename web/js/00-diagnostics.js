// ==========================
// DIAGNOSTICS RECORDER
// ==========================
// A deliberately tiny, dependency-free recorder loaded FIRST (in <head>,
// before every other module) so it is already listening when the things it
// records happen. A module that throws while loading, a stylesheet that 404s,
// a fetch that fails — all of those happen before any feature module exists,
// and anything installed later simply never sees them.
//
// It only records. Reading and interpreting these entries is the Fix system's
// job (js/45-fix-*.js); keeping the two apart means the recorder can stay
// small enough to be obviously correct, and can never itself be the thing
// that breaks the page it is supposed to be watching.
//
// Everything is capped and in-memory: no localStorage writes, no network, no
// reporting anywhere. Nothing here ever leaves the device.
(function () {
  var MAX = 60; // per bucket — a broken render can fire thousands; the first 60 tell the same story

  var log = { errors: [], resources: [], network: [], warnings: [] };

  function push(bucket, entry) {
    try {
      var list = log[bucket];
      if (!list || list.length >= MAX) return;
      entry.at = Date.now();
      list.push(entry);
    } catch (e) { /* the recorder must never be the thing that throws */ }
  }

  // Script/link/img load failures arrive as error events that do NOT bubble,
  // hence the capture phase. e.target is the element that failed; a genuine
  // JS exception has no target of its own and is handled by onerror below.
  window.addEventListener('error', function (e) {
    var el = e && e.target;
    if (el && el !== window && el.tagName) {
      push('resources', {
        tag: el.tagName.toLowerCase(),
        url: el.src || el.href || '',
        kind: 'load-failed'
      });
      return;
    }
    push('errors', {
      message: (e && e.message) || 'Unknown error',
      source: (e && e.filename) || '',
      line: (e && e.lineno) || 0,
      col: (e && e.colno) || 0,
      stack: (e && e.error && e.error.stack) ? String(e.error.stack).slice(0, 900) : ''
    });
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    push('errors', {
      message: 'Unhandled promise rejection: ' + ((r && r.message) || String(r)).slice(0, 300),
      source: '', line: 0, col: 0,
      stack: (r && r.stack) ? String(r.stack).slice(0, 900) : ''
    });
  });

  // console.error / console.warn are wrapped rather than replaced: the
  // original is always called first, so devtools output is completely
  // unchanged and a mistake in the recorder can't swallow a message.
  ['error', 'warn'].forEach(function (level) {
    if (!window.console || typeof console[level] !== 'function') return;
    var original = console[level];
    console[level] = function () {
      try {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          parts.push(a && a.message ? a.message : String(a));
        }
        push(level === 'error' ? 'errors' : 'warnings', {
          message: parts.join(' ').slice(0, 400),
          source: 'console.' + level, line: 0, col: 0, stack: ''
        });
      } catch (e) { /* ignore */ }
      return original.apply(console, arguments);
    };
  });

  // fetch is wrapped for the same reason — the original result (or
  // rejection) is passed through untouched, so wrapping it can only ever
  // add an observation, never change behaviour.
  if (typeof window.fetch === 'function') {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = '';
      try { url = (typeof input === 'string') ? input : (input && input.url) || ''; } catch (e) {}
      return nativeFetch.apply(window, arguments).then(function (resp) {
        if (resp && !resp.ok) {
          push('network', { url: url, status: resp.status, kind: 'http-error' });
        }
        return resp;
      }, function (err) {
        push('network', { url: url, status: 0, kind: 'failed', message: String(err && err.message || err).slice(0, 200) });
        throw err;
      });
    };
  }

  window.__DIAG = {
    log: log,
    startedAt: Date.now(),
    // A snapshot rather than the live arrays: an analyzer iterating these
    // while new entries arrive should see one stable picture.
    snapshot: function () {
      return {
        errors: log.errors.slice(),
        resources: log.resources.slice(),
        network: log.network.slice(),
        warnings: log.warnings.slice()
      };
    },
    clear: function () {
      log.errors.length = 0; log.resources.length = 0;
      log.network.length = 0; log.warnings.length = 0;
    }
  };
})();
