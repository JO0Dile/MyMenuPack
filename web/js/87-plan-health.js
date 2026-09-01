// ==========================
// PLAN HEALTH — one grade for how the degree is going
//
// Pace, load balance and prerequisite risk are three things this app can
// already work out and nobody was reading separately. The dashboard led with
// a table of numbers — 54%, 2.97, 12/40 — and left the reader to decide what
// any of it meant. This leads with the judgement instead, and shows the three
// parts underneath so the judgement can be argued with.
//
// WHAT THIS IS AND IS NOT
// It is the app's own read of what the student has entered, against the
// advisory plan the university published. It is NOT an academic standing, not
// a registrar figure, and it is deliberately not called one anywhere in the
// UI. Nothing here is stored or sent; it is recomputed on every render from
// the same data the rest of the dashboard reads.
//
// THE THREE PARTS
//
// pace     — how much of what the plan schedules through the terms you have
//            started have you actually finished. Measured against the plan's
//            own sequence rather than a calendar, because the app does not
//            know the date you enrolled and will not guess at it.
//
// balance  — how evenly your own finished hours are spread across those
//            terms. A student alternating 21H and 9H is carrying the same
//            total as one doing 15H twice and having a much worse time.
//            Personal, not a property of the plan: two students on the same
//            plan get different balance scores.
//
// risk     — whether what is left still FITS. If four terms remain and
//            something is still five prerequisites deep, the plan cannot be
//            finished on time no matter how well the other two are going, and
//            that is the single most useful thing this screen can say.
//
// Each scores 2 (good), 1 (watch) or 0 (problem); the six-point total maps to
// a letter. A student with nothing marked gets no grade at all — see
// emptyHtml(), which asks for the one action that produces one.
// ==========================
(function(){
  'use strict';

  var GRADES = [
    { min: 6, letter: 'A',  en: 'on track',            ar: 'ماشي تمام' },
    { min: 5, letter: 'A-', en: 'on track',            ar: 'ماشي تمام' },
    { min: 4, letter: 'B+', en: 'mostly on track',     ar: 'ماشي بمعظمه' },
    { min: 3, letter: 'B',  en: 'watch one thing',     ar: 'انتبه لإشي واحد' },
    { min: 2, letter: 'C+', en: 'two things to fix',   ar: 'إشيين بدهم ترتيب' },
    { min: 1, letter: 'C',  en: 'behind the plan',     ar: 'متأخر عن الخطة' },
    { min: 0, letter: 'D',  en: 'well behind the plan', ar: 'متأخر كثير عن الخطة' }
  ];

  function tx(rtl, en, ar){ return rtl ? ar : en; }
  function esc(s){ return window.__escapeHtml ? window.__escapeHtml(String(s == null ? '' : s)) : String(s); }

  // ---------------------------------------------------------------------
  // The plan, term by term, with the plan's hours and the student's.
  function terms(prefix){
    var plans = window.AAUP_IMPORTED ? window.AAUP_IMPORTED.loadImportedPlans() : {};
    var plan = plans[prefix];
    if(!plan || !plan.structure || !Array.isArray(plan.structure.years)) return null;
    var progress = window.__getProgress ? window.__getProgress() : {};
    var out = [];
    plan.structure.years.forEach(function(y, i){
      ['s1', 's2'].concat(y.hasSummer ? ['s3'] : []).forEach(function(sem){
        var here = (plan.courses || []).filter(function(c){
          return c.yearId === y.id && c.semester === sem;
        });
        if(!here.length) return;
        var planned = 0, mine = 0;
        here.forEach(function(c){
          var h = parseFloat(c.creditHours) || 0;
          planned += h;
          if(progress[prefix + '-c-' + c.id]) mine += h;
        });
        out.push({ yearNum: i + 1, sem: sem, planned: planned, mine: mine });
      });
    });
    return out.length ? out : null;
  }

  // ---------------------------------------------------------------------
  // pace: finished hours against what the plan schedules through the last
  // term you have touched. "Touched", not "reached by date" — the app has no
  // enrolment date and inventing one would make this number a guess.
  function pace(ts){
    var last = -1;
    ts.forEach(function(t, i){ if(t.mine > 0) last = i; });
    if(last < 0) return null;
    var scheduled = 0, done = 0;
    for(var i = 0; i <= last; i++){ scheduled += ts[i].planned; done += ts[i].mine; }
    if(!scheduled) return null;
    var ratio = done / scheduled;
    return {
      ratio: ratio,
      score: ratio >= 0.95 ? 2 : ratio >= 0.8 ? 1 : 0,
      done: done, scheduled: scheduled, through: last + 1
    };
  }

  // balance: how evenly your finished hours sit across the terms you have
  // worked through. Spread is measured against your own mean, so it says
  // nothing about whether you are carrying a lot — only about whether the
  // amount keeps changing. Terms with nothing finished are included: a term
  // you sat out IS the unevenness.
  function balance(ts){
    var last = -1;
    ts.forEach(function(t, i){ if(t.mine > 0) last = i; });
    if(last < 1) return null;                       // one term has no spread
    var mine = ts.slice(0, last + 1).map(function(t){ return t.mine; });
    var mean = mine.reduce(function(a, b){ return a + b; }, 0) / mine.length;
    if(mean <= 0) return null;
    var variance = mine.reduce(function(a, h){ return a + (h - mean) * (h - mean); }, 0) / mine.length;
    var cv = Math.sqrt(variance) / mean;            // coefficient of variation
    // A third of the mean is roughly one course's worth of swing on a normal
    // 15H term — normal. Two thirds is a term twice the size of another.
    return {
      cv: cv, mean: mean,
      score: cv <= 0.33 ? 2 : cv <= 0.66 ? 1 : 0,
      worst: worstTerm(ts.slice(0, last + 1), mean)
    };
  }

  function worstTerm(ts, mean){
    var w = null;
    ts.forEach(function(t){
      var d = Math.abs(t.mine - mean);
      if(!w || d > w.d) w = { d: d, yearNum: t.yearNum, sem: t.sem, mine: t.mine };
    });
    return w;
  }

  // risk: does what is left still fit in the terms that are left? Depth is
  // the longest chain of not-yet-finished prerequisites in front of a course
  // (js/28-imported.js chainDepth), which is exactly the number of terms it
  // still needs, so comparing the two is a like-for-like check.
  function risk(prefix, ts){
    if(!window.AAUP_IMPORTED || !window.AAUP_IMPORTED.chainDepth) return null;
    var progress = window.__getProgress ? window.__getProgress() : {};
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var last = -1;
    ts.forEach(function(t, i){ if(t.mine > 0) last = i; });
    var termsLeft = ts.length - (last + 1);
    var deepest = 0, deepestSlug = '';
    Object.keys(info).forEach(function(slug){
      if(progress[prefix + '-c-' + slug]) return;
      var d = window.AAUP_IMPORTED.chainDepth(prefix, slug);
      if(d > deepest){ deepest = d; deepestSlug = slug; }
    });
    // Depth 0 courses can all be taken in the next term, so a plan whose
    // remaining work is all depth 0 fits in one term however much of it
    // there is — depth is about ORDER, and the hours are what pace measures.
    var needs = deepest + 1;                        // terms this chain still takes
    return {
      deepest: deepest, slug: deepestSlug, termsLeft: termsLeft, needs: needs,
      score: termsLeft <= 0 ? (deepest === 0 ? 2 : 0)
           : needs < termsLeft ? 2 : needs === termsLeft ? 1 : 0
    };
  }

  // ---------------------------------------------------------------------
  function compute(prefix){
    var ts = terms(prefix);
    if(!ts) return null;
    var p = pace(ts), b = balance(ts), r = risk(prefix, ts);
    if(!p) return null;                             // nothing marked: no grade
    // A single-term student has no balance to measure. Scoring the missing
    // part as good would inflate the grade, so the total is taken over the
    // parts that exist and scaled — a two-part grade is still a grade.
    var parts = [p, b, r].filter(Boolean);
    var got = parts.reduce(function(a, x){ return a + x.score; }, 0);
    var max = parts.length * 2;
    var six = Math.round(got / max * 6);
    var g = GRADES.filter(function(x){ return six >= x.min; })[0] || GRADES[GRADES.length - 1];
    return { grade: g, pace: p, balance: b, risk: r, terms: ts };
  }

  // ---------------------------------------------------------------------
  function chip(label, score){
    var cls = score === 2 ? 'good' : score === 1 ? 'watch' : 'bad';
    return '<span class="ph-chip ph-' + cls + '">' + esc(label) + '</span>';
  }

  function summaryLine(h, rtl){
    // One sentence naming the weakest part, because that is the part worth
    // doing something about. When all three are healthy it says so.
    var parts = [];
    if(h.pace && h.pace.score < 2){
      parts.push(tx(rtl,
        Math.round(h.pace.done) + ' of the ' + Math.round(h.pace.scheduled) +
          'H the plan schedules through term ' + h.pace.through,
        Math.round(h.pace.done) + ' من ' + Math.round(h.pace.scheduled) +
          ' ساعة الخطة بتجدولها لحد الفصل ' + h.pace.through));
    }
    if(h.balance && h.balance.score < 2 && h.balance.worst){
      parts.push(tx(rtl,
        'load uneven in year ' + h.balance.worst.yearNum,
        'الحمل غير متوازن بالسنة ' + h.balance.worst.yearNum));
    }
    if(h.risk && h.risk.score < 2){
      parts.push(tx(rtl,
        h.risk.needs + ' more terms of prerequisites, ' + h.risk.termsLeft + ' left in the plan',
        h.risk.needs + ' فصول متطلبات كمان، وباقي ' + h.risk.termsLeft + ' بالخطة'));
    }
    if(!parts.length) return tx(rtl, 'pace, balance and prerequisites all clear',
                                    'السرعة والتوازن والمتطلبات كلهم تمام');
    return parts.join(' \u00b7 ');
  }

  // The block on the dashboard. Returns '' when there is nothing to grade —
  // the caller shows the empty state instead.
  function cardHtml(prefix, rtl){
    var h = compute(prefix);
    if(!h) return '';
    return '<div class="dash-card ph-card">' +
      '<div class="ph-head">' +
        '<span class="ph-grade">' + esc(h.grade.letter) + '</span>' +
        '<span class="ph-head-text">' +
          '<span class="ph-lbl">' + tx(rtl, 'plan health', 'حالة الخطة') + '</span>' +
          '<span class="ph-verdict">' + esc(tx(rtl, h.grade.en, h.grade.ar)) + '</span>' +
        '</span>' +
      '</div>' +
      '<p class="ph-why">' + esc(summaryLine(h, rtl)) + '</p>' +
      '<div class="ph-chips">' +
        chip(tx(rtl, 'pace', 'السرعة'), h.pace.score) +
        (h.balance ? chip(tx(rtl, 'balance', 'التوازن'), h.balance.score) : '') +
        (h.risk ? chip(tx(rtl, 'prereq risk', 'المتطلبات'), h.risk.score) : '') +
      '</div>' +
      '<p class="ph-note">' + tx(rtl,
        'This app’s own read of what you have entered, against the published advisory plan — not an academic standing.',
        'قراءة التطبيق لما أدخلته أنت، مقابل الخطة الإرشادية المنشورة — مش تقييم أكاديمي رسمي.') +
      '</p></div>';
  }

  window.AAUP_PLAN_HEALTH = { compute: compute, cardHtml: cardHtml };
})();
