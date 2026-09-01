// ==========================
// ENGLISH LEVEL — the one question the plan cannot answer for you.
//
// Every AAUP plan lists Beginning, Intermediate and Advanced English as
// university requirements, one after another. No student takes all three:
// a placement test decides where you start, and the levels below it are
// never taken at all. Which means the plan, as published, is wrong about
// this student's degree until they say where they were placed — and it is
// the one fact in the whole plan that is about them rather than about the
// programme.
//
// It used to be asked as an unskippable modal the moment a plan opened —
// the first thing a stranger saw, before they had seen a single course, with
// no way past it. That is a gate in front of the app for a fact that only
// affects three courses, and it was answered by whoever could be bothered.
//
// It is now asked on those three courses instead: the English cards carry a
// "which level?" chip, and opening any of them puts the four options in
// front of you, at the one moment the question explains itself. Until it is
// answered the plan simply shows all three levels, which is what the
// published document says and is therefore not a lie — just not yet narrowed
// to this student. The answer is still changeable from Settings.
//
// What the answer does: the levels BELOW the placement are marked removed
// through js/12-removed.js — the mechanism whose own header names this
// exact case — so they leave the grid, the credit-hour totals, the
// requirement counts and the availability checks, as if they had never been
// in the plan. Nothing in plans.json is edited: the published plan still
// says what the document says, and this is recorded as the student's own
// answer on top of it.
//
// Courses are matched on the university's course NUMBER first, which is
// stable across all 77 plans (010610014 / 010610025-6 / 010610035-6), and
// on the course name only as a fallback for the handful of plans that were
// transcribed with slug ids instead.
// ==========================
(function(){
  'use strict';

  var KEY = 'aaup_englishLevel';

  // Ordered weakest to strongest. A placement removes every level before it.
  var LEVELS = ['beginning', 'intermediate', 'advanced', 'passed'];

  var MATCH = {
    beginning:    { nums: ['010610014'], re: /beginning\s+english/i },
    intermediate: { nums: ['010610025', '010610026'], re: /intermediate\s+english/i },
    advanced:     { nums: ['010610035', '010610036'], re: /advanced\s+english/i }
  };

  var TX = {
    en: {
      title: 'Where were you placed in English?',
      lead: 'Your plan lists Beginning, Intermediate and Advanced English. The placement test decides which of them you actually take, and the levels below yours are never taken at all \u2014 so your answer takes them out of the grid and out of the hours you still owe.',
      beginning: 'Beginning English',
      beginningSub: 'I start from the first level',
      intermediate: 'Intermediate English',
      intermediateSub: 'I placed out of Beginning',
      advanced: 'Advanced English',
      advancedSub: 'I placed straight into Advanced',
      passed: 'I have finished English',
      passedSub: 'All levels done, or exempt',
      settings: 'English level',
      change: 'Change',
      chip: 'which level?',
      askHere: 'Your plan lists three English levels. You only take one — which did you place into?',
      current: { beginning: 'Beginning', intermediate: 'Intermediate', advanced: 'Advanced', passed: 'Finished' },
      saved: function(n){
        return n === 0 ? 'Saved — your plan keeps all its English levels.'
          : n === 1 ? 'Saved — one English course left your plan.'
          : 'Saved — ' + n + ' English courses left your plan.';
      }
      // NOTE ON HOURS: choosing a level takes those courses out of the grid,
      // out of what is still owed, and out of the prerequisite chain — so
      // Advanced English is open to you straight away rather than waiting
      // behind an Intermediate you never took. It does NOT change the
      // degree total the university publishes. Whether placing out reduces
      // your 129 hours or is filled by something else is a question the
      // catalogue does not answer, and this app does not guess at it.
    },
    ar: {
      title: 'وين تحدّد مستواك بالإنجليزي؟',
      lead: 'خطتك فيها إنجليزي مبتدئ ومتوسط ومتقدّم. امتحان تحديد المستوى بقرر أي واحد منهم فعليًا بتاخده، والمستويات اللي تحتك ما بتاخدها أبدًا — فجوابك بشيلهم من الخطة ومن الساعات المتبقية.',
      beginning: 'إنجليزي مبتدئ',
      beginningSub: 'ببلّش من أول مستوى',
      intermediate: 'إنجليزي متوسط',
      intermediateSub: 'تجاوزت المبتدئ',
      advanced: 'إنجليزي متقدّم',
      advancedSub: 'دخلت على المتقدّم مباشرة',
      passed: 'خلّصت الإنجليزي',
      passedSub: 'كل المستويات منجزة، أو معفى',
      settings: 'مستوى الإنجليزي',
      change: 'تغيير',
      chip: 'أي مستوى؟',
      askHere: 'خطتك فيها ثلاث مستويات إنجليزي. بتاخد واحد بس — على أي واحد تحدّد مستواك؟',
      current: { beginning: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدّم', passed: 'منتهٍ' },
      saved: function(n){
        return n === 0 ? 'انحفظ — خطتك محتفظة بكل مستويات الإنجليزي.'
          : 'انحفظ — طلع ' + n + ' مساق إنجليزي من خطتك.';
      }
    }
  };
  function t(rtl){ return TX[rtl ? 'ar' : 'en']; }
  function esc(s){ return window.__escapeHtml ? window.__escapeHtml(String(s == null ? '' : s)) : String(s); }
  function ic(k, n){ return window.AAUP_ICONS ? window.AAUP_ICONS.preview(k, n || 16) : ''; }

  function level(){
    try{
      var v = localStorage.getItem(KEY);
      return LEVELS.indexOf(v) === -1 ? null : v;
    }catch(e){ return null; }
  }
  function setLevel(v){
    try{ localStorage.setItem(KEY, v); }catch(e){}
  }

  // ---------------------------------------------------------------------
  // Which of this plan's courses belong to which English level.
  function englishIn(prefix){
    var info = ((window.__PLAN_DATA || {})[prefix] || {}).courseInfo || {};
    var out = { beginning: [], intermediate: [], advanced: [] };
    Object.keys(info).forEach(function(slug){
      var c = info[slug] || {};
      var num = String(c.num == null ? '' : c.num);
      var name = String(c.name == null ? '' : c.name);
      Object.keys(MATCH).forEach(function(lv){
        var m = MATCH[lv];
        if(m.nums.indexOf(num) !== -1 || m.re.test(name)){ out[lv].push(slug); }
      });
    });
    return out;
  }

  // Every level strictly below the placement. "passed" is below nothing —
  // it is above everything, so it clears all three.
  function levelsBelow(placement){
    var idx = LEVELS.indexOf(placement);
    return LEVELS.slice(0, idx === -1 ? 0 : idx).filter(function(l){ return l !== 'passed'; });
  }

  // ---------------------------------------------------------------------
  // Apply the stored answer to a plan. Idempotent: safe to run on every
  // open, which is what makes a plan opened for the first time on a second
  // device pick the answer up.
  function apply(prefix){
    var lv = level();
    if(!lv || !window.AAUP_REMOVED) return 0;
    var found = englishIn(prefix);
    var drop = levelsBelow(lv);
    var n = 0;
    Object.keys(found).forEach(function(band){
      var removing = drop.indexOf(band) !== -1;
      found[band].forEach(function(slug){
        // Only ever writes when the state actually differs, so re-running
        // this does not churn storage or fire a re-render for nothing.
        if(window.AAUP_REMOVED.isRemoved(prefix, slug) !== removing){
          window.AAUP_REMOVED.setRemoved(prefix, slug, removing);
        }
        if(removing) n++;
      });
    });
    return n;
  }

  // ---------------------------------------------------------------------
  // The question itself.
  function optionHTML(key, tx){
    return '<button type="button" class="eng-opt" data-eng="' + key + '">' +
      '<span class="eng-opt-body">' +
        '<span class="eng-opt-name">' + esc(tx[key]) + '</span>' +
        '<span class="eng-opt-sub">' + esc(tx[key + 'Sub']) + '</span>' +
      '</span>' +
      '<span class="eng-opt-chev">' + ic('chevronRight', 16) + '</span>' +
    '</button>';
  }

  function ask(prefix, rtl, onDone){
    var overlay = document.getElementById('englishLevelOverlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay eng-overlay';
      overlay.id = 'englishLevelOverlay';
      overlay.innerHTML = '<div class="modal-card eng-card"><div class="modal-body" id="englishLevelBody"></div></div>';
      document.body.appendChild(overlay);
    }
    var tx = t(rtl);
    var body = overlay.querySelector('#englishLevelBody');
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    // No back bar and no ✕ on purpose — see this file's header. The four
    // options are the only way out, which is what "not skippable" means.
    body.innerHTML =
      '<h2 class="mh eng-title">' + ic('language', 20) + esc(tx.title) + '</h2>' +
      '<p class="eng-lead">' + esc(tx.lead) + '</p>' +
      '<div class="eng-opts">' +
        optionHTML('beginning', tx) +
        optionHTML('intermediate', tx) +
        optionHTML('advanced', tx) +
        optionHTML('passed', tx) +
      '</div>';
    overlay.classList.add('open');

    body.addEventListener('click', function(e){
      var btn = e.target.closest('[data-eng]');
      if(!btn) return;
      var chosen = btn.getAttribute('data-eng');
      setLevel(chosen);
      overlay.classList.remove('open');
      var n = apply(prefix);
      if(window.__showToast){ window.__showToast(tx.saved(n)); }
      if(typeof onDone === 'function') onDone(chosen, n);
    });
  }

  // Apply the stored answer on opening a plan. It no longer ASKS here — see
  // this file's header. A plan opened for the first time on a second device
  // still picks the answer up, which is all this call was ever needed for.
  function ensure(prefix){
    apply(prefix);
  }

  // ---------------------------------------------------------------------
  // Asking on the courses themselves.
  //
  // needsAnswer() is the one predicate both surfaces read: is this course one
  // of the three English levels, in a plan that has them, with no answer
  // stored? The plan grid uses it to put a chip on the card; the course
  // modal uses it to put the four options in front of someone who tapped it.
  // Cached per plan because the grid asks it once per card on every render.
  var engCache = Object.create(null);
  function englishSlugs(prefix){
    if(!engCache[prefix]){
      var f = englishIn(prefix);
      engCache[prefix] = f.beginning.concat(f.intermediate, f.advanced);
    }
    return engCache[prefix];
  }
  // __PLAN_DATA for a plan is rebuilt when its courses change, so the cache
  // has to be droppable. Cheap, and only ever called on a real edit.
  function forget(prefix){
    if(prefix) delete engCache[prefix]; else engCache = Object.create(null);
  }
  function needsAnswer(prefix, slug){
    if(level()) return false;
    return englishSlugs(prefix).indexOf(slug) !== -1;
  }
  function chipLabel(rtl){ return t(rtl).chip; }

  // The block that goes inside the course modal. Same four options as the
  // dialog, same handler — bound by the caller through answerFromClick so
  // there is exactly one place that writes the answer.
  function askHereHtml(prefix, slug, rtl){
    if(!needsAnswer(prefix, slug)) return '';
    var tx = t(rtl);
    return '<div class="cd-sec eng-inline"><div class="cd-lbl">' + esc(tx.settings) + '</div>' +
      '<p class="cd-note">' + esc(tx.askHere) + '</p>' +
      '<div class="eng-opts eng-opts-inline">' +
        optionHTML('beginning', tx) + optionHTML('intermediate', tx) +
        optionHTML('advanced', tx) + optionHTML('passed', tx) +
      '</div></div>';
  }

  // Handles a click anywhere inside an askHereHtml block. Returns true if it
  // was one of the options, so the caller knows whether to close and redraw.
  function answerFromClick(prefix, target, rtl){
    var btn = target && target.closest ? target.closest('.eng-opts-inline [data-eng]') : null;
    if(!btn) return false;
    setLevel(btn.getAttribute('data-eng'));
    var n = apply(prefix);
    if(window.__showToast){ window.__showToast(t(rtl).saved(n)); }
    return true;
  }

  // Changing the answer later. Re-asks, then re-applies — which can add
  // courses back as well as take them away, since apply() sets the removed
  // flag in both directions.
  function change(prefix){
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    ask(prefix, rtl, function(){
      if(window.__refreshPlanUI){ window.__refreshPlanUI(prefix); }
    });
  }

  window.AAUP_ENGLISH = {
    ensure: ensure, apply: apply, change: change, forget: forget,
    needsAnswer: needsAnswer, chipLabel: chipLabel,
    askHereHtml: askHereHtml, answerFromClick: answerFromClick,
    level: level, label: function(rtl){
      var lv = level();
      return lv ? t(rtl).current[lv] : '';
    }
  };
})();
