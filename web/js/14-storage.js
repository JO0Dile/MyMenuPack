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
  function anyVisiblePageIsRtl(){
    var pages = document.querySelectorAll('.plan-page');
    for(var i = 0; i < pages.length; i++){
      if(pages[i].style.display !== 'none' && pages[i].classList.contains('rtl-mode')) return true;
    }
    return false;
  }
  window.__showToast = showToast;
  window.__anyVisiblePageIsRtl = anyVisiblePageIsRtl;
})();
