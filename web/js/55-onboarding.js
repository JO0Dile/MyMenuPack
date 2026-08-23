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
  // THE AAUP GATE, DRAWN
  //
  // Drawn rather than photographed so it takes the colour of whichever of
  // the six themes is running, and so it stays a few kilobytes.
  //
  // This is the real monument, not a generic clock tower: AAUP's gate stands
  // on an island in a fountain at the Jenin entrance. Reading it top to
  // bottom — the stone boat-shaped finial, the slab cap, the square shaft
  // with a white clock set into it, the wide dark dedication plaque under
  // that, the cornice, and then the pointed ogee arch between two slender
  // columns, with a stepped stone mass rising behind. The pool ring and its
  // jets sit at the base.
  //
  // To its right, the Faculty of Engineering: a triangulated dark-glass
  // prism cut like a gem, against the white block tower behind it. To the
  // left, the perimeter wall and the flag.
  //
  // Line weight carries the depth — 2.4 for what is nearest and 1 for what
  // is furthest — because a single-colour line drawing has nothing else to
  // separate foreground from background with.
  function campusSvg(){
    var i, a;

    // ---- clock face: bezel, twelve markers, hands at ten past ten -------
    var CX = 200, CY = 90;
    var face = '';
    for(i = 0; i < 12; i++){
      a = (i * 30 - 90) * Math.PI / 180;
      var quarter = i % 3 === 0;
      var r1 = quarter ? 8.8 : 10.1, r2 = 12.3;
      face += '<path d="M' + (CX + Math.cos(a) * r1).toFixed(1) + ' ' + (CY + Math.sin(a) * r1).toFixed(1) +
        ' L' + (CX + Math.cos(a) * r2).toFixed(1) + ' ' + (CY + Math.sin(a) * r2).toFixed(1) +
        '" stroke-width="' + (quarter ? 1.7 : 1) + '"/>';
    }

    // ---- fountain jets around the front of the pool ---------------------
    var jets = '';
    [[126, 6], [152, 9], [248, 9], [274, 6]].forEach(function(j){
      jets += '<path d="M' + j[0] + ' 214 v-' + (j[1] + 8) + '" stroke-width="1" opacity=".5"/>';
    });

    return '<svg class="wiz-campus" viewBox="0 0 460 250" fill="none" ' +
      'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +

      // ================= background: the plaza floor ====================
      '<path d="M0 216 H460" stroke-width="1.2" opacity=".5"/>' +
      '<path d="M92 232 H368 M60 246 H400" stroke-width="1" opacity=".28"/>' +

      // ================= left: perimeter wall, flag, lamp ===============
      '<path d="M0 178 H104 V216" stroke-width="1.3" opacity=".55"/>' +
      '<path d="M0 194 H104" stroke-width="1" opacity=".35"/>' +
      '<path d="M26 216 V198 h13 v18 M60 216 V198 h13 v18" stroke-width="1" opacity=".35"/>' +
      // flag pole, with the Palestinian flag: a rectangle and its hoist triangle
      '<path d="M84 216 V96" stroke-width="1.5" opacity=".8"/>' +
      '<path d="M84 98 h34 v21 h-34" stroke-width="1.4" opacity=".8"/>' +
      '<path d="M84 98 L103 108.5 L84 119" stroke-width="1.2" opacity=".8"/>' +
      // street lamp
      '<path d="M40 216 V140 q0 -11 11 -11 h9" stroke-width="1.2" opacity=".5"/>' +
      '<path d="M55 129 h11 l-2 6 h-7 z" stroke-width="1.1" opacity=".5"/>' +

      // ================= right: the faceted faculty building ============
      // white block tower standing behind the glass
      '<path d="M300 216 V104 h30 v112" stroke-width="1.3" opacity=".45"/>' +
      '<path d="M306 124 l9 -12 9 12 z M306 152 l9 -12 9 12 z M306 180 l9 -12 9 12 z" ' +
        'stroke-width="1" opacity=".4"/>' +
      // the glass prism, cut like a gem
      '<path d="M312 216 V158 L366 118 L438 152 V216 Z" stroke-width="2.1"/>' +
      '<path d="M312 158 L370 190 L438 152" stroke-width="1.4" opacity=".8"/>' +
      '<path d="M366 118 L370 190" stroke-width="1.4" opacity=".8"/>' +
      '<path d="M339 138 L339 203 M404 135 L404 203" stroke-width="1" opacity=".45"/>' +
      '<path d="M312 216 L370 190 L438 216" stroke-width="1" opacity=".45"/>' +
      // the diagonal glazing that gives the facade its triangles
      '<path d="M339 138 L370 190 L404 135" stroke-width="1" opacity=".3"/>' +
      // the red V sculpture at its foot, in outline
      '<path d="M352 216 L361 192 M380 216 L371 192" stroke-width="1.7" opacity=".65"/>' +

      // ================= centre: the gate ===============================
      // Proportions taken off the photographs rather than invented: the
      // monument is BROAD. The arch block is wider than it is tall, the
      // clock shaft on top of it is short, and the whole thing above the
      // water is about as wide as it is high. Drawn slender it read as a
      // European church tower, which is not what stands at the Jenin gate.

      // stepped stone wings rising behind the gate, low and wide
      '<path d="M252 216 V158 h20 v16 h18 v20 h12 v22" stroke-width="1.2" opacity=".5"/>' +
      '<path d="M148 216 V162 h-20 v18 h-16 v36" stroke-width="1.2" opacity=".5"/>' +

      // podium standing in the water
      '<path d="M140 216 V200 h120 v16" stroke-width="1.9"/>' +
      '<path d="M146 200 h108" stroke-width="1" opacity=".45"/>' +

      // arch block
      '<path d="M148 200 V142 h104 v58" stroke-width="2.4"/>' +
      // the pointed ogee arch, with its inner reveal
      '<path d="M176 200 V170 Q176 150 200 141 Q224 150 224 170 V200" stroke-width="2"/>' +
      '<path d="M185 200 V172 Q185 157 200 149 Q215 157 215 172 V200" stroke-width="1" opacity=".45"/>' +
      // slender columns either side, on their own bases and capitals
      '<path d="M162 194 V158 M238 194 V158" stroke-width="1.4" opacity=".85"/>' +
      '<path d="M157 158 h10 v-5 h-10 z M233 158 h10 v-5 h-10 z" stroke-width="1.1" opacity=".85"/>' +
      '<path d="M157 194 h10 v6 h-10 z M233 194 h10 v6 h-10 z" stroke-width="1.1" opacity=".85"/>' +

      // cornice over the arch block
      '<path d="M142 142 h116 l-6 -8 H148 z" stroke-width="1.7"/>' +

      // dedication plaque — the dark board under the clock
      '<path d="M146 134 V112 h108 v22 z" stroke-width="1.9"/>' +
      '<path d="M153 118 h94 M153 124 h94 M153 130 h66" stroke-width="1.1" opacity=".55"/>' +

      // clock shaft: short, and narrower than the block under it
      '<path d="M178 112 V68 h44 v44" stroke-width="2.2"/>' +
      '<path d="M174 112 h52" stroke-width="1.2" opacity=".6"/>' +

      // the clock itself
      '<circle cx="200" cy="90" r="15" stroke-width="2.1"/>' +
      '<circle cx="200" cy="90" r="12" stroke-width="1" opacity=".55"/>' +
      face +
      '<path d="M200 90 L193 83.5" stroke-width="2.1"/>' +
      '<path d="M200 90 L208.5 84.5" stroke-width="1.6"/>' +
      '<circle cx="200" cy="90" r="1.6" fill="currentColor" stroke="none"/>' +

      // The top, in three pieces that touch: a chamfered cornice off the
      // shaft, the slab sitting on it, and the carved stone resting on the
      // slab. Shared edges throughout — a finial floating a few pixels clear
      // of its own cap is what made the first version read as a sketch.
      '<path d="M172 68 l7 -7 h42 l7 7 z" stroke-width="1.7"/>' +
      '<path d="M170 61 h60 v-8 h-60 z" stroke-width="1.9"/>' +
      '<path d="M177 53 Q200 38 223 53 Z" stroke-width="1.7"/>' +
      '<path d="M184 53 Q200 45 216 53" stroke-width="1" opacity=".5"/>' +

      // ================= the pool ring, drawn last so it reads in front ==
      '<ellipse cx="200" cy="216" rx="104" ry="15" stroke-width="1.9"/>' +
      '<ellipse cx="200" cy="214" rx="90" ry="11" stroke-width="1" opacity=".45"/>' +
      jets +
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
