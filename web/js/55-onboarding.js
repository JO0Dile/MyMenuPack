// ==========================
// FIRST-RUN WIZARD
// ==========================
// A single guided flow — welcome, optional cloud sign-in, theme, ready —
// shown once on the exact "brand-new student" signal AAUP_STUDENT already
// used for its own popup (js/15-student.js), which no longer opens itself:
// this wizard is now the one thing that greets a first-time visitor, so two
// separate uncoordinated popups don't stack on top of each other.
(function(){
  var STEPS = [];
  var index = 0;

  function buildSteps(){
    var steps = ['welcome'];
    if(window.AAUP_CLOUD && window.AAUP_CLOUD.isConfigured()){ steps.push('cloud'); }
    steps.push('theme', 'ready');
    return steps;
  }

  function overlay(){ return document.getElementById('onboardingWizardOverlay'); }
  function body(){ return document.getElementById('onboardingWizardBody'); }

  function themeSwatchesHtml(){
    if(!window.AAUP_THEME) return '';
    var current = window.AAUP_THEME.current();
    return window.AAUP_THEME.list().map(function(t){
      var active = t.id === current;
      return '<button type="button" class="theme-swatch' + (active ? ' theme-swatch-active' : '') +
        '" data-wiz-theme="' + t.id + '" style="--sw-bg:' + t.bg + ';--sw-accent:' + t.accent + ';" aria-pressed="' + active + '">' +
        '<span class="theme-swatch-preview"></span>' +
        '<span class="theme-swatch-label"><span>' + t.icon + ' ' + t.en + '</span><span class="theme-swatch-check">✓</span></span>' +
        '</button>';
    }).join('');
  }

  function stepData(i){
    if(STEPS[i] === 'welcome'){
      return {
        icon: '<img class="wiz-mascot" src="assets/icons/icon-any-192.png" alt="">',
        title: 'Welcome to University Easy Plans',
        sub: 'Free, offline, made by a student. A couple of quick things and you’re set.',
        content: '',
        primary: 'Continue →'
      };
    }
    if(STEPS[i] === 'cloud'){
      return {
        icon: '🗄️',
        title: 'Sync your progress',
        sub: 'Optional — sign in and your progress, grades, and plans follow you to a new device. You can always do this later from Settings.',
        content:
          '<div class="form-field-row" style="flex-wrap:wrap;">' +
          '<div class="form-field"><input type="text" id="wizCloudIdentifier" placeholder="Email or username" autocomplete="username"></div>' +
          '<div class="form-field"><input type="password" id="wizCloudPassword" placeholder="Password" autocomplete="current-password"></div>' +
          '</div>' +
          '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
          '<button type="button" class="home-btn" id="wizCloudSignIn" style="border-color:var(--accent);color:var(--text);">🔓 Sign in</button>' +
          '<button type="button" class="home-btn" id="wizCloudToggleSignUp">➕ Sign up</button>' +
          '</div>' +
          '<div id="wizCloudSignUpBox" style="display:none;margin-top:10px;">' +
          '<div class="form-field"><input type="text" id="wizCloudSignUpUsername" placeholder="Username (optional)" autocomplete="username"></div>' +
          '<div class="form-actions" style="justify-content:flex-start;">' +
          '<button type="button" class="home-btn" id="wizCloudSignUpBtn" style="border-color:var(--accent);color:var(--text);">➕ Create account</button>' +
          '</div></div>' +
          '<div id="wizCloudMsg"></div>',
        primary: 'Continue →'
      };
    }
    if(STEPS[i] === 'theme'){
      return {
        icon: '🎨',
        title: 'Pick a look you like',
        sub: 'Tap one to preview it live — you can always change this later in Settings.',
        content: '<div class="theme-picker-grid" role="group" aria-label="Theme">' + themeSwatchesHtml() + '</div>',
        primary: 'Continue →'
      };
    }
    return {
      icon: '🚀',
      title: 'You’re all set!',
      sub: 'Search for your major above, or browse universities and colleges below to find your study plan.',
      content: '',
      primary: 'Let’s go →'
    };
  }

  function render(){
    var b = body();
    if(!b) return;
    var s = stepData(index);
    var pct = Math.round(((index + 1) / STEPS.length) * 100);
    b.innerHTML =
      '<div class="wiz-progress"><span style="width:' + pct + '%;"></span></div>' +
      '<button type="button" class="wiz-skip-link" id="onboardingSkip">Skip setup</button>' +
      '<div class="wiz-body">' +
        '<div class="wiz-ic">' + s.icon + '</div>' +
        '<div class="wiz-title">' + s.title + '</div>' +
        '<div class="wiz-sub">' + s.sub + '</div>' +
        (s.content ? '<div class="wiz-content">' + s.content + '</div>' : '') +
      '</div>' +
      '<div class="wiz-foot">' +
        (index > 0 ? '<button type="button" class="wiz-back" id="onboardingBack">← Back</button>' : '<span></span>') +
        '<button type="button" class="wiz-continue" id="onboardingContinue">' + s.primary + '</button>' +
      '</div>';
    bindStep();
  }

  function showCloudMsg(text, isError){
    var el = document.getElementById('wizCloudMsg');
    if(!el) return;
    el.innerHTML = '<p class="' + (isError ? 'dev-error-msg' : 'form-note') + '">' + window.__escapeHtml(text) + '</p>';
  }

  function bindCloudStep(){
    var idEl = document.getElementById('wizCloudIdentifier');
    var pwEl = document.getElementById('wizCloudPassword');
    var signInBtn = document.getElementById('wizCloudSignIn');
    var toggleBtn = document.getElementById('wizCloudToggleSignUp');
    var signUpBox = document.getElementById('wizCloudSignUpBox');
    var signUpBtn = document.getElementById('wizCloudSignUpBtn');
    if(!signInBtn || !window.AAUP_CLOUD) return;

    if(toggleBtn){
      toggleBtn.addEventListener('click', function(){
        signUpBox.style.display = signUpBox.style.display === 'none' ? 'block' : 'none';
      });
    }
    signInBtn.addEventListener('click', function(){
      var identifier = (idEl.value || '').trim();
      var password = pwEl.value || '';
      if(!identifier || !password){ showCloudMsg('Enter your email/username and password.', true); return; }
      signInBtn.disabled = true;
      window.AAUP_CLOUD.signIn(identifier, password).then(function(r){
        signInBtn.disabled = false;
        if(!r.ok){ showCloudMsg((r.data && r.data.error) || 'Sign in failed.', true); return; }
        // Mark the wizard seen BEFORE any reload reconcileAfterSignIn might
        // trigger — otherwise a reload mid-wizard would re-trigger it from
        // step 1, since nothing else marks first-run done on this path.
        if(window.AAUP_STUDENT && window.AAUP_STUDENT.markSeen){ window.AAUP_STUDENT.markSeen(); }
        window.AAUP_CLOUD.reconcileAfterSignIn(false, function(res){
          window.AAUP_CLOUD.startAutoSync();
          if(res.reload){ location.reload(); return; }
          index++; render();
        });
      });
    });
    if(signUpBtn){
      signUpBtn.addEventListener('click', function(){
        var email = (idEl.value || '').trim();
        var username = ((document.getElementById('wizCloudSignUpUsername') || {}).value || '').trim();
        var password = pwEl.value || '';
        if(!email || !password){ showCloudMsg('Enter an email and password.', true); return; }
        signUpBtn.disabled = true;
        window.AAUP_CLOUD.signUp(email, username, password).then(function(r){
          signUpBtn.disabled = false;
          if(!r.ok){ showCloudMsg((r.data && r.data.error) || 'Sign up failed.', true); return; }
          if(window.AAUP_STUDENT && window.AAUP_STUDENT.markSeen){ window.AAUP_STUDENT.markSeen(); }
          window.AAUP_CLOUD.startAutoSync();
          index++; render(); // a brand-new account has nothing to reconcile
        });
      });
    }
  }

  function finish(){
    if(window.AAUP_STUDENT && window.AAUP_STUDENT.markSeen){ window.AAUP_STUDENT.markSeen(); }
    var ov = overlay();
    if(ov) ov.classList.remove('open');
    if(window.__renderWelcomeMessages) window.__renderWelcomeMessages();
    if(window.__confetti) window.__confetti();
  }

  function bindStep(){
    var skip = document.getElementById('onboardingSkip');
    var back = document.getElementById('onboardingBack');
    var cont = document.getElementById('onboardingContinue');
    if(skip) skip.addEventListener('click', finish);
    if(back) back.addEventListener('click', function(){ index = Math.max(0, index - 1); render(); });
    if(cont) cont.addEventListener('click', function(){
      if(index >= STEPS.length - 1){ finish(); return; }
      index++; render();
    });
    if(STEPS[index] === 'cloud'){ bindCloudStep(); }
    document.querySelectorAll('[data-wiz-theme]').forEach(function(el){
      el.addEventListener('click', function(){
        var id = el.getAttribute('data-wiz-theme');
        if(window.AAUP_THEME) window.AAUP_THEME.setTheme(id);
        document.querySelectorAll('[data-wiz-theme]').forEach(function(sw){
          sw.classList.toggle('theme-swatch-active', sw === el);
        });
      });
    });
  }

  function open(){
    STEPS = buildSteps();
    index = 0;
    var ov = overlay();
    if(!ov) return;
    ov.classList.add('open');
    render();
  }

  function init(){
    if(window.AAUP_STUDENT && window.AAUP_STUDENT.isFirstRun && window.AAUP_STUDENT.isFirstRun()){ open(); }
  }

  window.AAUP_ONBOARDING = { open: open };

  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
