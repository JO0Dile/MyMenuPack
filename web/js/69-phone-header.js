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

  // ---------------------------------------------------------------------
  // YEAR TABS — Y1..Y5 pills right under the sticky bar, always visible
  // (not gated behind the chevron like the rest of the collapsed chrome):
  // their whole point is reaching a later year WITHOUT first having to open
  // the full header and then scroll past everything in between.
  function yearBlocks(root){ return root.querySelectorAll(':scope .years > .imp-year-block'); }

  function ensureYearTabs(root, rtl){
    var wrap = root.querySelector(':scope > .imp-phone-years');
    var blocks = yearBlocks(root);
    if(blocks.length < 2){ if(wrap) wrap.remove(); return; }   // one year: nothing to jump between
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'imp-phone-years';
      var bar = root.querySelector(':scope > .imp-phone-bar');
      root.insertBefore(wrap, bar ? bar.nextSibling : root.firstChild);
    }
    wrap.innerHTML = Array.prototype.map.call(blocks, function(b, i){
      return '<button type="button" class="imp-phone-year-tab" data-imp-year="' + i + '">' +
        (rtl ? ('س' + (i + 1)) : ('Y' + (i + 1))) + '</button>';
    }).join('');
    wrap.querySelectorAll('[data-imp-year]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(btn.getAttribute('data-imp-year'), 10);
        var target = yearBlocks(root)[idx];
        if(target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ---------------------------------------------------------------------
  // JUMP TO CURRENT SEMESTER — a small, unlabelled ⌄ pinned bottom-left.
  // "Current" is the first year that is not yet entirely completed: the
  // same definition js/05-collapse-finished-years.js already uses to decide
  // what to fold away, so this button and that toggle never disagree about
  // where "current" is.
  function yearIsFinished(yearEl){
    var courses = yearEl.querySelectorAll('.course[id]:not(.course-removed)');
    if(!courses.length) return false;
    return Array.prototype.every.call(courses, function(c){ return c.classList.contains('completed'); });
  }
  function ensureJumpBtn(root, rtl){
    var blocks = yearBlocks(root);
    var target = Array.prototype.filter.call(blocks, function(b){ return !yearIsFinished(b); })[0];
    var btn = document.getElementById('impPhoneJump');
    if(!target){ if(btn) btn.remove(); return; }
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'impPhoneJump';
      btn.className = 'imp-phone-jump';
      btn.setAttribute('aria-label', rtl ? 'الانتقال إلى الفصل الحالي' : 'Jump to current semester');
      btn.textContent = '⌄';
      // Appended INSIDE root, not document.body: position:fixed still
      // renders relative to the viewport either way, but a child of root
      // automatically disappears when root itself is hidden by the app's
      // own page-switching (display:none on an ancestor hides fixed
      // descendants too) — no separate show/hide bookkeeping needed for
      // "only while the study plan page is actually the one on screen."
      root.appendChild(btn);
    }
    btn.onclick = function(){
      var live = Array.prototype.filter.call(yearBlocks(root), function(b){ return !yearIsFinished(b); })[0];
      if(live) live.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  // ---------------------------------------------------------------------
  // ICON-ONLY CHIPS — Legend and Focus Mode collapse to two small icon
  // buttons once the header is expanded, instead of their own full-width
  // rows. Deliberately proxies real clicks at the real controls (still in
  // the DOM, just visually hidden by CSS below) rather than reimplementing
  // either one — a chip can never drift out of sync with what it stands in
  // for. Collapse-finished-years is left as its own normal row: it has no
  // icon of its own worth shrinking to and is reached far less often than
  // these two.
  function ensureChips(root, rtl){
    var legendBtn = root.querySelector(':scope > .legend > .legend-toggle');
    var focusBtn = root.querySelector(':scope > .collapse-toggle.focus-toggle');
    if(!legendBtn && !focusBtn) return;
    var chips = root.querySelector(':scope > .imp-phone-chips');
    if(!chips){
      chips = document.createElement('div');
      chips.className = 'imp-phone-chips';
      var years = root.querySelector(':scope > .imp-phone-years');
      var bar = root.querySelector(':scope > .imp-phone-bar');
      root.insertBefore(chips, years ? years.nextSibling : (bar ? bar.nextSibling : root.firstChild));
    }
    var legendOn = !!(root.querySelector(':scope > .legend') && root.querySelector(':scope > .legend').classList.contains('expanded'));
    var focusOn = !!(focusBtn && focusBtn.getAttribute('aria-pressed') === 'true');
    chips.innerHTML =
      (legendBtn ? '<button type="button" class="imp-phone-chip' + (legendOn ? ' active' : '') + '" data-iph-chip="legend">📖 ' + (rtl ? 'الدليل' : 'Legend') + '</button>' : '') +
      (focusBtn ? '<button type="button" class="imp-phone-chip' + (focusOn ? ' active' : '') + '" data-iph-chip="focus">🎯 ' + (rtl ? 'المتاح فقط' : 'Available only') + '</button>' : '');
    var lb = chips.querySelector('[data-iph-chip="legend"]');
    if(lb) lb.addEventListener('click', function(){ legendBtn.click(); });
    var fb = chips.querySelector('[data-iph-chip="focus"]');
    if(fb) fb.addEventListener('click', function(){ focusBtn.click(); });
  }

  // ---------------------------------------------------------------------
  // AUTO-HIDE ON SCROLL — the sticky bar (and the year tabs/chips riding
  // under it) tuck away scrolling down through a long course list, and
  // reappear the moment the student scrolls back up, same as the address
  // bar behavior every mobile browser already trained them on. One
  // listener per plan root, guarded so re-render doesn't stack duplicates.
  // One listener for the app's whole lifetime, not one per plan render —
  // js/28-imported.js's render() replaces the plan root wholesale on things
  // as ordinary as toggling the legend, which would leave a per-root
  // listener holding a detached, stale element forever after the very first
  // re-render. Looking the current root up fresh on every tick sidesteps
  // that entirely: there is only ever one .sheet-plan open at a time.
  var scrollWatchStarted = false;
  function watchScroll(){
    if(scrollWatchStarted) return;
    scrollWatchStarted = true;
    var lastY = window.scrollY, ticking = false;
    window.addEventListener('scroll', function(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        ticking = false;
        var y = window.scrollY;
        var root = document.querySelector('.sheet-plan');
        if(root && root.offsetParent !== null){
          var goingDown = y > lastY + 4;
          var goingUp = y < lastY - 4;
          if(goingDown && y > 80){ root.classList.add('imp-phone-hide'); }
          else if(goingUp || y <= 80){ root.classList.remove('imp-phone-hide'); }
        }
        lastY = y;
      });
    }, { passive: true });
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
    ensureYearTabs(root, rtl);
    ensureJumpBtn(root, rtl);
    ensureChips(root, rtl);
    watchScroll();
  }

  window.__refreshPhoneHeader = refresh;
})();
