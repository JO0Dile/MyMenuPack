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
  // The app is called AAUPath, طريقك, and this is the picture of it: the
  // brick walk running away from you, up to the نافورة, with the faculty
  // standing either side. It fills the screen — the mark, the name and the
  // buttons sit on top of it, which is what makes it a backdrop rather than
  // an illustration parked under some text.
  //
  // Every line in it aims at one vanishing point, at (200, 600), directly
  // under the fountain: the two facades recede toward it, the plaza fans
  // out of it, and the paving courses compress toward it on a square law.
  // That single construction is what makes ground read as ground instead of
  // as a ladder, and lets the buildings be plain boxes whose edges simply
  // point the right way.
  //
  // Proportions are measured off a reference of the real approach rather
  // than eyeballed: the brick walk is inset inside a wider plaza (it does
  // not run to the corners of the frame), the basin is nearly the full
  // width, and the monument's two arches are tall and narrow.
  //
  // Line-work only — no fills, no shading — so it takes the theme's accent
  // and belongs to whichever of the six is running.
  function campusSvg(){
    var i, k, x, y, yN, t, a, f, out;

    var W = 400, H = 858;
    var VPX = 200, HZ = 600;          // vanishing point, under the fountain

    // Every receding line in the drawing goes through here.
    function toVP(nearY, nearX, atX){
      if(nearX === VPX) return nearY;
      return nearY + (HZ - nearY) * Math.abs(atX - nearX) / Math.abs(VPX - nearX);
    }
    // The ground's own foreshortening: i squared, so courses crowd together
    // toward the horizon the way paving actually does.
    function courseY(i, n){ return HZ + (H + 40 - HZ) * Math.pow(i / n, 1.9); }

    // ================= the plaza ======================================
    // Fans the full width of the frame, out of the vanishing point.
    // Kept deliberately faint. Drawn at full strength these radials read as
    // a starburst centred on the fountain and swallow everything else.
    var plaza = '';
    for(k = 0; k <= 8; k++){
      f = k / 8;
      plaza += '<path d="M' + VPX + ' ' + HZ + ' L' + (-70 + 540 * f).toFixed(1) + ' ' + (H + 40) +
               '" stroke-width=".7" opacity=".12"/>';
    }
    for(i = 1; i <= 11; i++){
      y = courseY(i, 11);
      plaza += '<path d="M0 ' + y.toFixed(1) + ' H' + W + '" stroke-width=".7" opacity="' +
               (0.2 - i * 0.011).toFixed(2) + '"/>';
    }

    // ================= the brick walk =================================
    // Inset inside the plaza rather than running to the corners.
    var FAR_L = 164, FAR_R = 236, NEAR_L = 66, NEAR_R = 334;
    function walkX(side, yy){
      t = (yy - HZ) / (H + 40 - HZ);
      return side === 'L' ? FAR_L + (NEAR_L - FAR_L) * t : FAR_R + (NEAR_R - FAR_R) * t;
    }
    var walk = '<path d="M' + FAR_L + ' ' + HZ + ' L' + NEAR_L + ' ' + (H + 40) +
               '" stroke-width="1.5" opacity=".6"/>' +
               '<path d="M' + FAR_R + ' ' + HZ + ' L' + NEAR_R + ' ' + (H + 40) +
               '" stroke-width="1.5" opacity=".6"/>';
    var N = 15;
    for(i = 1; i <= N; i++){
      y = courseY(i, N);
      walk += '<path d="M' + walkX('L', y).toFixed(1) + ' ' + y.toFixed(1) +
              ' H' + walkX('R', y).toFixed(1) + '" stroke-width=".9" opacity="' +
              (0.5 - i * 0.014).toFixed(2) + '"/>';
    }
    // Running bond: short cross-joints, offset every other course, and only
    // where the courses are far enough apart to show them.
    for(i = 4; i < N; i++){
      y = courseY(i, N); yN = courseY(i + 1, N);
      var xl = walkX('L', y), xr = walkX('R', y);
      var per = 9, step = (xr - xl) / per, off = (i % 2) ? step / 2 : 0;
      for(k = 0; k <= per; k++){
        x = xl + off + step * k;
        if(x <= xl + 0.5 || x >= xr - 0.5) continue;
        walk += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' L' +
                (VPX + (x - VPX) * (yN - HZ) / (y - HZ)).toFixed(1) + ' ' + yN.toFixed(1) +
                '" stroke-width=".85" opacity=".45"/>';
      }
    }

    // ================= the faculty, either side =======================
    function facade(nearX, farX, topY, botY, dir, glazed){
      out = '';
      var topFar = toVP(topY, nearX, farX), botFar = toVP(botY, nearX, farX);
      out += '<path d="M' + nearX + ' ' + topY + ' L' + farX + ' ' + topFar.toFixed(1) +
             ' V' + botFar.toFixed(1) + ' L' + nearX + ' ' + botY +
             '" stroke-width="1.6" opacity=".72"/>';
      out += '<path d="M' + nearX + ' ' + topY + ' V' + botY + '" stroke-width="1.6" opacity=".72"/>';
      // storey bands, each aimed at the vanishing point
      [0.16, 0.33, 0.5, 0.67, 0.84].forEach(function(fr){
        var ny = topY + (botY - topY) * fr;
        out += '<path d="M' + nearX + ' ' + ny.toFixed(1) + ' L' + farX + ' ' +
               toVP(ny, nearX, farX).toFixed(1) + '" stroke-width=".85" opacity=".3"/>';
      });
      // and the verticals crossing them
      for(k = 1; k <= 5; k++){
        x = nearX + (farX - nearX) * (k / 6);
        out += '<path d="M' + x.toFixed(1) + ' ' + toVP(topY, nearX, x).toFixed(1) +
               ' V' + toVP(botY, nearX, x).toFixed(1) + '" stroke-width=".85" opacity="' +
               (0.44 - k * 0.05).toFixed(2) + '"/>';
      }
      // the triangular openings the real facade is built from
      [[0.05, 0.24], [0.05, 0.55], [0.22, 0.38], [0.22, 0.7], [0.42, 0.3], [0.42, 0.6], [0.6, 0.46]]
        .forEach(function(pt){
          x = nearX + (farX - nearX) * pt[0];
          var sc = 1 - pt[0] * 0.66;
          var cy = toVP(topY + (botY - topY) * pt[1], nearX, x);
          var w = 17 * sc * dir, hh = 30 * sc;
          out += '<path d="M' + x.toFixed(1) + ' ' + (cy + hh / 2).toFixed(1) +
                 ' l' + w.toFixed(1) + ' ' + (-hh).toFixed(1) +
                 ' l' + w.toFixed(1) + ' ' + hh.toFixed(1) +
                 ' z" stroke-width="1.1" opacity=".6"/>';
        });
      // the right-hand block is the glass one: cross it with its glazing
      if(glazed){
        for(k = 0; k <= 4; k++){
          var g1 = nearX + (farX - nearX) * (k / 5), g2 = nearX + (farX - nearX) * ((k + 1) / 5);
          out += '<path d="M' + g1.toFixed(1) + ' ' + toVP(topY, nearX, g1).toFixed(1) +
                 ' L' + g2.toFixed(1) + ' ' + toVP(botY, nearX, g2).toFixed(1) +
                 '" stroke-width=".8" opacity=".3"/>';
          out += '<path d="M' + g1.toFixed(1) + ' ' + toVP(botY, nearX, g1).toFixed(1) +
                 ' L' + g2.toFixed(1) + ' ' + toVP(topY, nearX, g2).toFixed(1) +
                 '" stroke-width=".8" opacity=".3"/>';
        }
      }
      return out;
    }
    var buildings = facade(0, 146, 128, 668, 1, false) +
                    facade(W, 254, 104, 700, -1, true);

    // ================= the clock ======================================
    var CX = 200, CY = 314, face = '';
    for(i = 0; i < 12; i++){
      a = (i * 30 - 90) * Math.PI / 180;
      var q = i % 3 === 0;
      var r1 = q ? 17 : 19.4, r2 = 23;
      face += '<path d="M' + (CX + Math.cos(a) * r1).toFixed(1) + ' ' + (CY + Math.sin(a) * r1).toFixed(1) +
        ' L' + (CX + Math.cos(a) * r2).toFixed(1) + ' ' + (CY + Math.sin(a) * r2).toFixed(1) +
        '" stroke-width="' + (q ? 1.5 : .85) + '"/>';
    }

    // ================= water ==========================================
    var jets = '';
    [[148, 40], [122, 31], [95, 23], [66, 16], [36, 11]].forEach(function(j){
      ['-', '+'].forEach(function(sign){
        var jx = sign === '-' ? 200 - j[0] : 200 + j[0];
        var lean = sign === '-' ? 4 : -4;
        jets += '<path d="M' + jx + ' 574 Q' + (jx + lean) + ' ' + (574 - j[1] * .7) +
                ' ' + (jx + lean * 2) + ' ' + (574 - j[1]) + '" stroke-width="1" opacity=".42"/>';
      });
    });

    return '<svg class="wiz-campus" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'preserveAspectRatio="xMidYMid slice" fill="none" ' +
      'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +

      plaza + walk + buildings +

      // ================= the monument, dead centre ======================
      // the open book, carved in stone
      '<path d="M200 222 Q180 214 162 216 V238 Q180 236 200 246 Z" stroke-width="1.5"/>' +
      '<path d="M200 222 Q220 214 238 216 V238 Q220 236 200 246 Z" stroke-width="1.5"/>' +
      '<path d="M200 222 V246" stroke-width="1.2"/>' +
      '<path d="M170 224 Q184 223 195 226 M170 232 Q184 231 195 234 ' +
             'M230 224 Q216 223 205 226 M230 232 Q216 231 205 234" stroke-width=".8" opacity=".45"/>' +
      // cap, then the clock stage
      '<path d="M176 246 h48 v9 h-48 z" stroke-width="1.3"/>' +
      '<path d="M157 255 h86 v66 h-86 z" stroke-width="1.8"/>' +
      '<circle cx="200" cy="314" r="24" stroke-width="1.8"/>' +
      '<circle cx="200" cy="314" r="19.4" stroke-width=".9" opacity=".5"/>' +
      face +
      '<path d="M200 314 L189 303.5" stroke-width="1.8"/>' +
      '<path d="M200 314 L213 306" stroke-width="1.4"/>' +
      '<circle cx="200" cy="314" r="1.8" fill="currentColor" stroke="none"/>' +
      // the dedication plaque
      '<path d="M148 321 h104 v46 h-104 z" stroke-width="1.7"/>' +
      '<path d="M156 332 h88 M156 340 h88 M156 348 h88 M156 356 h58" stroke-width=".9" opacity=".5"/>' +
      // the canopy the arches carry
      '<path d="M138 367 h124 v12 h-124 z" stroke-width="1.6"/>' +
      // two tall, narrow pointed arches — the plaza shows straight through
      '<path d="M152 566 V462 Q152 428 176 412 Q200 428 200 462 V566" stroke-width="1.9"/>' +
      '<path d="M200 566 V462 Q200 428 224 412 Q248 428 248 462 V566" stroke-width="1.9"/>' +
      '<path d="M161 566 V466 Q161 440 176 428 Q191 440 191 466 V566" stroke-width=".9" opacity=".38"/>' +
      '<path d="M209 566 V466 Q209 440 224 428 Q239 440 239 466 V566" stroke-width=".9" opacity=".38"/>' +
      '<path d="M146 464 h13 v-8 h-13 z M193 464 h14 v-8 h-14 z M241 464 h13 v-8 h-13 z" stroke-width="1"/>' +
      // the island it stands on, the water, then the basin in front
      '<ellipse cx="200" cy="570" rx="74" ry="11" stroke-width="1.2" opacity=".7"/>' +
      jets +
      '<ellipse cx="200" cy="588" rx="162" ry="24" stroke-width="1.5" opacity=".75"/>' +
      '<ellipse cx="200" cy="583" rx="136" ry="18" stroke-width=".9" opacity=".4"/>' +
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
