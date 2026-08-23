// ==========================
// FIRST-RUN LANDING
// ==========================
// The first thing a new student sees. One screen: the name, one line of what
// the app is, and the choice of signing in or not.
//
// It used to be a four-step wizard — welcome, cloud, theme, ready — three of
// whose steps a student had to tap through before reaching anything, and the
// welcome and ready steps existed only to say hello and goodbye. Theme
// belongs in Settings, where it already is. What is left is the one thing
// that genuinely has to happen before the app can be useful, which is whether
// this student's progress lives on this device or on their account.
//
// Shown once, on the same "brand-new student" signal AAUP_STUDENT already
// used for its own popup (js/15-student.js), which no longer opens itself.
(function(){
  var STEPS = [];
  var index = 0;
  var mode = 'in';        // the sign-in panel: 'in' or 'up'

  // ---- language ----------------------------------------------------------
  // The app's per-plan toggleLang() switches one plan page. The landing
  // screen is not a plan page and comes BEFORE one is chosen, so it needs a
  // choice of its own — stored, so the About page (and anything added later)
  // can read it instead of asking again.
  var LANG_KEY = 'aaup_lang';
  function lang(){
    try{ return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en'; }catch(e){ return 'en'; }
  }
  function setLang(v){
    try{ localStorage.setItem(LANG_KEY, v); }catch(e){}
    document.documentElement.setAttribute('lang', v);
    document.documentElement.setAttribute('dir', v === 'ar' ? 'rtl' : 'ltr');
  }
  var TX = {
    en: { line: 'Every course in your degree, and where you are on it.',
          signIn: 'Sign in', start: 'Start', notNow: 'Not now',
          note: 'Free, offline, and made by a student. Always confirm with your academic advisor.',
          other: 'العربية' },
    ar: { line: 'كل مساق في تخصصك، وأين أنت منه.',
          signIn: 'تسجيل الدخول', start: 'ابدأ', notNow: 'ليس الآن',
          note: 'مجاني، يعمل بدون إنترنت، ومن صنع طالب. تأكّد دائمًا من مرشدك الأكاديمي.',
          other: 'English' }
  };
  function t(){ return TX[lang()]; }

  // The campus, drawn. A photograph would be a fixed rectangle that fights
  // every theme it is shown on; this is one stroke colour the theme sets, so
  // it belongs to whatever palette is running. It is the two things on AAUP's
  // own campus a student recognises from the road: the arched clock-tower
  // gate, and the faceted glass faculty building beside it — with the walkway
  // running up to them, which is the "path" the app is named for.
  function campusSvg(){
    return '<svg class="wiz-campus" viewBox="0 0 400 220" fill="none" aria-hidden="true" focusable="false">' +
      // walkway, converging toward the gate
      '<path d="M96 220 L176 118 M304 220 L224 118" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M140 176 H260 M124 198 H276" stroke="currentColor" stroke-width="1" opacity=".55"/>' +
      // ground line
      '<path d="M8 118 H392" stroke="currentColor" stroke-width="1" opacity=".45"/>' +
      // clock-tower gate: base, pointed arch, clock, cap
      '<path d="M176 118 V54 h48 v64" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M190 118 V86 q10 -13 20 0 v32" stroke="currentColor" stroke-width="1.3"/>' +
      '<circle cx="200" cy="64" r="7.5" stroke="currentColor" stroke-width="1.3"/>' +
      '<path d="M200 60 v4.5 h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
      '<path d="M170 54 h60 l-8 -9 h-44 z" stroke="currentColor" stroke-width="1.3"/>' +
      // faceted faculty building, right
      '<path d="M252 118 V78 l44 -22 v62 z" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M252 96 l44 -14 M266 118 V72 M282 118 V64" stroke="currentColor" stroke-width="1" opacity=".6"/>' +
      // low block, left
      '<path d="M104 118 V88 h44 v30" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M116 118 V100 h8 v18 M136 118 V100 h8 v18" stroke="currentColor" stroke-width="1" opacity=".6"/>' +
      // flag poles
      '<path d="M320 118 V52 M334 118 V60" stroke="currentColor" stroke-width="1.1" opacity=".7"/>' +
      '<path d="M320 52 h16 v9 h-16 M334 60 h13 v8 h-13" stroke="currentColor" stroke-width="1" opacity=".7"/>' +
      '</svg>';
  }

  function buildSteps(){
    // One screen when there is nothing to sign into, two when there is.
    return (window.AAUP_CLOUD && window.AAUP_CLOUD.isConfigured())
      ? ['landing', 'cloud']
      : ['landing'];
  }

  function overlay(){ return document.getElementById('onboardingWizardOverlay'); }
  function body(){ return document.getElementById('onboardingWizardBody'); }

  function stepData(i){
    if(STEPS[i] === 'landing'){
      var cloud = window.AAUP_CLOUD && window.AAUP_CLOUD.isConfigured();
      return {
        landing: true,
        primary: cloud ? t().signIn : t().start,
        secondary: cloud ? t().notNow : ''
      };
    }
    return {
      title: mode === 'up' ? 'Create your account' : 'Sign in',
      sub: 'Your progress, grades and plans follow you to any device.',
      content:
        '<div class="wiz-fields">' +
        '<input type="text" id="wizCloudIdentifier" placeholder="Email" autocomplete="username" inputmode="email">' +
        '<input type="password" id="wizCloudPassword" placeholder="Password" autocomplete="' +
          (mode === 'up' ? 'new-password' : 'current-password') + '">' +
        (mode === 'up'
          ? '<input type="text" id="wizCloudSignUpUsername" placeholder="Name (optional)" autocomplete="nickname">'
          : '') +
        '</div>' +
        '<div id="wizCloudMsg"></div>' +
        '<button type="button" class="wiz-switch" id="wizCloudToggleSignUp">' +
          (mode === 'up' ? 'I already have an account' : 'Create one instead') +
        '</button>',
      primary: mode === 'up' ? 'Create account' : 'Sign in',
      secondary: 'Not now'
    };
  }

  function render(){
    var b = body();
    if(!b) return;
    var s = stepData(index);
    if(s.landing){
      // The whole screen is the name and the choice. No progress bar, no step
      // count, no paragraph of welcome — there is nothing here to be partway
      // through.
      var tx = t();
      b.innerHTML =
        '<div class="wiz-landing" dir="' + (lang() === 'ar' ? 'rtl' : 'ltr') + '">' +
          campusSvg() +
          '<button type="button" class="wiz-lang" id="wizLangToggle" lang="' +
            (lang() === 'ar' ? 'en' : 'ar') + '">' + tx.other + '</button>' +
          '<div class="wiz-brand">' +
            '<img class="wiz-brand-mark" src="assets/icons/icon-any-384.png" alt="">' +
            '<div class="wiz-brand-name">AAUPATH</div>' +
            '<div class="wiz-brand-ar" lang="ar" dir="rtl">طريقك</div>' +
          '</div>' +
          '<p class="wiz-landing-line">' + window.__escapeHtml(tx.line) + '</p>' +
          '<div class="wiz-landing-actions">' +
            '<button type="button" class="wiz-continue" id="onboardingContinue">' + window.__escapeHtml(s.primary) + '</button>' +
            (s.secondary ? '<button type="button" class="wiz-skip" id="onboardingSkip">' + window.__escapeHtml(s.secondary) + '</button>' : '') +
          '</div>' +
          '<p class="wiz-landing-note">' + window.__escapeHtml(tx.note) + '</p>' +
        '</div>';
    } else {
      b.innerHTML =
        '<div class="wiz-body">' +
          '<div class="wiz-title">' + s.title + '</div>' +
          '<div class="wiz-sub">' + s.sub + '</div>' +
          '<div class="wiz-content">' + s.content + '</div>' +
        '</div>' +
        '<div class="wiz-foot">' +
          '<button type="button" class="wiz-back" id="onboardingBack">← Back</button>' +
          '<button type="button" class="wiz-continue" id="onboardingContinue">' + s.primary + '</button>' +
        '</div>' +
        '<button type="button" class="wiz-skip-link" id="onboardingSkip">' + s.secondary + '</button>';
    }
    bindStep();
  }

  function showCloudMsg(text, isError){
    var el = document.getElementById('wizCloudMsg');
    if(!el) return;
    el.innerHTML = '<p class="' + (isError ? 'dev-error-msg' : 'form-note') + '">' + window.__escapeHtml(text) + '</p>';
  }

  // Sign in and sign up are the same panel with one field's difference, so
  // they are one form with a mode rather than two stacked forms where a
  // hidden one used to sit under a toggle.
  function submitCloud(btn){
    var idEl = document.getElementById('wizCloudIdentifier');
    var pwEl = document.getElementById('wizCloudPassword');
    if(!idEl || !pwEl || !window.AAUP_CLOUD) return;
    var identifier = (idEl.value || '').trim();
    var password = pwEl.value || '';
    if(!identifier || !password){
      showCloudMsg(mode === 'up' ? 'Enter an email and a password.'
                                 : 'Enter your email and password.', true);
      return;
    }
    btn.disabled = true;
    if(mode === 'up'){
      var username = ((document.getElementById('wizCloudSignUpUsername') || {}).value || '').trim();
      window.AAUP_CLOUD.signUp(identifier, username, password).then(function(r){
        btn.disabled = false;
        if(!r.ok){ showCloudMsg((r.data && r.data.error) || 'Sign up failed.', true); return; }
        if(window.AAUP_STUDENT && window.AAUP_STUDENT.markSeen){ window.AAUP_STUDENT.markSeen(); }
        window.AAUP_CLOUD.startAutoSync();
        finish(true);             // a brand-new account has nothing to reconcile
      });
      return;
    }
    window.AAUP_CLOUD.signIn(identifier, password).then(function(r){
      btn.disabled = false;
      if(!r.ok){ showCloudMsg((r.data && r.data.error) || 'Sign in failed.', true); return; }
      // Marked seen BEFORE any reload reconcileAfterSignIn might trigger —
      // otherwise a reload mid-flow would start it over, since nothing else
      // marks first-run done on this path.
      if(window.AAUP_STUDENT && window.AAUP_STUDENT.markSeen){ window.AAUP_STUDENT.markSeen(); }
      window.AAUP_CLOUD.reconcileAfterSignIn(false, function(res){
        window.AAUP_CLOUD.startAutoSync();
        if(res.reload){ location.reload(); return; }
        finish(true);
      });
    });
  }

  function bindCloudStep(){
    var toggle = document.getElementById('wizCloudToggleSignUp');
    if(toggle){
      toggle.addEventListener('click', function(){
        mode = mode === 'up' ? 'in' : 'up';
        render();
      });
    }
    var pw = document.getElementById('wizCloudPassword');
    if(pw){
      pw.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
          e.preventDefault();
          var btn = document.getElementById('onboardingContinue');
          if(btn) btn.click();
        }
      });
    }
  }

  function finish(celebrate){
    if(window.AAUP_STUDENT && window.AAUP_STUDENT.markSeen){ window.AAUP_STUDENT.markSeen(); }
    var ov = overlay();
    if(ov) ov.classList.remove('open');
    if(window.__renderWelcomeMessages) window.__renderWelcomeMessages();
    // Confetti for signing in or starting, not for declining. Firing it on
    // "Not now" celebrated the student saying no.
    if(celebrate && window.__confetti) window.__confetti();
  }

  function bindStep(){
    var langBtn = document.getElementById('wizLangToggle');
    if(langBtn){
      langBtn.addEventListener('click', function(){
        setLang(lang() === 'ar' ? 'en' : 'ar');
        render();
      });
    }
    var skip = document.getElementById('onboardingSkip');
    var back = document.getElementById('onboardingBack');
    var cont = document.getElementById('onboardingContinue');
    if(skip) skip.addEventListener('click', function(){ finish(false); });
    if(back) back.addEventListener('click', function(){ index = Math.max(0, index - 1); render(); });
    if(cont) cont.addEventListener('click', function(){
      if(STEPS[index] === 'cloud'){ submitCloud(cont); return; }
      if(index >= STEPS.length - 1){ finish(true); return; }
      index++; render();
    });
    if(STEPS[index] === 'cloud'){ bindCloudStep(); }
  }

  function open(){
    setLang(lang());   // stamp <html lang/dir> from the stored choice
    STEPS = buildSteps();
    index = 0;
    mode = 'in';
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
