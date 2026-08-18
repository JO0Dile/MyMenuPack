// ==========================
// WHAT DO I NEED TO REACH A 3.0? — a section inside Degree Audit & GPA.
//
// A different question from What-if's own target box (js/63-whatif.js):
// that one asks about the specific courses picked for next semester; this
// one asks about the WHOLE remaining degree — drag a target, and see what
// average the rest of your CH would have to carry. Same underlying formula
// (AAUP_GPA.neededAverage / describeNeeded), so the two screens can never
// quietly compute this differently — only what counts as "the remaining
// hours" differs between them.
// ==========================
(function(){
  'use strict';

  var TARGET_KEY = 'aaup_gpaTarget';

  function targetFor(prefix){
    try{
      var v = parseFloat(localStorage.getItem(TARGET_KEY + '_' + prefix));
      return (v >= 2 && v <= 4) ? v : 3.5;
    }catch(e){ return 3.5; }
  }
  function saveTarget(prefix, v){
    try{ localStorage.setItem(TARGET_KEY + '_' + prefix, String(v)); }catch(e){}
  }

  var TX = {
    now: { en: 'Now · {n} graded courses', ar: 'الآن · {n} مساق مُقيَّم' },
    target: { en: 'Target', ar: 'الهدف' },
    already: { en: 'You are already above that.', ar: 'أنت أصلًا فوق هذا الرقم.' },
    needAvg: { en: 'You need a <b>{g} average</b> over the remaining {n}H — that is {phrase}.',
               ar: 'بدك <b>معدل {g}</b> على الـ {n} ساعة المتبقية — يعني {phrase}.' },
    needAll: { en: 'Even a perfect record over the remaining {n}H caps out at {gpa} — this target is out of reach on this plan.',
               ar: 'حتى لو كان سجلك مثاليًا بالـ {n} ساعة المتبقية أقصى ما توصله {gpa} — هذا الهدف غير ممكن بهذه الخطة.' },
    none: { en: 'Nothing left ungraded — your GPA is final.', ar: 'ما بقي إشي بلا علامة — معدلك نهائي.' },
    everySem: { en: 'an A average every semester', ar: 'معدل A كل فصل' },
    mostSem: { en: 'an A-minus average every semester', ar: 'معدل -A كل فصل' },
    goodSem: { en: 'a B-plus average every semester', ar: 'معدل +B كل فصل' },
    decentSem: { en: 'steady B’s from here on', ar: 'علامات B ثابتة من هلق' },
    manageable: { en: 'manageable if you keep it up', ar: 'ممكن لو حافظت عليه' }
  };
  function t(k, r){ return r ? TX[k].ar : TX[k].en; }

  // A one-line human gloss on "what does a 3.87 average actually feel
  // like", so the number is not the whole answer.
  function phraseFor(need, rtl){
    if(need >= 3.85) return t('everySem', rtl);
    if(need >= 3.55) return t('mostSem', rtl);
    if(need >= 3.15) return t('goodSem', rtl);
    if(need >= 2.5) return t('decentSem', rtl);
    return t('manageable', rtl);
  }

  function fmt(g){ return (g == null || !isFinite(g)) ? '—' : g.toFixed(2); }

  function bodyFor(prefix, target, rtl){
    var G = window.AAUP_GPA;
    var base = G.gpaFor(prefix);
    if(base.gpa == null){
      return '<p class="gt-msg">' + (rtl ? 'ما في علامات بعد.' : 'No grades yet.') + '</p>';
    }
    var rows = window.AAUP_AUDIT ? window.AAUP_AUDIT.computeAudit(prefix) : [];
    var totalCr = 0;
    rows.forEach(function(r){ totalCr += r.total; });
    var remaining = Math.max(0, totalCr - base.credits);

    if(remaining <= 0){
      return '<p class="gt-msg">' + t('none', rtl) + '</p>';
    }

    var basePoints = base.gpa * base.credits;
    var need = G.neededAverage(basePoints, base.credits, remaining, target);
    var d = G.describeNeeded(need, remaining, basePoints, base.credits);

    var msg;
    if(d.status === 'already'){
      msg = '<p class="gt-msg gt-ok">' + t('already', rtl) + '</p>';
    } else if(d.status === 'impossible'){
      msg = '<p class="gt-msg gt-warn">' + t('needAll', rtl)
        .replace('{n}', Math.round(remaining)).replace('{gpa}', fmt(d.bestCase)) + '</p>';
    } else {
      msg = '<p class="gt-msg">' + t('needAvg', rtl)
        .replace('{g}', d.letter + ' (' + d.need.toFixed(2) + ')')
        .replace('{n}', Math.round(remaining))
        .replace('{phrase}', phraseFor(d.need, rtl)) + '</p>';
    }

    var presets = [3.0, 3.5, 3.75, 4.0].map(function(pv){
      var pn = G.neededAverage(basePoints, base.credits, remaining, pv);
      var pd = G.describeNeeded(pn, remaining, basePoints, base.credits);
      var ok = pd.status !== 'impossible';
      return '<button type="button" class="gt-preset ' + (ok ? 'gt-preset-ok' : 'gt-preset-bad') +
        '" data-gt-preset="' + pv + '">' + pv.toFixed(2) + ' ' +
        (ok ? (rtl ? 'ممكن' : 'reachable') : (rtl ? 'يحتاج سجل مثالي' : 'needs perfection')) + '</button>';
    }).join('');

    return '<div class="gt-head">' +
        '<span class="gt-now">' + t('now', rtl).replace('{n}', base.credits) + ' <b>' + fmt(base.gpa) + '</b></span>' +
        '<span class="gt-target">' + t('target', rtl) + ' <b>' + target.toFixed(2) + '</b></span>' +
      '</div>' +
      '<input type="range" id="gtSlider" class="gt-slider" min="2" max="4" step="0.05" value="' + target + '">' +
      msg +
      '<div class="gt-presets">' + presets + '</div>';
  }

  function render(prefix, hostId, rtl){
    var host = document.getElementById(hostId);
    if(!host) return;
    var target = targetFor(prefix);
    host.innerHTML = bodyFor(prefix, target, rtl);
    bind(prefix, hostId, rtl);
  }

  function bind(prefix, hostId, rtl){
    var host = document.getElementById(hostId);
    if(!host) return;
    var slider = host.querySelector('#gtSlider');
    if(slider){
      slider.addEventListener('input', function(){
        saveTarget(prefix, parseFloat(slider.value));
        render(prefix, hostId, rtl);
      });
    }
    host.querySelectorAll('[data-gt-preset]').forEach(function(btn){
      btn.addEventListener('click', function(){
        saveTarget(prefix, parseFloat(btn.getAttribute('data-gt-preset')));
        render(prefix, hostId, rtl);
      });
    });
  }

  window.AAUP_GPA_TARGET = {
    render: render,
    title: function(rtl){ return rtl ? '🎯 شو بدي حتى أوصل لمعدل معيّن؟' : '🎯 What do I need to reach…'; }
  };
})();
