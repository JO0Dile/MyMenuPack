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
    { key: 'roadmap', icon: '🧭', label: 'My Path', action: function(prefix){ if(window.AAUP_ROADMAP) window.AAUP_ROADMAP.open(prefix); } },
    { key: 'audit', icon: '📋', label: 'Degree Audit & GPA', action: function(prefix){ window.AAUP_AUDIT.open(prefix); } },
    // Sits with the GPA screen it plays with, not at the bottom of the
    // list: a student opens the audit, sees a number they do not like,
    // and the next thing they want is right there.
    { key: 'whatif', icon: '🎯', label: 'What if… (GPA)', action: function(prefix){ if(window.AAUP_WHATIF) window.AAUP_WHATIF.open(prefix); } },
    { key: 'achievements', icon: '🏆', label: 'Achievements', action: function(prefix){ window.AAUP_ACHIEVEMENTS.open(prefix); } },
    { key: 'advisor', icon: '🧠', label: 'Plan My Next Semester', action: function(prefix){ window.AAUP_ADVISOR.open(prefix); } },
    { key: 'overview', icon: '🖨️', label: 'Overview & Print', action: function(prefix){ if(window.AAUP_OVERVIEW) window.AAUP_OVERVIEW.open(prefix); } },
    // The one place in the app where students talk to each other rather than
    // to their own data — so it sits with the rest of the plan's screens, not
    // hidden behind a floating button nobody presses.
    { key: 'thoughts', icon: '💭', label: 'Student Thoughts', action: function(prefix){ if(window.AAUP_THOUGHTS) window.AAUP_THOUGHTS.open(prefix); } },
    { key: 'contacts', icon: '📇', label: 'Contacts', action: function(prefix){ if(window.AAUP_CONTACTS) window.AAUP_CONTACTS.open(prefix); } },
    // Not the same thing as "Switch Plan" at the bottom, which only reopens
    // the picker. This one answers the question first: what happens to my
    // progress if I move?
    { key: 'changeplan', icon: '🔀', label: 'Change Major', action: function(prefix){ if(window.AAUP_CHANGE_PLAN) window.AAUP_CHANGE_PLAN.open(prefix); } }
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
    // Visibility is CSS-driven (body.has-sidebar + the phone breakpoint),
    // deliberately not an inline style here — an inline display would beat
    // that media query on desktop and force the bar to show everywhere.
    ensureTabBar();
    syncTabBar(prefix, activeKey);
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

  // ---------------------------------------------------------------------
  // PHONE BOTTOM TAB BAR — the same navigation as the sidebar above, in the
  // shape a thumb actually wants on a phone. Not a rewrite: every tab calls
  // the exact same action a sidebar item already does (or, for "More",
  // opens the sidebar itself as a drawer) — this is a second way to reach
  // the same four most-used destinations, not a second navigation model.
  // Hidden by CSS above 720px, so desktop is untouched.
  //
  // Icons deliberately reuse ones already meaningful elsewhere in the app
  // rather than inventing new ones: 🗺️ is "My Study Plan" in this very
  // sidebar, 💬 is the assistant's own launcher bubble, and ☰ is the exact
  // glyph that already opens this sidebar as a drawer on phone.
  var TABS = [
    { key: 'dashboard', icon: '🏠', label: 'Dashboard', action: function(prefix){ window.AAUP_DASHBOARD.open(prefix); } },
    { key: 'studyplan', icon: '🗺️', label: 'Plan', action: function(prefix){ window.AAUP_DASHBOARD.openStudyPlan(prefix); } },
    { key: 'assistant', icon: '💬', label: 'Assistant', action: function(){ if(window.AAUP_ASSISTANT_UI) window.AAUP_ASSISTANT_UI.open(); } },
    { key: 'more', icon: '☰', label: 'More', action: function(){ toggleMobile(); } }
  ];

  function ensureTabBar(){
    var bar = document.getElementById('sbTabBar');
    if(bar) return bar;
    bar = document.createElement('div');
    bar.id = 'sbTabBar';
    bar.className = 'sb-tabbar';
    bar.innerHTML = TABS.map(function(tItem){
      return '<button type="button" class="sb-tab" data-sb-tab="' + tItem.key + '">' +
        '<span class="sb-tab-ic">' + tItem.icon + (tItem.key === 'dashboard' ? '<span class="sb-tab-badge" id="sbTabProgress" hidden></span>' : '') + '</span>' +
        '<span class="sb-tab-lbl">' + tItem.label + '</span>' +
        '</button>';
    }).join('');
    document.body.appendChild(bar);
    bar.addEventListener('click', function(e){
      var btn = e.target.closest('[data-sb-tab]');
      if(!btn || !currentPrefix) return;
      var tItem = TABS.filter(function(x){ return x.key === btn.getAttribute('data-sb-tab'); })[0];
      if(tItem) tItem.action(currentPrefix);
    });
    return bar;
  }

  // The "mini persistent progress pill" idea, folded into the Dashboard tab
  // itself rather than added as a second floating element competing with
  // this same tab bar for the same corner of the screen — tapping it does
  // exactly what the idea asked for (jump back to the dashboard), and the
  // number is genuinely persistent since the tab bar itself always is.
  function syncTabProgress(prefix){
    var badge = document.getElementById('sbTabProgress');
    if(!badge) return;
    var rows = window.AAUP_AUDIT ? window.AAUP_AUDIT.computeAudit(prefix) : [];
    var total = 0, done = 0;
    rows.forEach(function(r){ total += r.total; done += r.completed; });
    if(total <= 0){ badge.hidden = true; return; }
    badge.textContent = Math.round((done / total) * 100) + '%';
    badge.hidden = false;
  }

  function syncTabBar(prefix, activeKey){
    var bar = ensureTabBar();
    bar.querySelectorAll('[data-sb-tab]').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-sb-tab') === activeKey);
    });
    syncTabProgress(prefix);
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

  // Grouped under four top tabs rather than one long scroll — this used to
  // be a single wall of buttons (theme, language, export/import/reset,
  // online plans, tours, cloud sync, device profiles all stacked one after
  // another) and finding any one setting meant scanning past all the
  // others. The active tab persists across re-renders within the same
  // modal session (every action here re-renders to reflect its own result,
  // e.g. toggling the theme), so acting on something never bounces the
  // student back to the first tab.
  var SETTINGS_TABS = [
    { key: 'account', icon: '👤', en: 'Account', ar: 'الحساب' },
    { key: 'prefs', icon: '🎨', en: 'Preferences', ar: 'التفضيلات' },
    { key: 'data', icon: '💾', en: 'Data', ar: 'البيانات' },
    { key: 'help', icon: '❓', en: 'Help', ar: 'مساعدة' }
  ];
  var activeSettingsTab = 'account';

  function accountTabHtml(r, current, others){
    return (window.AAUP_CLOUD ? window.AAUP_CLOUD.sectionHtml(r) : '') +
      '<h3 style="margin:18px 0 6px;">👤 ' + (r ? 'ملفات هذا الجهاز' : 'Device Profiles') + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' + (r
        ? 'مختلف عن المزامنة السحابية أعلاه: كل ملف هنا يبقى على هذا الجهاز فقط ولا يُزامَن — مفيد إذا كان أكثر من شخص يشارك هذا الجهاز، أو أردت ملفًا محليًا ثانيًا.'
        : 'Different from Cloud Sync above: each profile here stays on this device only and is never synced anywhere — useful if more than one person shares this device, or you want a second local profile of your own.') + '</p>' +
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
      '<div id="acctMsg"></div>';
  }

  function themePickerHtml(r){
    if(!window.AAUP_THEME) return '';
    var current = window.AAUP_THEME.current();
    var themes = window.AAUP_THEME.listAll ? window.AAUP_THEME.listAll() : window.AAUP_THEME.list();
    return '<h3 style="margin:0 0 6px;">🎨 ' + (r ? 'السمة' : 'Theme') + '</h3>' +
      '<div class="theme-picker-grid" role="group" aria-label="' + (r ? 'السمة' : 'Theme') + '">' +
      themes.map(function(t){
        var active = t.id === current;
        return '<button type="button" class="theme-swatch' + (active ? ' theme-swatch-active' : '') +
          '" data-theme-swatch="' + t.id + '" style="--sw-bg:' + t.bg + ';--sw-accent:' + t.accent + ';" aria-pressed="' + active + '">' +
          '<span class="theme-swatch-preview"></span>' +
          '<span class="theme-swatch-label"><span>' + t.icon + ' ' + (r ? t.ar : t.en) + '</span><span class="theme-swatch-check">✓</span></span>' +
          '</button>';
      }).join('') +
      '</div>' +
      (window.AAUP_THEME_CUSTOM ? window.AAUP_THEME_CUSTOM.sectionHtml(r) : '');
  }

  // How big the course cards read. Six themes shipped without any way to
  // make the text bigger, which left the plan grid at 12.5px for everyone.
  function sizePickerHtml(r){
    if(!window.AAUP_THEME || !window.AAUP_THEME.sizes) return '';
    var current = window.AAUP_THEME.currentSize();
    return '<h3 style="margin:18px 0 6px;">🔠 ' + (r ? 'حجم النص' : 'Reading size') + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' +
      (r ? 'يكبّر بطاقات المساقات في الخطة الدراسية.' : 'Makes the course cards in the study plan bigger or tighter.') +
      '</p>' +
      '<div class="size-picker" role="group" aria-label="' + (r ? 'حجم النص' : 'Reading size') + '">' +
      window.AAUP_THEME.sizes().map(function(sz){
        var active = sz.id === current;
        return '<button type="button" class="size-pick' + (active ? ' size-pick-active' : '') +
          '" data-size-pick="' + sz.id + '" aria-pressed="' + active + '">' +
          '<span style="font-size:' + Math.round(11 * sz.scale) + 'px;">Aa</span>' +
          '<span>' + (r ? sz.ar : sz.en) + '</span></button>';
      }).join('') +
      '</div>';
  }

  function prefsTabHtml(r, selectedPlan, isRtlNow){
    return themePickerHtml(r) + sizePickerHtml(r) +
      '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;margin-top:14px;">' +
      (selectedPlan ? '<button type="button" class="home-btn" id="setLangBtn">🌐 ' + (isRtlNow ? 'English' : 'العربية') + '</button>' : '') +
      '</div>';
  }

  function dataTabHtml(r, devUnlocked){
    return '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
      '<button type="button" class="home-btn" id="setExportBtn">📤 ' + (r ? 'تصدير التقدّم' : 'Export Progress') + '</button>' +
      '<button type="button" class="home-btn" id="setImportBtn">📥 ' + (r ? 'استيراد التقدّم' : 'Import Progress') + '</button>' +
      '<button type="button" class="home-btn" id="setResetBtn">🗑 ' + (r ? 'مسح كل البيانات' : 'Reset All Data') + '</button>' +
      '</div>' +
      (window.APP_PLANS_FEED_URL ? (
        '<h3 style="margin:18px 0 6px;">🌐 ' + (r ? 'الخطط عبر الإنترنت' : 'Online Plans') + '</h3>' +
        '<p class="form-note" style="margin-top:0;">' + (r ? 'يجلب الخطط الرسمية الجديدة والمحدَّثة عندما تكون متصلًا بالإنترنت. لا يُستبدَل أبدًا أي شيء عدّلته بنفسك.' : 'Pulls in new and updated official study plans when you’re online. Anything you’ve personally edited is never overwritten.') + '</p>' +
        '<div class="form-actions" style="justify-content:flex-start;">' +
        '<button type="button" class="home-btn" id="setSyncBtn">🔄 ' + (r ? 'التحقق من التحديثات' : 'Check for updates') + '</button>' +
        '</div>' +
        '<p class="form-note" id="setSyncStatus" style="margin-top:4px;">' + (window.AAUP_SYNC ? window.AAUP_SYNC.lastSyncLabel() : '') + '</p>'
      ) : '') +
      // Which server the wall talks to is a self-hosting/testing knob, not
      // a normal setting — the app already ships pointed at the real one,
      // so an ordinary student pasting a URL here can only ever break their
      // own wall (or point it somewhere they didn't mean to). Same
      // Developer Mode gate as the tour-replay button below already uses.
      (devUnlocked && window.AAUP_THOUGHTS && window.AAUP_THOUGHTS.settingsSectionHtml
        ? window.AAUP_THOUGHTS.settingsSectionHtml(r) : '') +
      (window.AAUP_CONTRIBUTE && window.AAUP_CONTRIBUTE.settingsSectionHtml
        ? window.AAUP_CONTRIBUTE.settingsSectionHtml(r) : '') +
      (window.AAUP_ORPHANS ? window.AAUP_ORPHANS.sectionHtml(r) : '');
  }

  // A small ✓/○ so the tour list doubles as a map of what's left — the
  // buttons themselves already jump straight to any tour (they always
  // have), the only thing missing was seeing which ones are done at a
  // glance instead of having to remember or replay each to check.
  function tourMark(id){
    var seen = !!(window.AAUP_TUTORIAL && window.AAUP_TUTORIAL.hasSeen(id));
    return '<span class="tour-mark' + (seen ? ' done' : '') + '">' + (seen ? '✓' : '○') + '</span>';
  }
  function helpTabHtml(r, selectedPlan, isImportedSelected, devUnlocked){
    return '<p class="form-note" style="margin-top:0;">' + (r ? 'أعد تشغيل الجولة التوضيحية لأي شاشة.' : 'Replay the spotlight walkthrough for any screen.') + '</p>' +
      '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
      '<button type="button" class="home-btn" id="setTourHomeBtn">' + tourMark('home') + ' ' + (r ? 'جولة الرئيسية' : 'Home tour') + '</button>' +
      (selectedPlan ? '<button type="button" class="home-btn" id="setTourDashBtn">' + tourMark('dashboard') + ' ' + (r ? 'جولة اللوحة' : 'Dashboard tour') + '</button>' : '') +
      (selectedPlan ? '<button type="button" class="home-btn" id="setTourPlanBtn">' + tourMark('studyplan') + ' ' + (r ? 'جولة الخطة الدراسية' : 'Study Plan tour') + '</button>' : '') +
      (isImportedSelected ? '<button type="button" class="home-btn" id="setTourEditBtn">' + tourMark('planEditor') + ' ' + (r ? 'جولة محرر الخطة' : 'Plan Editor tour') + '</button>' : '') +
      (devUnlocked ? '<button type="button" class="home-btn" id="setTourDevEditBtn">' + tourMark('devEdit') + ' ' + (r ? 'جولة تعديل المطوّر' : 'Developer Edit tour') + '</button>' : '') +
      '</div>';
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

    var tabContent = activeSettingsTab === 'prefs' ? prefsTabHtml(r, selectedPlan, isRtlNow)
      : activeSettingsTab === 'data' ? dataTabHtml(r, devUnlocked)
      : activeSettingsTab === 'help' ? helpTabHtml(r, selectedPlan, isImportedSelected, devUnlocked)
      : accountTabHtml(r, current, others);

    body.innerHTML =
      '<h2 style="margin-top:0;">⚙️ ' + (r ? 'الإعدادات' : 'Settings') + '</h2>' +
      '<div class="settings-tabbar">' +
      SETTINGS_TABS.map(function(t){
        return '<div class="settings-tab' + (t.key === activeSettingsTab ? ' active' : '') + '" data-settings-tab="' + t.key + '">' +
          '<span class="settings-tab-icon">' + t.icon + '</span><span>' + (r ? t.ar : t.en) + '</span></div>';
      }).join('') +
      '</div>' +
      '<div id="settingsTabContent">' + tabContent + '</div>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="setClose">' + (r ? 'إغلاق' : 'Close') + '</button></div>' +
      '<p class="form-note" style="text-align:center;opacity:.6;">v' + (window.APP_VERSION || '?') + ' · ' + (r ? 'مشروع طلابي مفتوح' : 'an open student project') + '</p>';

    document.getElementById('setClose').addEventListener('click', function(){ document.getElementById('devModalOverlay').classList.remove('open'); });
    body.querySelectorAll('[data-settings-tab]').forEach(function(tabEl){
      tabEl.addEventListener('click', function(){
        activeSettingsTab = tabEl.getAttribute('data-settings-tab');
        renderSettingsBody(body);
      });
    });
    if(window.AAUP_ORPHANS){
      window.AAUP_ORPHANS.bindSection(body, function(){ renderSettingsBody(body); });
    }
    if(window.AAUP_CLOUD){
      window.AAUP_CLOUD.bindSection(body);
    }
    if(window.AAUP_THEME_CUSTOM){
      window.AAUP_THEME_CUSTOM.bindSection(body, function(){ renderSettingsBody(body); });
    }
    if(window.AAUP_THOUGHTS && window.AAUP_THOUGHTS.bindSettingsSection){
      window.AAUP_THOUGHTS.bindSettingsSection(body, selectedPlan);
    }
    if(window.AAUP_CONTRIBUTE && window.AAUP_CONTRIBUTE.bindSettingsSection){
      window.AAUP_CONTRIBUTE.bindSettingsSection(body);
    }
    body.querySelectorAll('[data-theme-swatch]').forEach(function(el){
      el.addEventListener('click', function(){
        if(window.AAUP_THEME) window.AAUP_THEME.setTheme(el.getAttribute('data-theme-swatch'));
      });
    });
    body.querySelectorAll('[data-size-pick]').forEach(function(el){
      el.addEventListener('click', function(){
        if(window.AAUP_THEME && window.AAUP_THEME.setSize){
          window.AAUP_THEME.setSize(el.getAttribute('data-size-pick'));
          renderSettingsBody(body);   // repaint so the chosen size shows as picked
        }
      });
    });
    if(document.getElementById('setLangBtn')){
      document.getElementById('setLangBtn').addEventListener('click', function(){
        var isImported = !!(window.AAUP_IMPORTED && window.AAUP_IMPORTED.loadImportedPlans()[selectedPlan]);
        if(isImported){ window.AAUP_IMPORTED.toggleLang(selectedPlan); }
        else if(window.toggleLang){ window.toggleLang(selectedPlan); }
        renderSettingsBody(body); // refresh so the button label reflects the new state
      });
    }
    if(document.getElementById('setExportBtn')){
      document.getElementById('setExportBtn').addEventListener('click', function(){ if(window.AAUP_DATA) window.AAUP_DATA.exportData(); });
    }
    if(document.getElementById('setImportBtn')){
      document.getElementById('setImportBtn').addEventListener('click', function(){ if(window.AAUP_DATA) window.AAUP_DATA.triggerImport(); });
    }
    if(document.getElementById('setResetBtn')){
      document.getElementById('setResetBtn').addEventListener('click', function(){
        document.getElementById('devModalOverlay').classList.remove('open');
        if(window.AAUP_DATA) window.AAUP_DATA.confirmResetAll();
      });
    }
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
    if(document.getElementById('newAcctBtn')){
      document.getElementById('newAcctBtn').addEventListener('click', function(){
        if(!window.AAUP_ACCOUNTS) return;
        var name = document.getElementById('newAcctName').value;
        var msg = document.getElementById('acctMsg');
        var result = window.AAUP_ACCOUNTS.createAccount(name);
        if(!result.ok){ msg.innerHTML = '<p class="dev-error-msg">' + result.error + '</p>'; }
      });
    }
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

  // #devModalOverlay is the one overlay several unrelated features share —
  // Settings, the Course Library, the new-plan and course forms. Each of them
  // renders its own body into it and wires its own Close button, so none of
  // them owned the keyboard path and Escape did nothing in any of them. One
  // handler on the shared element covers every current and future user of it.
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    var overlay = document.getElementById('devModalOverlay');
    if(overlay && overlay.classList.contains('open')) overlay.classList.remove('open');
  });

  window.AAUP_SIDEBAR = { show: show, hide: hide, setActive: setActive, toggleMobile: toggleMobile, closeMobile: closeMobile, openSettings: openSettings };
  // Called from js/28-imported.js's own post-render hook chain (same one
  // js/69-phone-header.js's refresh already sits in) so the tab bar's
  // progress badge updates the moment a course gets checked, not only the
  // next time the sidebar itself is (re)shown.
  window.__refreshTabBarProgress = function(prefix){ if(currentPrefix === prefix) syncTabProgress(prefix); };
})();
