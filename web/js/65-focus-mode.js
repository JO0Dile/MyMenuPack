// ==========================
// FOCUS MODE — "show only what I can take."
//
// A second toggle beside "Collapse finished years", same shape and place.
// On, it dims every course that is neither done nor open right now —
// locked courses fade back, done ones keep their normal passed styling
// (they are not "in the way", they are already behind you), and whatever
// is actually open to you this semester stays at full brightness. The
// prerequisite lines are left alone on purpose: they are what explains WHY
// a dimmed course is dimmed, so turning them off too would remove the one
// thing that makes the dimming legible rather than arbitrary.
// ==========================
(function(){
  'use strict';

  var STATE_KEY = 'aaup_focusMode';

  function isOn(){
    try{ return localStorage.getItem(STATE_KEY) === '1'; }catch(e){ return false; }
  }
  function setOn(v){
    try{ localStorage.setItem(STATE_KEY, v ? '1' : '0'); }catch(e){}
  }

  function ensureToggle(prefix, root, rtl){
    var toggle = root.querySelector(':scope .focus-toggle');
    if(!toggle){
      // Sits right after the collapse toggle when one exists (same family,
      // same row) — otherwise takes the same anchor point collapse itself
      // uses, so it still shows up on a plan with nothing finished yet.
      var collapse = root.querySelector(':scope .collapse-toggle');
      var anchor = collapse || root.querySelector('.course-search-wrap');
      if(!anchor) return null;
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'collapse-toggle focus-toggle';
      if(collapse){ collapse.parentNode.insertBefore(toggle, collapse.nextSibling); }
      else { anchor.parentNode.insertBefore(toggle, anchor); }
      toggle.addEventListener('click', function(){
        setOn(!isOn());
        refresh(prefix);
      });
    }
    var on = isOn();
    toggle.classList.add('available');   // always offered, unlike collapse
    toggle.setAttribute('aria-pressed', String(on));
    toggle.innerHTML =
      '<span>🎯 ' + (rtl ? 'أظهر ما يمكنني أخذه فقط' : 'Show only what I can take') + '</span>' +
      '<span class="ct-state">' + (on ? (rtl ? 'مفعّل' : 'ON') : (rtl ? 'معطّل' : 'OFF')) + '</span>';
    return toggle;
  }

  function refresh(prefix){
    var root = document.getElementById('page-' + prefix);
    if(!root) return;
    var rtl = root.classList.contains('rtl-mode');
    ensureToggle(prefix, root, rtl);
    root.classList.toggle('plan-focus', isOn());
  }

  window.__refreshFocusMode = refresh;
})();
