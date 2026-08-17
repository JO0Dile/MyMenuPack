// ==========================
// AI STUDY ADVISOR (fully offline — uses only the existing prerequisite
// graph, credit-hour data, and the student's own prior ratings; nothing is
// invented for courses the student hasn't actually taken)
// ==========================
(function(){
  var TARGET_MIN = 15, TARGET_MAX = 18;
  var CATS = ['core', 'math', 'dept', 'eng', 'uni', 'free', 'skills'];

  function categoryOf(el){
    for(var i = 0; i < CATS.length; i++){ if(el.classList.contains(CATS[i])) return CATS[i]; }
    return null;
  }

  function recommend(prefix){
    var page = document.getElementById('page-' + prefix);
    var data = window.__PLAN_DATA[prefix] || {};
    var info = data.courseInfo || {};
    var needsMap = data.needsMap || {};
    var unlocksMap = data.unlocksMap || {};
    var available = page ? Array.prototype.slice.call(page.querySelectorAll('.course.available[id]')) : [];

    var candidates = available.map(function(el){
      var parts = window.__splitCourseId(el.id);
      var meta = info[parts.slug] || {};
      var unlocks = unlocksMap[parts.slug] || [];
      return {
        el: el, slug: parts.slug,
        cr: parseFloat(meta.cr) || 0,
        unlocks: unlocks, unlocksCount: unlocks.length,
        needs: needsMap[parts.slug] || []
      };
    });

    // Prioritize "gateway" courses — the ones that unlock the most future
    // courses — then smaller credit loads as a tiebreaker so more distinct
    // courses fit inside the 15–18H target instead of maxing out on one.
    candidates.sort(function(a, b){
      if(b.unlocksCount !== a.unlocksCount) return b.unlocksCount - a.unlocksCount;
      return a.cr - b.cr;
    });

    var chosen = [], totalCr = 0;
    candidates.forEach(function(c){
      if(totalCr >= TARGET_MAX) return;
      if(totalCr + c.cr <= TARGET_MAX){ chosen.push(c); totalCr += c.cr; }
    });

    // "Likely hard" is a personal heuristic built only from the student's
    // OWN prior ratings — average how they've rated their completed
    // courses in each category, and flag a recommended course if most of
    // their history in that same category was rated Hard / high-difficulty.
    // Nothing is guessed for a category they've never rated.
    var ratings = window.AAUP_PERSONAL.loadRatings();
    var progress = window.__getProgress();
    var categoryHardness = {};
    if(page){
      page.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
        if(!progress[el.id]) return;
        var cat = categoryOf(el);
        if(!cat) return;
        var parts = window.__splitCourseId(el.id);
        var pid = window.AAUP_GPA.primaryId(prefix, parts.slug);
        var r = ratings[pid];
        if(!r || (!r.workload && !r.difficulty)) return;
        categoryHardness[cat] = categoryHardness[cat] || { hard: 0, total: 0 };
        categoryHardness[cat].total++;
        if(r.workload === 'Hard' || (r.difficulty || 0) >= 4){ categoryHardness[cat].hard++; }
      });
    }

    var hardCount = 0;
    chosen.forEach(function(c){
      var cat = categoryOf(c.el);
      var h = cat && categoryHardness[cat];
      c.likelyHard = !!(h && h.total > 0 && (h.hard / h.total) >= 0.5);
      if(c.likelyHard) hardCount++;
    });

    return { chosen: chosen, totalCr: totalCr, hardCount: hardCount, poolSize: available.length };
  }

  function courseName(prefix, slug, rtl){
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var meta = info[slug];
    return meta ? (rtl ? meta.ar : meta.name) : slug;
  }

  function render(prefix){
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    var r = recommend(prefix);
    var html = '<h2 style="margin-top:0;">🧠 ' + (rtl ? 'ساعدني في تخطيط الفصل القادم' : 'Help Me Plan My Next Semester') + '</h2>';

    if(r.chosen.length === 0){
      html += '<p class="ex-note">' + (rtl
        ? 'لا توجد مساقات متاحة الآن للتوصية بها — أكمل بعض المتطلبات السابقة أولاً.'
        : 'Nothing is unlocked yet to recommend \u2014 complete a few prerequisites first.') + '</p>';
      return html;
    }

    html += '<div class="advisor-summary">' +
      (rtl ? 'الحمل الدراسي المقترح: ' : 'Recommended load: ') + '<b>' + r.totalCr + 'H</b>' +
      (r.totalCr < TARGET_MIN
        ? (rtl ? ' (أقل من النطاق المثالي 15\u201318 ساعة — عدد المساقات المتاحة حاليًا محدود)'
                : ' (below the ideal 15\u201318H range \u2014 only this many courses are unlocked right now)')
        : '') +
      ' &middot; ' + r.chosen.length + ' ' + (rtl ? 'مساقات' : 'courses') +
      '</div>';

    if(r.hardCount > 2){
      html += '<div class="advisor-warning">⚠️ ' + (rtl
        ? 'هذا الحمل يتضمن أكثر من مساقين في فئات وجدتها صعبة سابقًا بحسب تقييماتك — قد ترغب باستبدال أحدها.'
        : 'This load includes more than 2 courses in categories you\u2019ve previously rated Hard \u2014 consider swapping one out.') + '</div>';
    }

    html += '<div class="advisor-course-list">';
    r.chosen.forEach(function(c){
      var needNames = c.needs.map(function(s){ return courseName(prefix, s, rtl); });
      var unlockNames = c.unlocks.slice(0, 3).map(function(s){ return courseName(prefix, s, rtl); });
      var reason = needNames.length
        ? (rtl ? 'المتطلبات السابقة مكتملة: ' : 'Prerequisites met: ') + needNames.join(', ') + ' ✅'
        : (rtl ? 'لا يوجد متطلب سابق — متاح فورًا' : 'No prerequisites \u2014 available immediately');
      if(unlockNames.length){
        reason += (rtl ? ' \u2190 يفتح المجال أمام ' : ' \u2192 unlocks ') + unlockNames.join(', ') + (c.unlocks.length > 3 ? '…' : '');
      }
      html += '<div class="advisor-course-card">' +
        '<div class="acc-head"><span>' + courseName(prefix, c.slug, rtl) + '</span><span class="acc-cr">' + c.cr + 'H</span></div>' +
        '<div class="acc-reason">' + reason +
        (c.likelyHard ? ' &middot; <span style="color:var(--prereq);font-weight:700;">⚡ ' + (rtl ? 'قد يكون صعبًا بالنسبة لك' : 'possibly Hard for you') + '</span>' : '') +
        '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function open(prefix){
    var body = document.getElementById('advisorModalBody');
    var overlay = document.getElementById('advisorModalOverlay');
    if(!body || !overlay) return;
    body.innerHTML = render(prefix);
    overlay.classList.add('open');
  }

  function bind(){
    var overlay = document.getElementById('advisorModalOverlay');
    var closeBtn = document.getElementById('advisorModalClose');
    if(!overlay) return;
    var close = function(){ overlay.classList.remove('open'); };
    if(closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    // Escape works on the audit and course modals, so a keyboard user
    // reasonably expects it here too. Guarded on .open so it stays inert.
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && overlay.classList.contains('open')) close(); });
    var card = overlay.querySelector('.modal-card');
    if(card) card.addEventListener('click', function(e){ e.stopPropagation(); });
  }
  if(document.readyState === 'complete'){ bind(); }
  else { window.addEventListener('load', bind); }

  window.AAUP_ADVISOR = { open: open, recommend: recommend };
})();
