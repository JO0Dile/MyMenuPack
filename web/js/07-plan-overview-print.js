// ==========================
// PLAN OVERVIEW & PRINT — a compact, all-semesters-at-once view of the whole
// plan that doubles as a print-friendly layout for an advising meeting
// (Export already produces JSON, but nobody hands an advisor a JSON file).
// Reads the currently-rendered plan page — which exists for both built-in
// majors (always in the DOM) and imported plans (rendered on open) — plus
// window.__PLAN_DATA for credit hours and the grades map, so one code path
// covers every plan type.
// ==========================
(function(){
  var esc = window.__escapeHtml;

  function splitId(id){ return window.__splitCourseId ? window.__splitCourseId(id) : null; }

  function buildModel(prefix){
    var root = document.getElementById('page-' + prefix);
    if(!root) return null;
    var rtl = root.classList.contains('rtl-mode');
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var grades = (window.AAUP_GPA && window.AAUP_GPA.loadGrades) ? window.AAUP_GPA.loadGrades() : {};
    var progress = window.__getProgress ? window.__getProgress() : {};

    // Built-in majors nest .year-row > .semesters > .sem; imported plans use
    // .imp-year-block > .imp-semester-block. Normalize both to the same shape.
    var builtInYears = root.querySelectorAll('.year-row');
    var years = [];
    if(builtInYears.length){
      Array.prototype.slice.call(builtInYears).forEach(function(yr){
        var label = (yr.querySelector('.year-badge .label') || {}).textContent || '';
        var sems = [];
        yr.querySelectorAll('.sem').forEach(function(sem){
          var semLabel = (sem.querySelector('.sem-label') || {}).textContent || '';
          sems.push({ label: semLabel.replace(/\s+/g, ' ').trim(), courses: collectCourses(sem, info, grades, progress, prefix, rtl) });
        });
        years.push({ label: label.replace(/\s+/g, ' ').trim(), semesters: sems });
      });
    } else {
      Array.prototype.slice.call(root.querySelectorAll('.imp-year-block')).forEach(function(yb){
        var label = (yb.querySelector('.imp-year-header h3') || {}).textContent || '';
        var sems = [];
        yb.querySelectorAll('.imp-semester-block').forEach(function(sb){
          var semLabel = (sb.querySelector('.imp-semester-title') || {}).textContent || '';
          sems.push({ label: semLabel.replace(/\s+/g, ' ').trim(), courses: collectCourses(sb, info, grades, progress, prefix, rtl) });
        });
        years.push({ label: label.replace(/\s+/g, ' ').trim(), semesters: sems });
      });
    }
    return { rtl: rtl, years: years };
  }

  function collectCourses(container, info, grades, progress, prefix, rtl){
    var out = [];
    container.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(el){
      var parts = splitId(el.id);
      if(!parts) return;
      var nameEl = el.querySelector('.name');
      var name = nameEl ? nameEl.textContent.replace(/\s*✓\s*$/, '').trim() : parts.slug;
      var meta = info[parts.slug] || {};
      var cr = meta.cr != null ? meta.cr : '';
      var pid = (window.AAUP_GPA && window.AAUP_GPA.primaryId) ? window.AAUP_GPA.primaryId(prefix, parts.slug) : el.id;
      var grade = grades[pid] || '';
      out.push({ name: name, credits: cr, done: !!progress[el.id], grade: grade });
    });
    return out;
  }

  function planHeader(prefix, rtl){
    var dash = window.AAUP_DASHBOARD;
    var info = dash && dash.planDisplayInfo ? dash.planDisplayInfo(prefix) : { icon: '🎓', name: prefix };
    var student = window.AAUP_STUDENT ? window.AAUP_STUDENT.get() : null;
    var pct = dash && dash.planPercent ? dash.planPercent(prefix) : null;
    var stats = window.__computeStats ? (function(){ try{ return window.__computeStats(prefix); }catch(e){ return null; } })() : null;
    var gpaObj = (window.AAUP_GPA && window.AAUP_GPA.gpaFor) ? (function(){ try{ return window.AAUP_GPA.gpaFor(prefix); }catch(e){ return null; } })() : null;
    var gpa = gpaObj && gpaObj.gpa != null ? gpaObj.gpa.toFixed(2) : null;

    var rows = [];
    if(student && student.name){ rows.push((rtl ? 'الطالب: ' : 'Student: ') + esc(student.name)); }
    if(gpa){ rows.push((rtl ? 'المعدل التراكمي: ' : 'GPA: ') + gpa); }
    if(stats && stats.totalCredits){ rows.push((rtl ? 'الساعات: ' : 'Credit hours: ') + stats.doneCredits + ' / ' + stats.totalCredits + (pct != null ? ' (' + pct + '%)' : '')); }
    var today = new Date();
    rows.push((rtl ? 'أُنشئ في: ' : 'Generated: ') + today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0'));

    return '<div class="po-header">' +
      '<div class="po-title"><span class="po-icon">' + esc(info.icon || '🎓') + '</span>' +
      // info.name (from planDisplayInfo) is already HTML-escaped once by the
      // sync sanitizer — esc()'ing it again would show a literal "&amp;".
      '<div><div class="po-name">' + (info.name || prefix) + '</div>' +
      '<div class="po-uni">The Arab American University · الجامعة العربية الأمريكية</div></div></div>' +
      '<div class="po-meta">' + rows.map(function(r){ return '<span>' + r + '</span>'; }).join('') + '</div>' +
      '</div>';
  }

  function renderOverview(prefix){
    var model = buildModel(prefix);
    if(!model) return '<p class="ex-note">Open a study plan first.</p>';
    var rtl = model.rtl;
    var html = planHeader(prefix, rtl);
    html += '<div class="po-years">';
    model.years.forEach(function(y){
      html += '<div class="po-year"><div class="po-year-label">' + esc(y.label) + '</div>';
      y.semesters.forEach(function(s){
        if(!s.courses.length) return;
        html += '<div class="po-sem"><div class="po-sem-label">' + esc(s.label) + '</div><ul class="po-courses">';
        s.courses.forEach(function(c){
          var mark = c.done ? '✓' : '○';
          var gradeTag = c.grade ? ' <span class="po-grade">' + esc(c.grade) + '</span>' : '';
          var crTag = c.credits !== '' ? ' <span class="po-cr">' + esc(String(c.credits)) + 'H</span>' : '';
          html += '<li class="' + (c.done ? 'po-done' : '') + '"><span class="po-mark">' + mark + '</span>' +
            '<span class="po-cname">' + esc(c.name) + '</span>' + crTag + gradeTag + '</li>';
        });
        html += '</ul></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    html += '<p class="po-foot">Unofficial student planning tool — always confirm with your academic advisor. · أداة طلابية غير رسمية — تأكد دائمًا من مرشدك الأكاديمي.</p>';
    return html;
  }

  function ensureOverlay(){
    var overlay = document.getElementById('planOverviewOverlay');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'planOverviewOverlay';
    overlay.innerHTML =
      '<div class="modal-card po-card">' +
        '<button class="modal-close" id="planOverviewClose" aria-label="Close">&times;</button>' +
        '<div class="po-actions"><button type="button" class="home-btn" id="planOverviewPrintBtn" style="border-color:var(--accent);color:var(--text);">🖨️ Print / Save PDF</button></div>' +
        '<div id="planOverviewPrintRoot"><div id="planOverviewBody"></div></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if(e.target === overlay){ overlay.classList.remove('open'); } });
    overlay.querySelector('.modal-card').addEventListener('click', function(e){ e.stopPropagation(); });
    document.getElementById('planOverviewClose').addEventListener('click', function(){ overlay.classList.remove('open'); });
    // The print stylesheet (see @media print in the <style> block) hides
    // everything except #planOverviewPrintRoot, so window.print() yields a
    // clean one-page plan with none of the app chrome around it.
    document.getElementById('planOverviewPrintBtn').addEventListener('click', function(){ window.print(); });
    return overlay;
  }

  function open(prefix){
    var overlay = ensureOverlay();
    document.getElementById('planOverviewBody').innerHTML = renderOverview(prefix);
    overlay.classList.add('open');
  }

  window.AAUP_OVERVIEW = { open: open };
})();
