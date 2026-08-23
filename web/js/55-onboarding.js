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
  // THE AAUP CAMPUS, DRAWN
  //
  // Drawn rather than photographed so it takes the colour of whichever of
  // the six themes is running, and so it costs a couple of kilobytes.
  //
  // Redrawn a second time against a photograph of the real plaza, because
  // the first two attempts got the subject wrong in the same way: they drew
  // the clock as a solid stone TOWER with an arch cut into its face. It is
  // not a tower. It is an open pavilion — four slender columns standing in
  // a round fountain, two pointed arches between them, and you can see the
  // building straight through it. On the canopy sits a white block carrying
  // two clock faces, one square on to you and one turned away on the side,
  // with the dedication plaque as a dark band underneath.
  //
  // Behind it is the Faculty of Engineering, which is most of what you
  // actually see standing there: a white stone tower on the left, punched
  // with triangular openings and striped with colour, and an enormous
  // triangulated glass roof sloping away to the right. The pavilion is
  // small against it, and drawing it small is what makes the scene read as
  // that place rather than as a generic clock tower.
  //
  // Line weight carries the depth — 2.2 for the pavilion in front, 1.4 for
  // the building behind it, 1 or less for glazing and detail — because a
  // one-colour line drawing has nothing else to separate near from far.
  function campusSvg(){
    var i, a, d;

    // ---- the big clock, square on: bezel, ticks, hands at ten past ten --
    var CX = 258, CY = 108, face = '';
    for(i = 0; i < 12; i++){
      a = (i * 30 - 90) * Math.PI / 180;
      var quarter = i % 3 === 0;
      var r1 = quarter ? 10.4 : 12, r2 = 14.4;
      face += '<path d="M' + (CX + Math.cos(a) * r1).toFixed(1) + ' ' + (CY + Math.sin(a) * r1).toFixed(1) +
        ' L' + (CX + Math.cos(a) * r2).toFixed(1) + ' ' + (CY + Math.sin(a) * r2).toFixed(1) +
        '" stroke-width="' + (quarter ? 1.6 : .9) + '"/>';
    }

    // ---- the glass roof's triangulation ---------------------------------
    // The facade is a field of triangles. Ruling it with two crossing sets
    // of diagonals gives that at a fraction of the path data of drawing
    // each pane, and it stays legible when the whole thing is a watermark.
    var glass = '';
    for(i = 0; i <= 6; i++){
      d = 176 + i * 46;
      glass += '<path d="M' + d + ' 222 L' + (d - 62) + ' ' + (150 + i * 2) + '" stroke-width=".8" opacity=".3"/>';
      glass += '<path d="M' + (d - 40) + ' 222 L' + (d + 26) + ' ' + (152 + i * 4) + '" stroke-width=".8" opacity=".22"/>';
    }

    // ---- fountain jets around the pavilion -------------------------------
    var jets = '';
    [[168, 7], [196, 11], [304, 11], [332, 7]].forEach(function(j){
      jets += '<path d="M' + j[0] + ' 220 v-' + (j[1] + 9) + '" stroke-width=".9" opacity=".45"/>';
    });

    return '<svg class="wiz-campus" viewBox="0 0 480 260" fill="none" ' +
      'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +

      // ================= the plaza ======================================
      '<path d="M0 222 H480" stroke-width="1.1" opacity=".45"/>' +
      '<path d="M40 240 Q240 228 440 240 M0 254 Q240 240 480 254" stroke-width=".9" opacity=".22"/>' +

      // ================= behind: the glass roof =========================
      '<path d="M156 222 V164 L254 100 L462 190 V222" stroke-width="1.5"/>' +
      glass +
      // the ridge, redrawn over the glazing so the roofline stays the
      // strongest edge on that side
      '<path d="M254 100 L462 190" stroke-width="1.5"/>' +
      '<path d="M156 164 L254 100" stroke-width="1.5"/>' +

      // ================= behind: the white stone tower ==================
      '<path d="M56 222 V38 h96 v184" stroke-width="1.6"/>' +
      '<path d="M56 60 h96 M56 208 h96" stroke-width="1" opacity=".45"/>' +
      // the coloured stripes down its face
      '<path d="M66 86 V150 M72 86 V150 M78 86 V150" stroke-width="1" opacity=".5"/>' +
      // triangular perforations, the motif the whole facade is built from
      '<path d="M112 82 l9 -13 9 13 z M112 118 l9 -13 9 13 z M112 154 l9 -13 9 13 z ' +
             'M132 100 l7 -11 7 11 z M132 136 l7 -11 7 11 z" stroke-width=".9" opacity=".55"/>' +
      // glazing on the lower storeys
      '<path d="M84 208 V170 h22 v38 M118 208 V170 h22 v38" stroke-width=".9" opacity=".4"/>' +

      // ================= the flag, to the right =========================
      '<path d="M404 222 V126" stroke-width="1.3" opacity=".75"/>' +
      '<path d="M404 128 h32 v20 h-32" stroke-width="1.2" opacity=".75"/>' +
      '<path d="M404 128 L422 138 L404 148" stroke-width="1" opacity=".75"/>' +

      // ================= in front: the clock pavilion ===================
      // Deliberately drawn last and heaviest — it is the thing in front.
      //
      // Top to bottom, from the photographs: an open BOOK carved in stone
      // (this is a university, and that is what the sculpture is — earlier
      // versions of this drawing guessed at it as an abstract curve), on a
      // stepped plinth; the white clock box, which carries a round face on
      // each of its four sides; the dark dedication cube under it, text on
      // every face; a cornice; and then the open arched pavilion standing
      // on a round stone island in the water.

      // the open book, and the stepped plinth it rests on
      // Two page blocks curving up from a shared spine. Drawn as flat
      // wedges first, it read as a gable roof — which is the shape a
      // pediment makes, and the opposite of what this is.
      '<path class="cs-solid" d="M250 48 Q230 40 212 43 V64 Q230 61 250 70 Z" stroke-width="1.6"/>' +
      '<path class="cs-solid" d="M250 48 Q270 40 288 43 V64 Q270 61 250 70 Z" stroke-width="1.6"/>' +
      '<path d="M250 48 V70" stroke-width="1.3"/>' +
      '<path d="M222 49 Q234 48 244 52 M222 56 Q234 55 244 59 ' +
             'M278 49 Q266 48 256 52 M278 56 Q266 55 256 59" stroke-width=".8" opacity=".45"/>' +
      '<path class="cs-solid" d="M228 70 h44 v7 h-44 z" stroke-width="1.4"/>' +
      '<path class="cs-solid" d="M214 77 h72 v7 h-72 z" stroke-width="1.5"/>' +

      // the white clock box
      '<path class="cs-solid" d="M204 84 h92 v52 h-92 z" stroke-width="2"/>' +
      // the face square on to you
      '<circle class="cs-face" cx="258" cy="108" r="15" stroke-width="2"/>' +
      '<circle cx="258" cy="108" r="12" stroke-width=".9" opacity=".5"/>' +
      face +
      '<path d="M258 108 L251 101.5" stroke-width="2"/>' +
      '<path d="M258 108 L266.5 102.5" stroke-width="1.5"/>' +
      '<circle cx="258" cy="108" r="1.5" fill="currentColor" stroke="none"/>' +
      // and the one on the face turned away, narrowed by the angle
      '<ellipse cx="220" cy="110" rx="9" ry="12" stroke-width="1.5" opacity=".8"/>' +
      '<path d="M220 110 L215 103" stroke-width="1.2" opacity=".8"/>' +
      '<path d="M220 110 L225 106.5" stroke-width="1" opacity=".8"/>' +

      // the dark dedication cube, carrying text on each face
      '<path class="cs-solid" d="M192 136 h116 v34 h-116 z" stroke-width="1.9"/>' +
      '<path d="M228 136 V170" stroke-width="1" opacity=".45"/>' +
      '<path d="M234 144 h68 M234 151 h68 M234 158 h68 M234 165 h44" stroke-width=".9" opacity=".5"/>' +
      '<path d="M198 146 h24 M198 153 h24 M198 160 h24" stroke-width=".9" opacity=".35"/>' +

      // cornice under the cube
      '<path class="cs-solid" d="M186 170 h128 l-7 8 H193 z" stroke-width="1.7"/>' +

      // the open pavilion: pointed arches between stone piers, and you can
      // see the building straight through it
      '<path class="cs-solid" d="M200 210 V182 Q200 166 222 158 Q244 166 244 182 V210 h-8 V184 Q236 172 222 165 Q208 172 208 184 V210 Z" stroke-width="2.1"/>' +
      '<path class="cs-solid" d="M258 210 V182 Q258 166 280 158 Q302 166 302 182 V210 h-8 V184 Q294 172 280 165 Q266 172 266 184 V210 Z" stroke-width="2.1"/>' +
      // piers, with their capitals and bases
      '<path d="M195 182 h10 v-6 h-10 z M239 182 h10 v-6 h-10 z ' +
             'M253 182 h10 v-6 h-10 z M297 182 h10 v-6 h-10 z" stroke-width="1.1"/>' +
      '<path d="M194 210 h12 v6 h-12 z M238 210 h12 v6 h-12 z ' +
             'M252 210 h12 v6 h-12 z M296 210 h12 v6 h-12 z" stroke-width="1.1"/>' +
      // the round stone island the pavilion stands on
      '<ellipse cx="250" cy="216" rx="76" ry="10" stroke-width="1.4" opacity=".8"/>' +

      // ================= the fountain, in front of everything ============
      '<ellipse cx="250" cy="222" rx="122" ry="17" stroke-width="1.8"/>' +
      '<ellipse cx="250" cy="219" rx="106" ry="12" stroke-width=".9" opacity=".4"/>' +
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
