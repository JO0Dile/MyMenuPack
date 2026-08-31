// ==========================
// SHARED UI UTILITIES & STORAGE
// ==========================
// getJSON/setJSON replace what used to be ~9 separate, near-identical
// try{JSON.parse(localStorage.getItem(key)||'{}')||{}}catch(e){...} copies
// scattered across the Achievements/Imported-Plans/Community-Data/Plan-
// Editor/etc. modules below — same behavior (see the equivalence check run
// before this consolidation), one definition.
(function(){
  // The old body was `JSON.parse(raw) || fallback`, which only rejected values
  // that happened to be falsy. Anything else parsed was handed straight back —
  // so a key holding `[true,null,0]`, `"text"`, `12345` or `true` was returned
  // where every single caller expects an object map. Downstream that became
  // `Object.keys(arr)` -> ["0","1","2"] and then `plans["1"].university` on a
  // null, an uncaught TypeError that took the home screen's plan list with it.
  // localStorage is user-writable, an import writes it, and a half-finished
  // write can truncate it, so the shape has to be checked here rather than at
  // each of the ~9 call sites.
  function getJSON(key, fallback){
    try{
      var raw = localStorage.getItem(key);
      if(raw == null) return fallback;
      var parsed = JSON.parse(raw);
      if(parsed === null || parsed === undefined) return fallback;
      if(Array.isArray(parsed) !== Array.isArray(fallback)) return fallback;
      if(typeof parsed !== typeof fallback) return fallback;
      return parsed;
    }
    catch(e){ return fallback; }
  }
  function setJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }
    catch(e){ return false; }
    // Every create/edit of a user-built plan (a new college, a new plan, an
    // added course, a moved course) writes aaup_importedPlans through here —
    // one chokepoint — so this is the one place auto-collection needs to
    // notice a change. Guarded + debounced inside AAUP_COLLECT; a no-op when
    // APP_COLLECT_URL isn't configured, so it costs nothing until turned on.
    if(key === 'aaup_importedPlans' && typeof window.__collectOnPlansChanged === 'function'){
      try{ window.__collectOnPlansChanged(value); }catch(e){}
    }
    return true;
  }
  window.AAUP_STORAGE = { getJSON: getJSON, setJSON: setJSON };

  var hideTimer = null;
  function showToast(msg){
    var el = document.getElementById('globalToast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if(hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function(){ el.classList.remove('show'); }, 3200);
  }

  // "Say it out loud" — the toast half of the same moment the screen-reader
  // announcer already speaks (see announceToggle in js/28-imported.js and
  // js/11-module11.js's built-in-plan equivalent). A tick can silently
  // unlock three more courses with nothing on screen changing anywhere near
  // where the student is looking; this puts the news where the eye already
  // is, for the three seconds it takes to read it, then gets out of the way.
  var unlockHideTimer = null;
  function showUnlockToast(title, subtitle){
    var el = document.getElementById('globalUnlockToast');
    var titleEl = document.getElementById('globalUnlockToastTitle');
    var subEl = document.getElementById('globalUnlockToastSub');
    if(!el || !titleEl) return;
    titleEl.textContent = title;
    if(subEl){ subEl.textContent = subtitle || ''; subEl.hidden = !subtitle; }
    el.classList.add('show');
    if(unlockHideTimer) clearTimeout(unlockHideTimer);
    unlockHideTimer = setTimeout(function(){ el.classList.remove('show'); }, 3000);
  }

  // A toast that carries one tappable action (used for "Moved — Undo").
  // Stays up a little longer than the plain toast to give a real chance to
  // hit the button, and is dismissed either by tapping the action or when
  // it times out. onAction runs at most once.
  var actionHideTimer = null;
  function showActionToast(msg, actionLabel, onAction){
    var el = document.getElementById('globalActionToast');
    var textEl = document.getElementById('globalActionToastText');
    var btn = document.getElementById('globalActionToastBtn');
    if(!el || !textEl || !btn){ showToast(msg); return; }
    textEl.textContent = msg;
    btn.textContent = actionLabel;
    el.style.display = 'flex';
    // force reflow so the .show transition runs even if the element was
    // just flipped from display:none
    void el.offsetWidth;
    el.classList.add('show');
    if(actionHideTimer) clearTimeout(actionHideTimer);
    var done = false;
    function dismiss(){
      el.classList.remove('show');
      setTimeout(function(){ if(!el.classList.contains('show')) el.style.display = 'none'; }, 300);
    }
    var newBtn = btn.cloneNode(true); // drop any handler from a previous toast
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', function(){
      if(done) return;
      done = true;
      if(actionHideTimer) clearTimeout(actionHideTimer);
      dismiss();
      try{ onAction(); }catch(e){}
    });
    actionHideTimer = setTimeout(dismiss, 6000);
  }
  window.__showActionToast = showActionToast;
  // Ten modules ask this question — the assistant, the Fix panel, the export
  // dialog, achievements, the back bar, the developer panel — and it used to
  // answer it by looking for a visible `.plan-page` carrying rtl-mode. That
  // was wrong twice over. An imported plan renders as `.sheet.sheet-plan`,
  // not `.plan-page`, so it was never seen at all; and with no plan on screen
  // at all — the picker, Settings, the assistant opened from the tab bar —
  // there was nothing to look at and the answer was always English, however
  // the language switch was set.
  //
  // The switch is the answer. The DOM is checked first only so that a plan
  // page still mid-render reports what it is actually showing.
  function anyVisiblePageIsRtl(){
    var pages = document.querySelectorAll('.plan-page, .sheet-plan');
    for(var i = 0; i < pages.length; i++){
      if(pages[i].style.display !== 'none' && pages[i].classList.contains('rtl-mode')) return true;
    }
    return !!(window.AAUP_LANG && window.AAUP_LANG.isAr());
  }
  window.__showToast = showToast;
  window.__showUnlockToast = showUnlockToast;
  window.__anyVisiblePageIsRtl = anyVisiblePageIsRtl;

  // A stable per-device id, with no account behind it — first used by
  // Student Thoughts (so a student can delete their own post) and now
  // shared with Contributions (so a student can check back for a reply).
  // Same key, same device, one identity across every feature that needs
  // "this browser" without needing "this person".
  function deviceId(){
    var k = 'aaup_deviceId';
    try{
      var v = localStorage.getItem(k);
      if(!v){
        v = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(k, v);
      }
      return v;
    }catch(e){ return 'd-anon'; }
  }
  window.__deviceId = deviceId;

  // ---------------------------------------------------------------------
  // On a phone a dialog is presented as a page (see the max-width:720px block
  // in css/app.css), so the phone's own Back gesture has to close it. Without
  // this, Back leaves the app entirely from what looks like a normal screen —
  // the single most jarring thing a "page" can do.
  //
  // Done here, once, by watching the shared .open class rather than by editing
  // each dialog's open()/close(): there are a dozen of them across as many
  // modules, and any new one should get this for free.
  var pushedForModal = 0;      // history entries this owns, so it never eats
                               // a Back press that belongs to the app itself.
  function openModalCount(){
    return document.querySelectorAll('.modal-overlay.open').length;
  }
  function isPhone(){
    return window.matchMedia && window.matchMedia('(max-width:720px)').matches;
  }

  var lastCount = 0;
  function syncHistory(){
    var now = openModalCount();
    if(now > lastCount && isPhone()){
      // A dialog just opened as a page: give Back something to land on.
      try{ history.pushState({ __aaupModal: true }, ''); pushedForModal++; }catch(e){}
    } else if(now < lastCount && pushedForModal > 0){
      // Closed by its own back arrow / Escape / backdrop rather than by Back.
      // Drop the entry we added so the next Back press is not swallowed.
      pushedForModal--;
      try{ history.back(); }catch(e){}
    }
    lastCount = now;
  }

  window.addEventListener('popstate', function(){
    if(pushedForModal <= 0) return;   // not ours — let the app navigate
    var open = document.querySelectorAll('.modal-overlay.open');
    if(!open.length){ pushedForModal = 0; lastCount = 0; return; }
    pushedForModal--;
    // Close the topmost one via its own control so each module's own cleanup
    // runs, falling back to the class when a dialog has no close button.
    var top = open[open.length - 1];
    var btn = top.querySelector('.modal-close, [id$="Close"]');
    if(btn){ btn.click(); } else { top.classList.remove('open'); }
    lastCount = openModalCount();
  });

  function watchModals(){
    lastCount = openModalCount();
    var obs = new MutationObserver(syncHistory);
    document.querySelectorAll('.modal-overlay').forEach(function(el){
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Dialogs created after load (the Plan Overview builds its overlay on
    // demand) are picked up by watching the body for new overlays.
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.prototype.forEach.call(m.addedNodes, function(n){
          if(n.nodeType === 1 && n.classList && n.classList.contains('modal-overlay')){
            obs.observe(n, { attributes: true, attributeFilter: ['class'] });
          }
        });
      });
    }).observe(document.body, { childList: true });
  }
  if(document.readyState === 'complete'){ watchModals(); }
  else { window.addEventListener('load', watchModals); }
})();
