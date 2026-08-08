// ==========================
// ICONS — how a university or a major is pictured
// ==========================
// Three layers, tried in order, so every one of them is optional:
//
//   1. imageUrl  — a PNG uploaded through Admin → Assets. Wins when present.
//   2. iconKey   — one of the built-in line icons below. Ships with the app,
//                  inherits the current theme colour, stays sharp at any size,
//                  costs no network request and works offline.
//   3. icon      — the emoji the app has always used. Never removed: it is the
//                  last fallback, so a plan that has neither of the other two
//                  looks exactly like it did before this module existed.
//
// The point of the order is that an admin can improve a major's icon without
// anyone editing code, and a major nobody has touched still renders fine.
//
// The icons are deliberately one visual family: 24×24, 1.8px round strokes, no
// fills, drawn on the same grid. That is why they are hand-written here rather
// than pulled from an icon font — a font is a network dependency and a licence,
// and mixing sets is what made the old generic 🎓 look out of place.
(function(){
  'use strict';

  // stroke() wraps a path list in the shared <svg> chrome so each entry below
  // is just its own geometry. currentColor is what makes them theme-aware.
  function stroke(paths){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      paths + '</svg>';
  }

  var ICONS = {
    // ---- computing ----
    robot: stroke('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/>' +
      '<circle cx="12" cy="3" r="1.4"/><circle cx="9" cy="13" r="1.1"/><circle cx="15" cy="13" r="1.1"/>' +
      '<path d="M9.5 16.5h5"/><path d="M4 12H2"/><path d="M22 12h-2"/>'),
    code: stroke('<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="M13.5 4.5 10.5 19.5"/>'),
    network: stroke('<rect x="9" y="2" width="6" height="5" rx="1.4"/>' +
      '<rect x="2" y="15" width="6" height="5" rx="1.4"/><rect x="16" y="15" width="6" height="5" rx="1.4"/>' +
      '<path d="M12 7v4"/><path d="M5 15v-2h14v2"/>'),
    shield: stroke('<path d="M12 3 5 6v5.5c0 4.3 2.9 8.1 7 9.5 4.1-1.4 7-5.2 7-9.5V6z"/>' +
      '<circle cx="12" cy="11" r="1.9"/><path d="M12 12.9V15.5"/>'),
    gamepad: stroke('<path d="M7.5 8h9a5 5 0 0 1 4.6 7l-.9 2.1a2.2 2.2 0 0 1-3.8.5L14.6 16H9.4l-1.8 1.6a2.2 2.2 0 0 1-3.8-.5L2.9 15A5 5 0 0 1 7.5 8Z"/>' +
      '<path d="M7 11v2.4"/><path d="M5.8 12.2h2.4"/><circle cx="16" cy="11.6" r="1"/><circle cx="18.2" cy="13.6" r="1"/>'),
    vr: stroke('<path d="M3.5 8.5h17a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-3.9a2 2 0 0 1-1.6-.8l-1.2-1.6a2 2 0 0 0-3.2 0l-1.2 1.6a2 2 0 0 1-1.6.8H3.5A1.5 1.5 0 0 1 2 14v-4a1.5 1.5 0 0 1 1.5-1.5Z"/>' +
      '<path d="M6 8.5V7.2"/><path d="M18 8.5V7.2"/>'),

    // ---- data & maths ----
    brain: stroke('<path d="M12 5.5a3 3 0 0 0-5.6-1.5A2.8 2.8 0 0 0 4 8.4a3 3 0 0 0 .5 4.6A3 3 0 0 0 7 18.4a3 3 0 0 0 5 1.1z"/>' +
      '<path d="M12 5.5A3 3 0 0 1 17.6 4 2.8 2.8 0 0 1 20 8.4a3 3 0 0 1-.5 4.6A3 3 0 0 1 17 18.4a3 3 0 0 1-5 1.1z"/>' +
      '<path d="M12 5.5v14"/>'),
    datascience: stroke('<circle cx="5" cy="18" r="1.8"/><circle cx="11" cy="11" r="1.8"/>' +
      '<circle cx="18" cy="14" r="1.8"/><circle cx="16" cy="5" r="1.8"/>' +
      '<path d="m6.3 16.7 3.4-4.3"/><path d="m12.7 11.8 3.6 1.5"/><path d="m16.6 6.7-4.4 3.1"/>'),
    stats: stroke('<path d="M3 20h18"/><rect x="4.5" y="12" width="3.6" height="6" rx="1"/>' +
      '<rect x="10.2" y="7.5" width="3.6" height="10.5" rx="1"/>' +
      '<rect x="15.9" y="4" width="3.6" height="14" rx="1"/>'),
    chart: stroke('<path d="M3 20h18"/><path d="m4.5 15 4.2-4.6 3.4 2.9L20 6"/>' +
      '<path d="M20 10.4V6h-4.4"/>'),
    finance: stroke('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2v9.6"/>' +
      '<path d="M14.6 9.4a2.7 2.7 0 0 0-2.6-1.5c-1.6 0-2.6.9-2.6 2.1 0 2.9 5.4 1.5 5.4 4.4 0 1.3-1.1 2.2-2.8 2.2a2.9 2.9 0 0 1-2.8-1.7"/>'),
    fintech: stroke('<rect x="3" y="6" width="18" height="12" rx="2.4"/><path d="M3 10h18"/>' +
      '<path d="M7 14.5h3"/><circle cx="16.5" cy="14.4" r="1.9"/>' +
      '<path d="M16.5 12.5v-.9"/><path d="M16.5 17.2v-.9"/>'),

    // ---- health ----
    medical: stroke('<path d="M6 3v5.2a5 5 0 0 0 5 5 5 5 0 0 0 5-5V3"/><path d="M4.4 3h3.2"/><path d="M14.4 3h3.2"/>' +
      '<path d="M11 13.2v2.3a4 4 0 0 0 8 0v-.8"/><circle cx="19" cy="13.4" r="1.9"/>'),
    health: stroke('<path d="M12 20.2C8.4 17.6 3.5 14.4 3.5 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 2.3c0 4.5-4.9 7.7-8.5 10.3Z"/>' +
      '<path d="M6.4 12.3h2.4l1.3-2.2 1.7 4 1.4-2.4h3.2"/>'),
    pharmacy: stroke('<path d="M5 20h14"/><path d="M6.5 20v-2.6a5.5 5.5 0 0 1 11 0V20"/>' +
      '<path d="M4.5 7.6h15"/><path d="M12 7.6V4.4"/><path d="m17.6 6.2 2.6-2.2"/>'),
    lungs: stroke('<path d="M12 4v8"/><path d="M12 8.6c-1.6 0-2.4-1-3.4-1s-2.3.7-3.1 2.6C4.6 12.3 4.4 15 4.6 17c.1 1.6 1 2.3 2.3 2.3 1.6 0 3-.9 3.6-2.4.4-1 .5-2 .5-3.1V8.6Z"/>' +
      '<path d="M12 8.6c1.6 0 2.4-1 3.4-1s2.3.7 3.1 2.6c.9 2.1 1.1 4.8.9 6.8-.1 1.6-1 2.3-2.3 2.3-1.6 0-3-.9-3.6-2.4-.4-1-.5-2-.5-3.1V8.6Z"/>'),

    // ---- media & place ----
    media: stroke('<rect x="2.5" y="5" width="19" height="14" rx="2.4"/><path d="M2.5 9h19"/>' +
      '<path d="M6.5 5v4"/><path d="M11 5v4"/><path d="M15.5 5v4"/>' +
      '<path d="m10.6 12.4 4.4 2.5-4.4 2.5z"/>'),
    palette: stroke('<path d="M12 3.4a8.6 8.6 0 0 0 0 17.2c1.3 0 2-.9 2-1.9 0-.6-.3-1-.6-1.4a1.9 1.9 0 0 1 1.5-3.1h1.7a4 4 0 0 0 4-4c0-3.6-3.8-6.8-8.6-6.8Z"/>' +
      '<circle cx="7.6" cy="11.4" r="1.1"/><circle cx="10.2" cy="7.4" r="1.1"/><circle cx="15" cy="8" r="1.1"/>'),
    globe: stroke('<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8"/>' +
      '<path d="M12 3.6a13 13 0 0 1 0 16.8 13 13 0 0 1 0-16.8Z"/>'),
    education: stroke('<path d="m12 4 9.2 4.2L12 12.4 2.8 8.2z"/>' +
      '<path d="M6.6 10.4v4.4c0 1.7 2.4 3.1 5.4 3.1s5.4-1.4 5.4-3.1v-4.4"/>' +
      '<path d="M20.4 8.6v5"/>'),
    megaphone: stroke('<path d="M4 10.6v2.8a1.9 1.9 0 0 0 1.9 1.9h1.4L15 19.5V4.5L7.3 8.7H5.9A1.9 1.9 0 0 0 4 10.6Z"/>' +
      '<path d="M18.2 9.2a4 4 0 0 1 0 5.6"/><path d="M7.3 15.3V19a1.4 1.4 0 0 0 2.7.4"/>'),
    university: stroke('<path d="m12 3.4 9 4.3H3z"/><path d="M4.6 20.4h14.8"/>' +
      '<path d="M6.4 17.8V9.4"/><path d="M10.1 17.8V9.4"/><path d="M13.9 17.8V9.4"/><path d="M17.6 17.8V9.4"/>'),
    flask: stroke('<path d="M9.4 3.4v5.4L4.6 17a2.4 2.4 0 0 0 2.1 3.6h10.6a2.4 2.4 0 0 0 2.1-3.6l-4.8-8.2V3.4"/>' +
      '<path d="M8.2 3.4h7.6"/><path d="M7.2 13.6h9.6"/>'),
    book: stroke('<path d="M4 4.6h5.4A2.6 2.6 0 0 1 12 7.2v12a2.2 2.2 0 0 0-2.2-2.2H4z"/>' +
      '<path d="M20 4.6h-5.4A2.6 2.6 0 0 0 12 7.2v12a2.2 2.2 0 0 1 2.2-2.2H20z"/>')
  };

  // An uploaded image is the only one of the three layers that can carry a
  // URL, so it is the only one that needs checking. Same-origin relative
  // assets are what the admin uploader produces; https is allowed so a logo
  // can point at an official source. Anything else (javascript:, data:) is
  // dropped rather than sanitized — there is no legitimate third case.
  function safeImageUrl(u){
    var s = String(u == null ? '' : u).trim();
    if(!s) return '';
    if(/^https:\/\//i.test(s)) return s;
    if(/^(assets|\.\/assets)\//i.test(s)) return s.replace(/^\.\//, '');
    return '';
  }

  function esc(s){
    return window.__escapeHtml ? window.__escapeHtml(s) : String(s == null ? '' : s);
  }

  // The one function the rest of the app calls. `entity` is any object with
  // some combination of imageUrl / iconKey / icon — a university record, a
  // plan record, a college record, all three already look like that.
  function markup(entity, opts){
    var e = entity || {};
    var o = opts || {};
    var size = o.size || 28;
    var label = o.label ? ' aria-label="' + esc(o.label) + '" role="img"' : ' aria-hidden="true"';

    var img = safeImageUrl(e.imageUrl || e.logoUrl || e.iconUrl);
    if(img){
      // object-fit keeps a non-square upload from stretching; the admin
      // preview shows exactly this, so what is uploaded is what is seen.
      return '<img class="app-icon app-icon-img" src="' + esc(img) + '" alt="' +
        esc(o.label || '') + '" loading="lazy" ' +
        'style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;">';
    }

    var key = String(e.iconKey || '').trim();
    if(key && Object.prototype.hasOwnProperty.call(ICONS, key)){
      return '<span class="app-icon app-icon-svg"' + label +
        ' style="width:' + size + 'px;height:' + size + 'px;">' + ICONS[key] + '</span>';
    }

    var emoji = e.icon || o.fallback || '🎓';
    return '<span class="app-icon app-icon-emoji"' + label +
      ' style="font-size:' + Math.round(size * 0.82) + 'px;line-height:1;">' + esc(emoji) + '</span>';
  }

  window.AAUP_ICONS = {
    markup: markup,
    keys: function(){ return Object.keys(ICONS).sort(); },
    has: function(k){ return Object.prototype.hasOwnProperty.call(ICONS, k); },
    // Used by the admin icon picker to draw the whole set as choosable tiles.
    preview: function(key, size){
      return ICONS[key] ? '<span class="app-icon app-icon-svg" aria-hidden="true" style="width:' +
        (size || 24) + 'px;height:' + (size || 24) + 'px;">' + ICONS[key] + '</span>' : '';
    },
    safeImageUrl: safeImageUrl
  };
})();
