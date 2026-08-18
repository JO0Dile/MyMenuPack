// ==========================
// PHONE STUDY-PLAN HEADER — collapse everything above the courses.
//
// On a phone, a plan opened to a screen and a half of chrome before the
// first course card: the university brand block, the full title, five
// buttons, the legend, two toggles, the search box, the description
// paragraph, and the progress bar — all before anything the student
// actually came to look at. Desktop keeps every bit of that; there is
// room for it. A phone does not, so all of it folds behind one sticky
// bar showing just the plan name and progress, with a control that
// reveals the rest on demand.
//
// Deliberately NOT a rewrite of that header: every piece (Legend, the two
// toggles, search, the buttons) stays exactly where js/28-imported.js,
// js/05-collapse-finished-years.js and js/65-focus-mode.js already put it
// and already wires it up. This only adds one class to the plan root and
// one small bar above it; a CSS rule (max-width:720px, scoped under that
// class) is what actually hides the rest. Nothing about how any of those
// controls work had to change.
// ==========================
(function(){
  'use strict';

  var OPEN_KEY = 'aaup_phoneHeaderOpen';

  function isOn(){
    try{ return sessionStorage.getItem(OPEN_KEY) === '1'; }catch(e){ return false; }
  }
  function setOn(v){
    try{ sessionStorage.setItem(OPEN_KEY, v ? '1' : '0'); }catch(e){}
  }

  function planTitle(root, rtl){
    // Both blocks are always in the DOM — only CSS decides which one the
    // full header actually shows (.rtl-mode swaps .title-block out for
    // .ar-block). The compact bar has to make the same choice explicitly,
    // or it shows the English name underneath an Arabic-language page.
    if(rtl){
      var ar = root.querySelector('.ar-block .ar1');
      var arText = ar ? ar.textContent.trim() : '';
      if(arText) return arText;
      // Some imported plans never got an Arabic name — the full header
      // shows blank there too, but an empty sticky bar reads as broken
      // rather than "not translated", so fall through to English.
    }
    var en = root.querySelector('.title-block .en');
    if(en){
      // Just the big line — "AI and Innovation", not the "B.Sc. · 129 CH ·
      // Program 29112" meta that follows it inline in the full header. The
      // whole point of the compact bar is that it fits on one line.
      var clone = en.cloneNode(true);
      var em = clone.querySelector('em');
      if(em) em.remove();
      return clone.textContent.trim();
    }
    return '';
  }

  function progressText(root){
    var span = root.querySelector('.progress-widget > span');
    if(!span) return '';
    // "54 / 129H completed (42%)" -> "42%" — the bar itself carries the
    // rest once the panel is open; the compact bar only needs the headline.
    var m = /\((\d+%|\d+٪)\)/.exec(span.textContent);
    return m ? m[1] : '';
  }

  function ensureBar(root, rtl){
    var bar = root.querySelector(':scope > .imp-phone-bar');
    if(bar) return bar;
    bar = document.createElement('div');
    bar.className = 'imp-phone-bar';
    bar.innerHTML =
      '<button type="button" class="imp-phone-bar-btn" data-imp-phone-toggle>' +
        '<span class="imp-phone-bar-title"></span>' +
        '<span class="imp-phone-bar-pct"></span>' +
        '<span class="imp-phone-bar-chevron">⌄</span>' +
      '</button>';
    root.insertBefore(bar, root.firstChild);
    bar.querySelector('[data-imp-phone-toggle]').addEventListener('click', function(){
      setOn(!isOn());
      applyState(root);
    });
    return bar;
  }

  function applyState(root){
    var open = isOn();
    root.classList.toggle('imp-phone-open', open);
    var chevron = root.querySelector('.imp-phone-bar-chevron');
    if(chevron) chevron.textContent = open ? '⌃' : '⌄';
    var btn = root.querySelector('[data-imp-phone-toggle]');
    if(btn) btn.setAttribute('aria-expanded', String(open));
  }

  function refresh(prefix){
    var root = document.getElementById('page-' + prefix);
    if(!root || !root.classList.contains('sheet-plan')) return;   // built-in legacy pages don't get this
    var rtl = root.classList.contains('rtl-mode');
    var bar = ensureBar(root, rtl);
    var title = bar.querySelector('.imp-phone-bar-title');
    if(title) title.textContent = planTitle(root, rtl);
    var pct = bar.querySelector('.imp-phone-bar-pct');
    if(pct) pct.textContent = progressText(root);
    applyState(root);
  }

  window.__refreshPhoneHeader = refresh;
})();
