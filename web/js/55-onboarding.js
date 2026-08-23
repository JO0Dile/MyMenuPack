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
          // One button, both doors — the screen underneath offers "create one
          // instead", so a student with no account was being asked to press
          // something that read as if it were not for them.
          signIn: 'Sign in / Sign up', start: 'Start', notNow: 'Not now',
          note: 'Free, offline, and made by a student. Always confirm with your academic advisor.',
          other: 'العربية' },
    ar: { line: 'كل مساق في تخصصك، وأين أنت منه.',
          signIn: 'تسجيل الدخول / إنشاء حساب', start: 'ابدأ', notNow: 'ليس الآن',
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
  // ---------------------------------------------------------------------
  // THE PATH AND THE FOUNTAIN
  //
  // Not a picture of the university. The app is called AAUPath — طريقك —
  // and the two things it is about are the path you walk and the fountain
  // it walks up to, which is the thing every student on that campus knows.
  // So: the نافورة, and the path.
  //
  // Flat elevation, drawn straight on. Earlier versions of this put the
  // scene in perspective — a walkway converging to a vanishing point, the
  // pool as an ellipse, the faculty buildings receding behind — and a
  // three-quarter view rendered in one flat colour reads as a tangle of
  // lines rather than as a place. Everything here is square to the viewer:
  // the pool is a rectangle, the path is two parallel rails, nothing
  // converges and nothing is foreshortened.
  //
  // No buildings. They were the largest thing on screen and the least of
  // what this is about.
  function campusSvg(){
    var i, a;

    // ---- the clock: bezel, twelve markers, hands at ten past ten --------
    var CX = 200, CY = 74, face = '';
    for(i = 0; i < 12; i++){
      a = (i * 30 - 90) * Math.PI / 180;
      var quarter = i % 3 === 0;
      var r1 = quarter ? 9.4 : 10.8, r2 = 13;
      face += '<path d="M' + (CX + Math.cos(a) * r1).toFixed(1) + ' ' + (CY + Math.sin(a) * r1).toFixed(1) +
        ' L' + (CX + Math.cos(a) * r2).toFixed(1) + ' ' + (CY + Math.sin(a) * r2).toFixed(1) +
        '" stroke-width="' + (quarter ? 1.6 : .9) + '"/>';
    }

    // ---- the water, thrown up from the basin ---------------------------
    // Only outside the pavilion's own footprint. Drawn across the whole
    // basin they crossed the piers and the arches and read as scribble
    // rather than as water.
    var jets = '';
    [[76, 24], [54, 17], [32, 11]].forEach(function(j){
      var dx = j[0], h = j[1];
      ['-', '+'].forEach(function(sign){
        var x = sign === '-' ? 200 - dx : 200 + dx;
        var lean = sign === '-' ? 3 : -3;
        jets += '<path d="M' + x + ' 190 Q' + (x + lean) + ' ' + (190 - h * .7) +
                ' ' + (x + lean * 2) + ' ' + (190 - h) + '" stroke-width="1.1" opacity=".5"/>';
      });
    });

    // ---- the path: parallel rails, paved across -------------------------
    var paving = '';
    for(i = 0; i < 5; i++){
      var y = 216 + i * 9;
      paving += '<path d="M148 ' + y + ' H252" stroke-width="1" opacity="' + (0.42 - i * 0.07).toFixed(2) + '"/>';
    }

    return '<svg class="wiz-campus" viewBox="0 0 400 262" fill="none" ' +
      'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +

      // ================= the book on top =================================
      '<path d="M200 26 Q184 20 170 22 V38 Q184 36 200 42 Z" stroke-width="1.5"/>' +
      '<path d="M200 26 Q216 20 230 22 V38 Q216 36 200 42 Z" stroke-width="1.5"/>' +
      '<path d="M200 26 V42" stroke-width="1.2"/>' +
      '<path d="M178 27 Q188 26 196 29 M178 33 Q188 32 196 35 ' +
             'M222 27 Q212 26 204 29 M222 33 Q212 32 204 35" stroke-width=".8" opacity=".45"/>' +

      // ================= the clock stage ==================================
      '<path d="M182 42 h36 v6 h-36 z" stroke-width="1.3"/>' +
      '<path d="M170 48 h60 v52 h-60 z" stroke-width="1.9"/>' +
      '<circle cx="200" cy="74" r="14" stroke-width="1.9"/>' +
      '<circle cx="200" cy="74" r="11.2" stroke-width=".9" opacity=".5"/>' +
      face +
      '<path d="M200 74 L193.5 68" stroke-width="1.9"/>' +
      '<path d="M200 74 L208 69" stroke-width="1.4"/>' +
      '<circle cx="200" cy="74" r="1.4" fill="currentColor" stroke="none"/>' +

      // ================= the plaque =======================================
      '<path d="M158 100 h84 v26 h-84 z" stroke-width="1.8"/>' +
      '<path d="M166 108 h68 M166 114 h68 M166 120 h44" stroke-width=".9" opacity=".5"/>' +

      // ================= the canopy the arches carry ======================
      '<path d="M150 126 h100 v8 h-100 z" stroke-width="1.6"/>' +

      // ================= the arches, and the piers under them =============
      '<path d="M162 182 V150 Q162 138 179 132 Q196 138 196 150 V182" stroke-width="2"/>' +
      '<path d="M204 182 V150 Q204 138 221 132 Q238 138 238 150 V182" stroke-width="2"/>' +
      '<path d="M169 182 V152 Q169 144 179 139 Q189 144 189 152 V182" stroke-width=".9" opacity=".4"/>' +
      '<path d="M211 182 V152 Q211 144 221 139 Q231 144 231 152 V182" stroke-width=".9" opacity=".4"/>' +
      // capitals and bases, so the piers read as columns
      '<path d="M157 152 h10 v-6 h-10 z M191 152 h10 v-6 h-10 z ' +
             'M199 152 h10 v-6 h-10 z M233 152 h10 v-6 h-10 z" stroke-width="1"/>' +
      '<path d="M156 182 h12 v6 h-12 z M190 182 h12 v6 h-12 z ' +
             'M198 182 h12 v6 h-12 z M232 182 h12 v6 h-12 z" stroke-width="1"/>' +

      // ================= the fountain basin, square on ====================
      jets +
      '<path d="M104 190 h192 v22 h-192 z" stroke-width="2"/>' +
      '<path d="M110 197 h180" stroke-width="1" opacity=".45"/>' +
      '<path d="M96 190 h208" stroke-width="1.5"/>' +

      // ================= the path, leading up to it =======================
      '<path d="M148 212 V262 M252 212 V262" stroke-width="1.5"/>' +
      paving +
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
