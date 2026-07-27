// ==========================
// DEVELOPER MODE
// ==========================
// Hidden trigger: open the dialog 3 times in a row (open → close → open →
// close → open) to reveal a password field. The password is a plain,
// hardcoded string with no real security purpose — it's a cosmetic
// Easter-egg gate on a panel that only ever touches this browser's own
// localStorage, not a protected system.
(function(){
  var PASSWORD = 'admin123';
  var openCount = 0;
  var authenticated = false;
  var lastWrong = false;

  function slugify(s){
    var out = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return out || ('plan-' + Date.now());
  }
  function loadImportedPlans(){
    return window.AAUP_STORAGE.getJSON('aaup_importedPlans', {});
  }
  function saveImportedPlans(m){
    window.AAUP_STORAGE.setJSON('aaup_importedPlans', m);
  }

  function validatePlanJson(obj){
    var errors = [];
    if(!obj || typeof obj !== 'object'){ return ['That is not a valid JSON object.']; }
    if(!obj.majorName || typeof obj.majorName !== 'object' || !obj.majorName.en || !obj.majorName.ar){
      errors.push('majorName must be an object with both "en" and "ar" names.');
    }
    if(!Array.isArray(obj.courses) || obj.courses.length === 0){
      errors.push('courses must be a non-empty array.');
    } else {
      obj.courses.forEach(function(c, i){
        ['id', 'name', 'ar', 'creditHours', 'category', 'semester'].forEach(function(field){
          if(c[field] === undefined || c[field] === null || c[field] === ''){
            errors.push('Course #' + (i + 1) + ' is missing "' + field + '".');
          }
        });
      });
    }
    if(!Array.isArray(obj.prerequisites)){
      errors.push('prerequisites must be an array (it can be empty).');
    }
    return errors;
  }

  function importPlan(jsonText){
    var obj;
    try{ obj = JSON.parse(jsonText); }
    catch(e){ return { ok: false, errors: ['That is not valid JSON.'] }; }
    var errors = validatePlanJson(obj);
    if(errors.length){ return { ok: false, errors: errors }; }
    // Same trust boundary as the online feed: this JSON usually came from
    // ANOTHER student (that's what Export/Contribute are for), and its
    // strings flow into the same innerHTML render paths as everything
    // else — so it gets the same escape-and-reslugify pass. Idempotent,
    // so a plan exported from this app re-imports byte-identical.
    if(window.__sanitizeImportedPlan){ obj = window.__sanitizeImportedPlan(obj); }
    var id = slugify(obj.majorName.en && obj.majorName.en.big ? obj.majorName.en.big : obj.majorName.en);
    var plans = loadImportedPlans();
    var entry = { majorName: obj.majorName, courses: obj.courses, prerequisites: obj.prerequisites, importedAt: new Date().toISOString() };
    // Preserve the newer fields when the pasted JSON has them (e.g. it was
    // exported from this app's own "Export This Plan") — dropping them
    // silently would downgrade a fully-featured plan (drag-and-drop, GPA,
    // Degree Audit) back to the old read-only view for no reason.
    if(obj.structure){ entry.structure = obj.structure; }
    if(obj.icon){ entry.icon = obj.icon; }
    if(obj.bio){ entry.bio = obj.bio; }
    if(obj.university){ entry.university = obj.university; }
    if(obj.college){ entry.college = obj.college; }
    plans[id] = entry;
    saveImportedPlans(plans);
    if(window.AAUP_IMPORTED){ window.AAUP_IMPORTED.renderHomeCards(); }
    return { ok: true, id: id };
  }
  function removePlan(id){
    var plans = loadImportedPlans();
    delete plans[id];
    saveImportedPlans(plans);
    if(window.AAUP_IMPORTED){ window.AAUP_IMPORTED.renderHomeCards(); }
  }

  function plainMessage(rtl){
    return '<h2 style="margin-top:0;">🛠️ ' + (rtl ? 'أدوات المطورين' : 'Developer Tools') + '</h2>' +
      '<p class="ex-note">' + (rtl ? 'لا شيء لرؤيته هنا... حتى الآن.' : 'Nothing to see here... yet.') + '</p>';
  }

  function passwordPrompt(rtl){
    return '<h2 style="margin-top:0;">🔒 ' + (rtl ? 'وضع المطورين' : 'Developer Mode') + '</h2>' +
      '<div class="form-field"><label for="devPasswordInput">' + (rtl ? 'كلمة المرور' : 'Password') + '</label>' +
      '<input type="password" id="devPasswordInput" autocomplete="off"></div>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="devPasswordSubmit" style="border-color:var(--accent);color:var(--text);">' +
      (rtl ? 'دخول' : 'Enter') + '</button></div>' +
      (lastWrong ? '<p class="dev-wrong-pass">' + (rtl ? 'كلمة مرور خاطئة حقًا!؟' : 'Incorrect Password really!?') + '</p>' : '');
  }

  function planListHtml(rtl){
    var plans = loadImportedPlans();
    var ids = Object.keys(plans);
    return ids.length ? ids.map(function(id){
      var p = plans[id];
      return '<div class="imported-plan-row"><div><div class="ipr-name">' + p.majorName.en + ' / ' + p.majorName.ar + '</div>' +
        '<div class="ipr-meta">' + p.courses.length + ' ' + (rtl ? 'مساقًا' : 'courses') + ' &middot; ' +
        new Date(p.importedAt).toLocaleDateString() + '</div></div>' +
        '<button type="button" class="home-btn" data-remove-plan="' + id + '">🗑 ' + (rtl ? 'حذف' : 'Remove') + '</button></div>';
    }).join('') : '<p class="ex-note">' + (rtl ? 'لا توجد خطط مستوردة بعد.' : 'No imported plans yet.') + '</p>';
  }

  // Re-binds remove-buttons for whatever rows currently exist — needed
  // whenever the list is refreshed in place rather than via a full panel
  // re-render (see refreshPlanList below).
  function bindRemoveButtons(){
    document.querySelectorAll('[data-remove-plan]').forEach(function(btn){
      if(btn.getAttribute('data-bound') === '1') return;
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', function(){
        removePlan(btn.getAttribute('data-remove-plan'));
        refreshPlanList();
      });
    });
  }

  // Updates ONLY the imported-plans list in place, leaving any success/
  // error message next to the import button untouched — a full renderBody()
  // would wipe that message the instant it appears.
  function refreshPlanList(){
    var list = document.getElementById('devPlanList');
    if(!list) return;
    list.innerHTML = planListHtml(currentRtl());
    bindRemoveButtons();
  }

  function renderPanel(rtl){
    return '<h2 style="margin-top:0;">🛠️ ' + (rtl ? 'لوحة المطورين' : 'Developer Panel') + '</h2>' +

      '<div class="dev-panel-section"><h3>📥 ' + (rtl ? 'استيراد خطة دراسية' : 'Import Study Plan') + '</h3>' +
      '<textarea class="notes-textarea" id="devPlanJsonInput" rows="5" placeholder=\'{"majorName":{"en":"...","ar":"..."},"courses":[{"id":"...","name":"...","ar":"...","creditHours":3,"category":"core","semester":"Y1S1"}],"prerequisites":[["a","b"]]}\'></textarea>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="devPlanImportBtn" style="border-color:var(--accent);color:var(--text);">' +
      (rtl ? 'استيراد' : 'Import') + '</button></div><div id="devPlanImportMsg"></div></div>' +

      '<div class="dev-panel-section"><h3>📋 ' + (rtl ? 'الخطط المستوردة' : 'Imported Study Plans') + '</h3>' +
      '<div id="devPlanList">' + planListHtml(rtl) + '</div>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="devRefreshBtn">🔄 ' + (rtl ? 'تحديث الصفحة الرئيسية' : 'Refresh Study Plans') + '</button></div></div>' +

      '<div class="dev-panel-section"><h3>📥 ' + (rtl ? 'استيراد ملاحظات المجتمع (من البريد)' : 'Import Community Feedback (from Email)') + '</h3>' +
      '<label for="devFeedbackJsonInput" style="font-size:11.5px;color:var(--text-dim);display:block;margin-bottom:6px;">' +
      (rtl ? 'ألصق نص JSON من البريد هنا' : 'Paste the JSON from the email here') + '</label>' +
      '<textarea class="notes-textarea" id="devFeedbackJsonInput" rows="5"></textarea>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="devFeedbackImportBtn" style="border-color:var(--accent);color:var(--text);">' +
      (rtl ? 'استيراد' : 'Import') + '</button></div><div id="devFeedbackImportMsg"></div></div>';
  }

  function currentRtl(){ return window.__anyVisiblePageIsRtl ? window.__anyVisiblePageIsRtl() : false; }

  function renderBody(){
    var body = document.getElementById('devModalBody');
    if(!body) return;
    var rtl = currentRtl();
    if(authenticated){ body.innerHTML = renderPanel(rtl); bindPanel(); }
    else if(openCount >= 3){ body.innerHTML = passwordPrompt(rtl); bindPasswordPrompt(); }
    else { body.innerHTML = plainMessage(rtl); }
  }

  function bindPasswordPrompt(){
    var submit = document.getElementById('devPasswordSubmit');
    var input = document.getElementById('devPasswordInput');
    if(!submit || !input) return;
    var tryLogin = function(){
      if(input.value === PASSWORD){
        authenticated = true;
        lastWrong = false;
        if(window.AAUP_PLAN_EDITOR){ window.AAUP_PLAN_EDITOR.revealDevAffordances(); }
      }
      else { lastWrong = true; }
      renderBody();
    };
    submit.addEventListener('click', tryLogin);
    input.addEventListener('keydown', function(e){ if(e.key === 'Enter') tryLogin(); });
    input.focus();
  }

  function bindPanel(){
    var importBtn = document.getElementById('devPlanImportBtn');
    if(importBtn){
      importBtn.addEventListener('click', function(){
        var text = document.getElementById('devPlanJsonInput').value;
        var result = importPlan(text);
        var msgEl = document.getElementById('devPlanImportMsg');
        if(result.ok){
          msgEl.innerHTML = '<p class="dev-success-msg">✅ Imported "' + result.id + '".</p>';
          document.getElementById('devPlanJsonInput').value = '';
          refreshPlanList();
        } else {
          msgEl.innerHTML = '<ul class="dev-warn-list">' + result.errors.map(function(e){ return '<li>' + e + '</li>'; }).join('') + '</ul>';
        }
      });
    }
    bindRemoveButtons();
    var refreshBtn = document.getElementById('devRefreshBtn');
    if(refreshBtn){ refreshBtn.addEventListener('click', function(){ location.reload(); }); }

    var fbBtn = document.getElementById('devFeedbackImportBtn');
    if(fbBtn){
      fbBtn.addEventListener('click', function(){
        var text = document.getElementById('devFeedbackJsonInput').value;
        var result = window.AAUP_COMMUNITY.importFeedback(text);
        var msgEl = document.getElementById('devFeedbackImportMsg');
        if(!result.ok){
          msgEl.innerHTML = '<p class="dev-error-msg">' + result.error + '</p>';
          return;
        }
        var msg = '<p class="dev-success-msg">✅ Imported feedback for ' + result.imported + ' course(s).</p>';
        if(result.warnings.length){ msg += '<ul class="dev-warn-list">' + result.warnings.map(function(w){ return '<li>' + w + '</li>'; }).join('') + '</ul>'; }
        msgEl.innerHTML = msg;
        document.getElementById('devFeedbackJsonInput').value = '';
      });
    }
  }

  function openDialog(){
    openCount++;
    lastWrong = false;
    document.getElementById('devModalOverlay').classList.add('open');
    renderBody();
  }
  function closeDialog(){
    document.getElementById('devModalOverlay').classList.remove('open');
  }

  function bind(){
    var overlay = document.getElementById('devModalOverlay');
    var closeBtn = document.getElementById('devModalClose');
    if(!overlay) return;
    if(closeBtn) closeBtn.addEventListener('click', closeDialog);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) closeDialog(); });
    var card = overlay.querySelector('.modal-card');
    if(card) card.addEventListener('click', function(e){ e.stopPropagation(); });
  }
  if(document.readyState === 'complete'){ bind(); }
  else { window.addEventListener('load', bind); }

  window.AAUP_DEV = { openDialog: openDialog, closeDialog: closeDialog, isAuthenticated: function(){ return authenticated; } };
})();
