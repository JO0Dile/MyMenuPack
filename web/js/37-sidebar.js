// ==========================
// APP SIDEBAR
// ==========================
// A persistent left-hand nav, shown whenever a plan is selected (Dashboard
// and My Study Plan alike), hidden on the Choose Plan screen. Every item
// routes to something that already exists — this is a navigation shell,
// not a new feature surface.
(function(){
  var BUILT_IN_ICONS = { robotics: '🤖', cybersecurity: '🔒', medical: '⚕️', cs: '💻' };

  function isImportedPlan(prefix){
    return !!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[prefix]);
  }
  function planName(prefix){
    if(isImportedPlan(prefix)){
      var p = window.AAUP_IMPORTED.loadImportedPlans()[prefix];
      var en = window.AAUP_IMPORTED.nameParts(p.majorName.en);
      return en.big;
    }
    var page = document.getElementById('page-' + prefix);
    var nameEl = page && page.querySelector('.title-block .en');
    return nameEl ? nameEl.textContent : prefix;
  }

  var ITEMS = [
    { key: 'dashboard', icon: '🏠', label: 'Dashboard', action: function(prefix){ window.AAUP_DASHBOARD.open(prefix); } },
    { key: 'studyplan', icon: '🗺️', label: 'My Study Plan', action: function(prefix){ window.AAUP_DASHBOARD.openStudyPlan(prefix); } },
    { key: 'audit', icon: '📋', label: 'Degree Audit & GPA', action: function(prefix){ window.AAUP_AUDIT.open(prefix); } },
    { key: 'achievements', icon: '🏆', label: 'Achievements', action: function(prefix){ window.AAUP_ACHIEVEMENTS.open(prefix); } },
    { key: 'advisor', icon: '🧠', label: 'Plan My Next Semester', action: function(prefix){ window.AAUP_ADVISOR.open(prefix); } },
    { key: 'overview', icon: '🖨️', label: 'Overview & Print', action: function(prefix){ if(window.AAUP_OVERVIEW) window.AAUP_OVERVIEW.open(prefix); } }
  ];

  var currentPrefix = null;

  function render(prefix, activeKey){
    var sidebar = document.getElementById('appSidebar');
    if(!sidebar) return;
    var name = planName(prefix);
    var icon = isImportedPlan(prefix) ? ((window.AAUP_IMPORTED.loadImportedPlans()[prefix] || {}).icon || '🎓') : (BUILT_IN_ICONS[prefix] || '🎓');

    var html = '<div class="sb-brand"><span class="sb-mark">' + icon + '</span><span>' + name + '</span></div>';
    html += ITEMS.map(function(item){
      return '<button type="button" class="sb-item' + (item.key === activeKey ? ' active' : '') + '" data-sb-key="' + item.key + '">' +
        '<span class="sb-icon">' + item.icon + '</span><span>' + item.label + '</span></button>';
    }).join('');
    if(isImportedPlan(prefix)){
      html += '<button type="button" class="sb-item" data-sb-key="library"><span class="sb-icon">📚</span><span>Course Library</span></button>';
    }
    html += '<div class="sb-spacer"></div>';
    html += '<div class="sb-switch"><button type="button" class="sb-item" data-sb-key="settings"><span class="sb-icon">⚙️</span><span>Settings</span></button>' +
      '<button type="button" class="sb-item" data-sb-key="switch"><span class="sb-icon">🔁</span><span>Switch Plan</span></button></div>';
    sidebar.innerHTML = html;

    sidebar.querySelectorAll('[data-sb-key]').forEach(function(el){
      el.addEventListener('click', function(){
        var key = el.getAttribute('data-sb-key');
        closeMobile();
        if(key === 'switch'){ window.AAUP_DASHBOARD.choosePlan(); return; }
        if(key === 'settings'){ openSettings(); return; }
        if(key === 'library'){ if(window.AAUP_IMPORTED) window.AAUP_IMPORTED.openLibrary(prefix); return; }
        var item = ITEMS.filter(function(i){ return i.key === key; })[0];
        if(item){ item.action(prefix); if(key !== 'dashboard' && key !== 'studyplan'){ setActive(key); } }
      });
    });
  }

  function setActive(key){
    var sidebar = document.getElementById('appSidebar');
    if(!sidebar) return;
    sidebar.querySelectorAll('.sb-item').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-sb-key') === key);
    });
  }

  function show(prefix, activeKey){
    currentPrefix = prefix;
    render(prefix, activeKey);
    document.getElementById('appSidebar').style.display = 'flex';
    document.getElementById('sbToggleBtn').style.display = '';
    document.body.classList.add('has-sidebar');
  }
  function hide(){
    currentPrefix = null;
    var sidebar = document.getElementById('appSidebar');
    if(sidebar) sidebar.style.display = 'none';
    var toggle = document.getElementById('sbToggleBtn');
    if(toggle) toggle.style.display = 'none';
    document.body.classList.remove('has-sidebar');
    closeMobile();
  }
  function toggleMobile(){
    var sidebar = document.getElementById('appSidebar');
    var overlay = document.getElementById('sbOverlay');
    var opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    overlay.classList.toggle('open', opening);
  }
  function closeMobile(){
    var sidebar = document.getElementById('appSidebar');
    var overlay = document.getElementById('sbOverlay');
    if(sidebar) sidebar.classList.remove('open');
    if(overlay) overlay.classList.remove('open');
  }

  // A small settings modal consolidating theme/export/import/reset — the
  // same functions the original home-page footer buttons already call,
  // just reachable from inside a plan too instead of only from the picker.
  function openSettings(){
    var overlay = document.getElementById('devModalOverlay');
    var body = document.getElementById('devModalBody');
    if(!overlay || !body) return;
    renderSettingsBody(body);
    overlay.classList.add('open');
  }

  function renderSettingsBody(body){
    var accounts = window.AAUP_ACCOUNTS ? window.AAUP_ACCOUNTS.listAccounts() : [];
    var current = window.AAUP_ACCOUNTS ? window.AAUP_ACCOUNTS.currentAccount() : 'Default';
    var others = accounts.filter(function(a){ return a !== current; });
    var selectedPlan = window.AAUP_DASHBOARD ? window.AAUP_DASHBOARD.getSelected() : null;
    var isRtlNow = selectedPlan && window.__isRtl ? window.__isRtl(selectedPlan) : false;
    var isImportedSelected = !!(selectedPlan && window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[selectedPlan]);
    // Developer Mode's own unlock state is deliberately kept in memory only
    // (see AAUP_DEV's `authenticated` var) — re-locking on every reload is
    // the point. The dev-edit buttons it reveals are the one visible trace
    // of "unlocked this session" already on the page, so reuse that instead
    // of tracking a second flag just for gating this tour's replay button.
    var devEditBtn = document.querySelector('[data-dev-edit-btn]');
    var devUnlocked = !!(devEditBtn && devEditBtn.style.display !== 'none');

    // Settings is reachable from within a plan (its language) or from the
    // picker; follow the selected plan's language when there is one, English
    // otherwise. Everything user-facing below is bilingual.
    var r = isRtlNow;
    body.setAttribute('dir', r ? 'rtl' : 'ltr');
    body.innerHTML =
      '<h2 style="margin-top:0;">⚙️ ' + (r ? 'الإعدادات' : 'Settings') + '</h2>' +
      '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
      '<button type="button" class="home-btn" id="setThemeBtn">🌙 ' + (r ? 'تبديل السمة' : 'Toggle Theme') + '</button>' +
      (selectedPlan ? '<button type="button" class="home-btn" id="setLangBtn">🌐 ' + (isRtlNow ? 'English' : 'العربية') + '</button>' : '') +
      '<button type="button" class="home-btn" id="setExportBtn">📤 ' + (r ? 'تصدير التقدّم' : 'Export Progress') + '</button>' +
      '<button type="button" class="home-btn" id="setImportBtn">📥 ' + (r ? 'استيراد التقدّم' : 'Import Progress') + '</button>' +
      '<button type="button" class="home-btn" id="setResetBtn">🗑 ' + (r ? 'مسح كل البيانات' : 'Reset All Data') + '</button>' +
      '</div>' +
      (window.APP_PLANS_FEED_URL ? (
        '<h3 style="margin-bottom:6px;">🌐 ' + (r ? 'الخطط عبر الإنترنت' : 'Online Plans') + '</h3>' +
        '<p class="form-note" style="margin-top:0;">' + (r ? 'يجلب الخطط الرسمية الجديدة والمحدَّثة عندما تكون متصلًا بالإنترنت. لا يُستبدَل أبدًا أي شيء عدّلته بنفسك.' : 'Pulls in new and updated official study plans when you’re online. Anything you’ve personally edited is never overwritten.') + '</p>' +
        '<div class="form-actions" style="justify-content:flex-start;">' +
        '<button type="button" class="home-btn" id="setSyncBtn">🔄 ' + (r ? 'التحقق من التحديثات' : 'Check for updates') + '</button>' +
        '</div>' +
        '<p class="form-note" id="setSyncStatus" style="margin-top:4px;">' + (window.AAUP_SYNC ? window.AAUP_SYNC.lastSyncLabel() : '') + '</p>'
      ) : '') +
      '<h3 style="margin-bottom:6px;">❓ ' + (r ? 'الجولات التعريفية' : 'Tours') + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' + (r ? 'أعد تشغيل الجولة التوضيحية لأي شاشة.' : 'Replay the spotlight walkthrough for any screen.') + '</p>' +
      '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
      '<button type="button" class="home-btn" id="setTourHomeBtn">🔁 ' + (r ? 'جولة الرئيسية' : 'Home tour') + '</button>' +
      (selectedPlan ? '<button type="button" class="home-btn" id="setTourDashBtn">🔁 ' + (r ? 'جولة اللوحة' : 'Dashboard tour') + '</button>' : '') +
      (selectedPlan ? '<button type="button" class="home-btn" id="setTourPlanBtn">🔁 ' + (r ? 'جولة الخطة الدراسية' : 'Study Plan tour') + '</button>' : '') +
      (isImportedSelected ? '<button type="button" class="home-btn" id="setTourEditBtn">🔁 ' + (r ? 'جولة محرر الخطة' : 'Plan Editor tour') + '</button>' : '') +
      (devUnlocked ? '<button type="button" class="home-btn" id="setTourDevEditBtn">🔁 ' + (r ? 'جولة تعديل المطوّر' : 'Developer Edit tour') + '</button>' : '') +
      '</div>' +
      (window.AAUP_ORPHANS ? window.AAUP_ORPHANS.sectionHtml(r) : '') +
      '<h3 style="margin-bottom:6px;">👤 ' + (r ? 'الحسابات' : 'Accounts') + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' + (r ? '\u0643\u0644 \u062d\u0633\u0627\u0628 \u064a\u062d\u062a\u0641\u0638 \u0628\u062e\u0637\u0637\u0647 \u0648\u062a\u0642\u062f\u0651\u0645\u0647 \u0648\u0645\u0639\u062f\u0651\u0644\u0647 \u0628\u0634\u0643\u0644 \u0645\u0646\u0641\u0635\u0644 \u2014 \u0645\u0641\u064a\u062f \u0625\u0630\u0627 \u0643\u0627\u0646 \u0623\u0643\u062b\u0631 \u0645\u0646 \u0634\u062e\u0635 \u064a\u0634\u0627\u0631\u0643 \u0647\u0630\u0627 \u0627\u0644\u062c\u0647\u0627\u0632\u060c \u0623\u0648 \u0623\u0631\u062f\u062a \u0645\u0644\u0641\u064b\u0627 \u0634\u062e\u0635\u064a\u064b\u0627 \u062b\u0627\u0646\u064a\u064b\u0627.' : 'Each account keeps its own separate plans, progress, and GPA \u2014 useful if more than one person shares this device, or you want a second profile of your own.') + '</p>' +
      '<p style="font-size:12.5px;">' + (r ? 'الحساب الحالي: ' : 'Current account: ') + '<b>' + window.__escapeHtml(current) + '</b></p>' +
      (others.length
        ? '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
          others.map(function(a){
            return '<span class="acct-row">' +
              '<button type="button" class="home-btn acct-switch-btn" data-acct="' + window.__escapeHtml(a) + '">🔁 ' + (r ? 'التبديل إلى ' : 'Switch to ') + window.__escapeHtml(a) + '</button>' +
              '<button type="button" class="home-btn acct-delete-btn" data-acct="' + window.__escapeHtml(a) + '" aria-label="' + (r ? 'حذف الحساب' : 'Delete account') + '">🗑</button>' +
              '</span>';
          }).join('') + '</div>'
        : '') +
      '<div class="form-field-row">' +
      '<div class="form-field"><input type="text" id="newAcctName" maxlength="40" placeholder="' + (r ? 'اسم حساب جديد' : 'New account name') + '"></div>' +
      '<button type="button" class="home-btn" id="newAcctBtn" style="border-color:var(--accent);color:var(--text);align-self:flex-start;">➕ ' + (r ? 'إنشاء' : 'Create') + '</button>' +
      '</div>' +
      '<div id="acctMsg"></div>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="setClose">' + (r ? 'إغلاق' : 'Close') + '</button></div>' +
      '<p class="form-note" style="text-align:center;opacity:.6;">v' + (window.APP_VERSION || '?') + ' \u00b7 ' + (r ? '\u0645\u0634\u0631\u0648\u0639 \u0637\u0644\u0627\u0628\u064a \u0645\u0641\u062a\u0648\u062d' : 'an open student project') + '</p>';

    document.getElementById('setClose').addEventListener('click', function(){ document.getElementById('devModalOverlay').classList.remove('open'); });
    if(window.AAUP_ORPHANS){
      window.AAUP_ORPHANS.bindSection(body, function(){ renderSettingsBody(body); });
    }
    document.getElementById('setThemeBtn').addEventListener('click', function(){ if(window.AAUP_THEME) window.AAUP_THEME.toggle(); });
    if(document.getElementById('setLangBtn')){
      document.getElementById('setLangBtn').addEventListener('click', function(){
        var isImported = !!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[selectedPlan]);
        if(isImported){ window.AAUP_IMPORTED.toggleLang(selectedPlan); }
        else if(window.toggleLang){ window.toggleLang(selectedPlan); }
        renderSettingsBody(body); // refresh so the button label reflects the new state
      });
    }
    document.getElementById('setExportBtn').addEventListener('click', function(){ if(window.AAUP_DATA) window.AAUP_DATA.exportData(); });
    document.getElementById('setImportBtn').addEventListener('click', function(){ if(window.AAUP_DATA) window.AAUP_DATA.triggerImport(); });
    document.getElementById('setResetBtn').addEventListener('click', function(){
      document.getElementById('devModalOverlay').classList.remove('open');
      if(window.AAUP_DATA) window.AAUP_DATA.confirmResetAll();
    });
    if(document.getElementById('setSyncBtn')){
      document.getElementById('setSyncBtn').addEventListener('click', function(){
        var btn = document.getElementById('setSyncBtn');
        btn.disabled = true; btn.textContent = '🔄 Checking…';
        window.AAUP_SYNC.checkForUpdates(true).then(function(){
          renderSettingsBody(body);
        });
      });
    }
    if(document.getElementById('setTourHomeBtn')){
      document.getElementById('setTourHomeBtn').addEventListener('click', function(){
        document.getElementById('devModalOverlay').classList.remove('open');
        if(selectedPlan && window.AAUP_DASHBOARD){ window.AAUP_DASHBOARD.choosePlan(); }
        if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.replay('home'); }
      });
    }
    if(document.getElementById('setTourDashBtn')){
      document.getElementById('setTourDashBtn').addEventListener('click', function(){
        document.getElementById('devModalOverlay').classList.remove('open');
        if(window.AAUP_DASHBOARD){ window.AAUP_DASHBOARD.open(selectedPlan); }
        if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.replay('dashboard'); }
      });
    }
    if(document.getElementById('setTourPlanBtn')){
      document.getElementById('setTourPlanBtn').addEventListener('click', function(){
        document.getElementById('devModalOverlay').classList.remove('open');
        if(window.AAUP_DASHBOARD){ window.AAUP_DASHBOARD.openStudyPlan(selectedPlan); }
        if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.replay('studyplan'); }
      });
    }
    if(document.getElementById('setTourEditBtn')){
      document.getElementById('setTourEditBtn').addEventListener('click', function(){
        document.getElementById('devModalOverlay').classList.remove('open');
        if(window.AAUP_IMPORTED){
          window.AAUP_IMPORTED.open(selectedPlan);
          var page = document.getElementById('page-' + selectedPlan);
          if(page && !page.classList.contains('editing')){ window.AAUP_IMPORTED.toggleEdit(selectedPlan); }
        }
        if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.replay('planEditor'); }
      });
    }
    if(document.getElementById('setTourDevEditBtn')){
      document.getElementById('setTourDevEditBtn').addEventListener('click', function(){
        document.getElementById('devModalOverlay').classList.remove('open');
        var builtins = ['robotics', 'cybersecurity', 'medical', 'cs'];
        var prefix = builtins.indexOf(selectedPlan) !== -1 ? selectedPlan : 'robotics';
        if(window.AAUP_PLAN_EDITOR){ window.AAUP_PLAN_EDITOR.enterEditMode(prefix); }
        if(window.AAUP_TUTORIAL){ window.AAUP_TUTORIAL.replay('devEdit'); }
      });
    }

    document.querySelectorAll('.acct-switch-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(!window.AAUP_ACCOUNTS) return;
        var msg = document.getElementById('acctMsg');
        var result = window.AAUP_ACCOUNTS.switchTo(btn.getAttribute('data-acct'));
        if(!result.ok){ msg.innerHTML = '<p class="dev-error-msg">' + result.error + '</p>'; }
        // On success, switchTo() reloads the page — nothing further to do here.
      });
    });
    document.querySelectorAll('.acct-delete-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(!window.AAUP_ACCOUNTS) return;
        var acct = btn.getAttribute('data-acct');
        var msg = document.getElementById('acctMsg');
        // Deleting an account throws away everything it holds and there is no
        // undo, so the warning names the account and points at the export
        // first — the same escape hatch the switch failure suggests.
        var warn = r
          ? ('حذف الحساب «' + acct + '» نهائيًا؟ سيُحذف كل تقدّمه وعلاماته وخططه، ولا يمكن التراجع. صدّر نسخة احتياطية أولًا إن كنت غير متأكد.')
          : ('Permanently delete the account “' + acct + '”? All of its progress, grades and plans go with it, and this cannot be undone. Export a backup first if you’re unsure.');
        window.__showConfirmDialog(warn, function(){
          var result = window.AAUP_ACCOUNTS.deleteAccount(acct);
          if(!result.ok){ msg.innerHTML = '<p class="dev-error-msg">' + result.error + '</p>'; return; }
          renderSettingsBody(body);
          if(window.__showToast){ window.__showToast(r ? '🗑 تم حذف الحساب.' : '🗑 Account deleted.'); }
        }, r);
      });
    });
    document.getElementById('newAcctBtn').addEventListener('click', function(){
      if(!window.AAUP_ACCOUNTS) return;
      var name = document.getElementById('newAcctName').value;
      var msg = document.getElementById('acctMsg');
      var result = window.AAUP_ACCOUNTS.createAccount(name);
      if(!result.ok){ msg.innerHTML = '<p class="dev-error-msg">' + result.error + '</p>'; }
    });
  }

  // Catches direct navigation to a real major page that doesn't go through
  // the Dashboard (e.g. "Edit Mode" from the home card) so the sidebar
  // still appears with the right context, and hides it if the picker is
  // shown with nothing selected.
  var _origShowPage = window.showPage;
  if(typeof _origShowPage === 'function'){
    window.showPage = function(id){
      var result = _origShowPage(id);
      if(id !== 'home' && id !== '__imported__'){
        show(id, 'studyplan');
      } else if(id === 'home' && !(window.AAUP_DASHBOARD && window.AAUP_DASHBOARD.getSelected())){
        hide();
      }
      return result;
    };
  }

  window.AAUP_SIDEBAR = { show: show, hide: hide, setActive: setActive, toggleMobile: toggleMobile, closeMobile: closeMobile, openSettings: openSettings };
})();
