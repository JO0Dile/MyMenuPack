// ==========================
// FIRST-RUN WIZARD
// ==========================
// A single guided flow — welcome, optional name/GPA/gender, theme, ready —
// shown once on the exact "brand-new student" signal AAUP_STUDENT already
// used for its own popup (js/15-student.js), which no longer opens itself:
// this wizard is now the one thing that greets a first-time visitor, so two
// separate uncoordinated popups don't stack on top of each other.
(function(){
  var STEPS = ['welcome', 'about', 'theme', 'ready'];
  var index = 0;

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
    if(STEPS[i] === 'about'){
      return {
        icon: '👋',
        title: 'Tell us a bit about you',
        sub: 'Optional, and only saved on this device — you can edit it anytime from Settings.',
        content:
          '<div class="form-field"><label for="wizName">Name</label>' +
          '<input type="text" id="wizName" placeholder="e.g. Lina Ahmad" maxlength="60"></div>' +
          '<div class="form-field"><label for="wizGpa">Current GPA (0.0 – 4.0)</label>' +
          '<input type="number" id="wizGpa" min="0" max="4" step="0.01" placeholder="e.g. 3.4"></div>' +
          '<div class="form-field"><label>Gender</label><div class="form-radio-group">' +
          '<label><input type="radio" name="wizGender" value="Male"> Male</label>' +
          '<label><input type="radio" name="wizGender" value="Female"> Female</label></div></div>',
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

  function saveAboutStep(){
    var nameEl = document.getElementById('wizName');
    var gpaEl = document.getElementById('wizGpa');
    var name = nameEl ? nameEl.value.trim() : '';
    var gpaRaw = gpaEl ? gpaEl.value : '';
    var gpa = gpaRaw === '' ? null : Math.max(0, Math.min(4, parseFloat(gpaRaw)));
    if(gpa !== null && isNaN(gpa)) gpa = null;
    var genderEl = document.querySelector('input[name="wizGender"]:checked');
    var gender = genderEl ? genderEl.value : null;
    // Nothing entered — leave it unset rather than writing an empty record.
    if(!name && gpa === null && !gender) return;
    if(window.AAUP_STUDENT && window.AAUP_STUDENT.save){ window.AAUP_STUDENT.save({ name: name || null, gpa: gpa, gender: gender }); }
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
      if(STEPS[index] === 'about') saveAboutStep();
      if(index >= STEPS.length - 1){ finish(); return; }
      index++; render();
    });
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
