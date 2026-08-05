// ==========================
// ASSISTANT UI + GUIDED MODE
// ==========================
// The chat window, and the walkthrough mode it can hand off to.
//
// Guided Mode exists because "Settings is in the menu, bottom left" is a
// worse answer than pointing at it. When a student asks "how do I…" or
// "where is…", the assistant dims the page, lights up the one real control
// they need, and waits for them to actually use it before moving on — one
// step at a time, never two things highlighted at once.
//
// It is deliberately separate from the onboarding tours in js/32-tutorial.js.
// Those are fixed, once-per-device introductions with their own seen/unseen
// bookkeeping; this is on demand, driven by a question, and repeatable.
// Sharing one engine would mean one of the two behaving oddly to suit the
// other.
(function () {
  var KB = window.AAUP_ASSISTANT_KB;
  var ENGINE = window.AAUP_ASSISTANT;

  function el(id) { return document.getElementById(id); }
  function lang() { return (window.__anyVisiblePageIsRtl && window.__anyVisiblePageIsRtl()) ? 'ar' : 'en'; }

  // ---------------------------------------------------------------
  // CHAT WINDOW
  // ---------------------------------------------------------------
  var lastLang = 'en';

  function scrollDown() {
    var log = el('asstLog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  // Everything rendered here goes through textContent, never innerHTML.
  // The student's own words come back on screen, and a plan's course names
  // can have arrived from another student's device via the plans feed.
  function addBubble(who, node) {
    var log = el('asstLog');
    if (!log) return null;
    var row = document.createElement('div');
    row.className = 'asst-msg asst-' + who;
    row.appendChild(node);
    log.appendChild(row);
    scrollDown();
    return row;
  }

  function addUser(text) {
    var b = document.createElement('div');
    b.className = 'asst-bubble';
    b.textContent = text;
    addBubble('user', b);
  }

  function addPlain(text, dir) {
    var b = document.createElement('div');
    b.className = 'asst-bubble';
    b.textContent = text;
    if (dir) b.setAttribute('dir', dir);
    addBubble('bot', b);
  }

  function addReply(r, replyLang) {
    var dir = replyLang === 'ar' ? 'rtl' : 'ltr';
    var b = document.createElement('div');
    b.className = 'asst-bubble';
    b.setAttribute('dir', dir);

    if (r.title) {
      var h = document.createElement('div');
      h.className = 'asst-title';
      h.textContent = r.title;
      b.appendChild(h);
    }
    (r.lines || []).forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      b.appendChild(p);
    });

    // An editing proposal: the change is described above, and nothing at all
    // happens until this button is pressed.
    if (r.confirm) {
      if (r.confirm.warn) {
        var warn = document.createElement('p');
        warn.className = 'asst-warn';
        warn.textContent = '⚠️ ' + r.confirm.warn;
        b.appendChild(warn);
      }
      var actions = document.createElement('div');
      actions.className = 'asst-actions';
      var go = document.createElement('button');
      go.type = 'button';
      // asst-act-confirm distinguishes "change my data" from the "Show me"
      // button, which shares the same primary styling.
      go.className = 'asst-act asst-act-primary asst-act-confirm';
      go.textContent = r.confirm.label;
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'asst-act';
      cancel.textContent = replyLang === 'ar' ? 'إلغاء' : 'Cancel';
      go.addEventListener('click', function () {
        go.disabled = true; cancel.disabled = true;
        var result;
        try { result = r.confirm.run(); }
        catch (e) { result = replyLang === 'ar' ? 'تعذّر تنفيذ التغيير.' : 'That change could not be applied.'; }
        addPlain(result, dir);
      });
      cancel.addEventListener('click', function () {
        go.disabled = true; cancel.disabled = true;
        addPlain(replyLang === 'ar' ? 'تمام، لم أغيّر شيئًا.' : 'Okay — nothing was changed.', dir);
      });
      actions.appendChild(go);
      actions.appendChild(cancel);
      b.appendChild(actions);
    }

    // A walkthrough is available for this answer.
    if (r.guide && KB.guides[r.guide]) {
      var ga = document.createElement('div');
      ga.className = 'asst-actions';
      var show = document.createElement('button');
      show.type = 'button';
      show.className = 'asst-act asst-act-primary';
      show.textContent = '👉 ' + (KB.say.guideOffer[replyLang] || KB.say.guideOffer.en);
      show.addEventListener('click', function () { startGuide(r.guide, replyLang); });
      ga.appendChild(show);
      b.appendChild(ga);
    }

    addBubble('bot', b);

    if (r.chips && r.chips.length) { addChips(r.chips); }
    // Auto-started walkthroughs stay quiet when nothing they point at is on
    // screen: the written answer is already above, and following it with
    // "I can't show you that right now" reads as a failure when the student
    // never asked to be shown in the first place. The "Show me" button is
    // still there if they want to try.
    if (r.autoGuide && r.guide && KB.guides[r.guide]) { startGuide(r.guide, replyLang, true); }
  }

  function addChips(list) {
    var log = el('asstLog');
    if (!log) return;
    var wrap = document.createElement('div');
    wrap.className = 'asst-chips';
    list.forEach(function (text) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'asst-chip';
      c.textContent = text;
      c.addEventListener('click', function () { send(text); });
      wrap.appendChild(c);
    });
    log.appendChild(wrap);
    scrollDown();
  }

  function send(text) {
    var t = String(text || '').trim();
    if (!t) return;
    addUser(t);
    var replyLang = ENGINE.langFor(t);
    lastLang = replyLang;
    var r;
    try {
      r = ENGINE.ask(t);
    } catch (e) {
      // A thrown assistant is still an assistant that must answer.
      if (window.console && console.error) { console.error('Assistant failed to answer:', e); }
      r = { lines: [replyLang === 'ar'
        ? 'حدث خطأ عندي أثناء الإجابة. جرّب صياغة أخرى.'
        : 'Something went wrong on my side. Try asking a different way.'] };
    }
    addReply(r, replyLang);
  }

  function open() {
    var panel = el('asstPanel');
    if (!panel) return;
    panel.classList.add('open');
    var launcher = el('asstLauncher');
    if (launcher) launcher.setAttribute('aria-expanded', 'true');
    var log = el('asstLog');
    if (log && !log.childNodes.length) {
      var l = lang();
      lastLang = l;
      addPlain(ENGINE.greeting(l), l === 'ar' ? 'rtl' : 'ltr');
      addChips(ENGINE.suggestions(l));
    }
    var input = el('asstInput');
    if (input) setTimeout(function () { input.focus(); }, 80);
  }

  function close() {
    var panel = el('asstPanel');
    if (panel) panel.classList.remove('open');
    var launcher = el('asstLauncher');
    if (launcher) launcher.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    var panel = el('asstPanel');
    if (panel && panel.classList.contains('open')) close(); else open();
  }

  // ---------------------------------------------------------------
  // GUIDED MODE
  // ---------------------------------------------------------------
  var active = null; // { steps, index, lang, reopen }

  function resolveTarget(step) {
    try {
      var t = step.target;
      var found = (typeof t === 'function') ? t() : document.querySelector(t);
      return (found && found.offsetParent !== null) ? found : null;
    } catch (e) { return null; }
  }

  function place() {
    if (!active) return;
    var step = active.steps[active.index];
    var target = step && resolveTarget(step);
    if (!target) { skipStep(); return; }

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Two frames: one for the scroll to be applied, one for layout to settle
    // before the spotlight is measured against it.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!active) return;
        var r = target.getBoundingClientRect();
        var pad = 8;
        var spot = el('guideSpot');
        var tip = el('guideTip');
        if (!spot || !tip) return;

        spot.style.top = Math.max(0, r.top - pad) + 'px';
        spot.style.left = Math.max(0, r.left - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';

        el('guideText').textContent = step.text[active.lang] || step.text.en;
        el('guideStep').textContent = (active.index + 1) + ' / ' + active.steps.length;

        // A step that is waiting on a real interaction offers "Skip" instead
        // of "Next": the student is supposed to do the thing, and the
        // walkthrough advances by itself the moment they do.
        var waiting = !!step.waitFor;
        var next = el('guideNext');
        next.textContent = waiting
          ? (active.lang === 'ar' ? 'تخطَّ' : 'Skip')
          : (active.index === active.steps.length - 1
              ? (active.lang === 'ar' ? 'تم' : 'Got it')
              : (active.lang === 'ar' ? 'التالي' : 'Next'));

        var tipW = Math.min(320, window.innerWidth - 24);
        tip.style.width = tipW + 'px';
        var left = r.left + r.width / 2 - tipW / 2;
        tip.style.left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12)) + 'px';
        var below = window.innerHeight - r.bottom;
        if (below > 170 || r.top < 170) {
          tip.style.top = (r.bottom + pad + 12) + 'px';
        } else {
          tip.style.top = Math.max(12, r.top - pad - 12 - tip.offsetHeight) + 'px';
        }
      });
    });
  }

  // Polling rather than a MutationObserver: a step completes for all sorts of
  // reasons (a class flips, a panel opens, a page swaps, a value is typed),
  // and 250ms of latency on "did they do it yet" is imperceptible while
  // being immune to whichever of those the step actually used.
  var watchTimer = null;
  function watch() {
    stopWatching();
    var step = active && active.steps[active.index];
    if (!step || !step.waitFor) return;
    watchTimer = setInterval(function () {
      if (!active) { stopWatching(); return; }
      var done = false;
      try { done = !!step.waitFor(); } catch (e) { done = false; }
      if (done) { stopWatching(); advance(); }
    }, 250);
  }
  function stopWatching() {
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
  }

  function advance() {
    if (!active) return;
    stopWatching();
    active.index++;
    if (active.index >= active.steps.length) { finish(true); return; }
    place();
    watch();
  }

  // A step whose target is not on screen is dropped rather than stalling the
  // walkthrough — the student may already be past it, or on a screen where
  // that control does not exist.
  function skipStep() {
    if (!active) return;
    stopWatching();
    var wasIndex = active.index;
    active.index++;
    if (active.index >= active.steps.length) {
      // Nothing in the whole walkthrough could be pointed at.
      var noneShown = wasIndex === 0;
      finish(!noneShown);
      if (noneShown) { addPlain(KB.say.guideUnavailable[lastLang] || KB.say.guideUnavailable.en); }
      return;
    }
    place();
    watch();
  }

  function finish(reopenChat) {
    if (!active) return;
    var l = active.lang;
    var reopen = active.reopen && reopenChat !== false;
    stopWatching();
    active = null;
    var layer = el('guideLayer');
    if (layer) layer.classList.remove('open');
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    if (reopen) {
      open();
      addPlain(l === 'ar' ? 'انتهت الجولة. هل من شيء آخر؟' : 'That’s it. Anything else?', l === 'ar' ? 'rtl' : 'ltr');
    }
  }

  function startGuide(id, guideLang, silentIfUnavailable) {
    var guide = KB.guides[id];
    if (!guide) return;
    var l = guideLang || lastLang || 'en';

    // Steps whose target is missing right now are dropped up front, so the
    // step counter shown to the student ("2 / 3") matches what they will
    // actually be walked through.
    var steps = guide.steps.filter(function (s) {
      return s.optional ? !!resolveTarget(s) : true;
    });
    var anyVisible = steps.some(function (s) { return !!resolveTarget(s); });
    if (!anyVisible) {
      if (!silentIfUnavailable) {
        addPlain(KB.say.guideUnavailable[l] || KB.say.guideUnavailable.en, l === 'ar' ? 'rtl' : 'ltr');
      }
      return;
    }

    var wasOpen = !!(el('asstPanel') && el('asstPanel').classList.contains('open'));
    close(); // the chat window would cover the very thing being pointed at

    active = { steps: steps, index: 0, lang: l, reopen: wasOpen };
    var layer = el('guideLayer');
    if (layer) layer.classList.add('open');
    var title = el('guideTitle');
    if (title) title.textContent = guide.title[l] || guide.title.en;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    place();
    watch();
  }

  // ---------------------------------------------------------------
  // BINDING
  // ---------------------------------------------------------------
  function bind() {
    var launcher = el('asstLauncher');
    if (launcher) launcher.addEventListener('click', toggle);
    var closeBtn = el('asstClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    var form = el('asstForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = el('asstInput');
        if (!input) return;
        var text = input.value;
        input.value = '';
        send(text);
      });
    }

    var next = el('guideNext');
    if (next) next.addEventListener('click', advance);
    var end = el('guideEnd');
    if (end) end.addEventListener('click', function () { finish(true); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (active) { finish(true); return; }
      var panel = el('asstPanel');
      if (panel && panel.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'complete') { bind(); }
  else { window.addEventListener('load', bind); }

  window.AAUP_ASSISTANT_UI = {
    open: open, close: close, toggle: toggle,
    send: send, startGuide: startGuide,
    isGuiding: function () { return !!active; }
  };
})();
