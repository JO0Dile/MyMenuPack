// ==========================
// EMPTY STATES — the screen with no data still has one job
//
// An empty screen is the first thing a new student sees on half of this app,
// and several of them said only that there was no data: "No grades yet.",
// "Nothing new is unlocked yet." Both true, both useless — they describe the
// state and leave the reader to work out, on their own, which of the app's
// forty controls would change it.
//
// So every empty state built through here has three parts and no more:
//
//   TITLE   what is missing, in the reader's words, not the schema's
//   BODY    what appears here once it is not missing — the reason to bother
//   ACTION  the ONE control that fills it, as a button, right there
//
// The action is the part that matters and the part that was always absent.
// One button, never two: an empty screen offering a choice has not answered
// the question the reader actually has.
//
// This is markup only — the caller owns the click, because the caller is the
// one that knows what "open my plan" means from where it is standing.
// ==========================
(function(){
  'use strict';

  function esc(s){ return window.__escapeHtml ? window.__escapeHtml(String(s == null ? '' : s)) : String(s); }
  function ic(k, n){ return (window.AAUP_ICONS && k) ? window.AAUP_ICONS.preview(k, n || 26) : ''; }

  // opts: { rtl, icon, title, body, action, onclick }
  // `onclick` is an inline handler string, matching how the dashboard and the
  // sidebar already wire their buttons — those screens rebuild their markup
  // wholesale, so a bound listener would be thrown away on the next render.
  // Omit `action` for an empty state with genuinely nothing to offer (the
  // rare honest case: a plan whose course list the catalogue does not have).
  function card(opts){
    var o = opts || {};
    return '<div class="empty-card">' +
      (o.icon ? '<span class="empty-ic">' + ic(o.icon) + '</span>' : '') +
      '<span class="empty-title">' + esc(o.title) + '</span>' +
      (o.body ? '<span class="empty-body">' + esc(o.body) + '</span>' : '') +
      (o.action
        ? '<button type="button" class="empty-btn"' +
          (o.onclick ? ' onclick="' + o.onclick + '"' : '') + '>' + esc(o.action) + '</button>'
        : '') +
    '</div>';
  }

  // The same three parts at one line, for a panel that cannot spare the
  // vertical space a card takes — inside an already-crowded modal, say.
  function line(opts){
    var o = opts || {};
    return '<p class="empty-line">' + esc(o.title) +
      (o.action
        ? ' <button type="button" class="empty-link"' +
          (o.onclick ? ' onclick="' + o.onclick + '"' : '') + '>' + esc(o.action) + '</button>'
        : '') +
    '</p>';
  }

  window.AAUP_EMPTY = { card: card, line: line };
})();
