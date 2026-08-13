// ==========================
// STUDENT INFORMATION
// ==========================
(function(){
  var KEY = 'aaup_studentInfo';
  var DISMISS_KEY = 'aaup_studentInfo_dismissed';

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function save(obj){
    try{ localStorage.setItem(KEY, JSON.stringify(obj)); }catch(e){ /* storage unavailable */ }
  }

  function openDialog(){
    var overlay = document.getElementById('studentInfoOverlay');
    if(!overlay) return;
    var info = load() || {};
    var nameEl = document.getElementById('studentInfoName');
    var gpaEl = document.getElementById('studentInfoGpa');
    if(nameEl) nameEl.value = info.name || '';
    if(gpaEl) gpaEl.value = (typeof info.gpa === 'number') ? info.gpa : '';
    var radios = document.getElementsByName('studentInfoGender');
    for(var i = 0; i < radios.length; i++){ radios[i].checked = (radios[i].value === info.gender); }
    overlay.classList.add('open');
  }
  function closeDialog(){
    var overlay = document.getElementById('studentInfoOverlay');
    if(overlay) overlay.classList.remove('open');
  }

  function markSeen(){
    try{ localStorage.setItem(DISMISS_KEY, '1'); }catch(e){}
  }

  function doSave(){
    var nameEl = document.getElementById('studentInfoName');
    var gpaEl = document.getElementById('studentInfoGpa');
    var name = nameEl ? nameEl.value.trim() : '';
    var gpaRaw = gpaEl ? gpaEl.value : '';
    var gpa = gpaRaw === '' ? null : Math.max(0, Math.min(4, parseFloat(gpaRaw)));
    if(gpa !== null && isNaN(gpa)) gpa = null;
    var genderEl = document.querySelector('input[name="studentInfoGender"]:checked');
    var gender = genderEl ? genderEl.value : null;
    save({ name: name || null, gpa: gpa, gender: gender });
    markSeen();
    closeDialog();
    if(window.__renderWelcomeMessages) window.__renderWelcomeMessages();
    if(window.__showToast) window.__showToast('Saved — welcome' + (name ? ', ' + name : '') + '!');
  }
  function doSkip(){
    markSeen();
    closeDialog();
  }

  function bind(){
    var saveBtn = document.getElementById('studentInfoSave');
    var skipBtn = document.getElementById('studentInfoSkip');
    var closeBtn = document.getElementById('studentInfoClose');
    var overlay = document.getElementById('studentInfoOverlay');
    if(saveBtn) saveBtn.addEventListener('click', doSave);
    if(skipBtn) skipBtn.addEventListener('click', doSkip);
    if(closeBtn) closeBtn.addEventListener('click', doSkip);
    if(overlay){
      overlay.addEventListener('click', function(e){ if(e.target === overlay) doSkip(); });
      var card = overlay.querySelector('.modal-card');
      if(card) card.addEventListener('click', function(e){ e.stopPropagation(); });
    }

    if(window.__renderWelcomeMessages) window.__renderWelcomeMessages();
  }

  function isDismissed(){
    try{ return localStorage.getItem(DISMISS_KEY) === '1'; }catch(e){ return false; }
  }

  // The first-run wizard (js/55-onboarding.js) is now the sole place this
  // "is this a brand-new student?" signal auto-opens anything — this dialog
  // no longer pops itself open on load. openDialog() stays available for the
  // "✏️ Edit" link in the My Progress panel, and markSeen()/isFirstRun() are
  // exposed so the wizard can share the same "seen it" flag this module owns
  // instead of tracking a second one.
  window.AAUP_STUDENT = {
    get: load, openDialog: openDialog, markSeen: markSeen,
    isFirstRun: function(){ return !load() && !isDismissed(); }
  };

  if(document.readyState === 'complete'){ bind(); }
  else { window.addEventListener('load', bind); }
})();
