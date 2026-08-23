// ==========================
// BACK BAR — an obvious way out of every dialog, on every screen size.
//
// Phones already got this: a dialog opens as a full page with a back bar across
// the top (see the max-width:720px block in css/app.css). On a desktop the
// only way out was a small ✕ in the corner, Escape, or clicking the backdrop
// — three things you have to already know. Students said it plainly: they
// want a button that says "back", because that is what every app they use
// has, and hunting for the exit is not a puzzle worth setting.
//
// Rather than edit a dozen modules that each build their own dialog, this
// watches for any .modal-overlay gaining .open and puts one back bar at the
// top of its card if it has not got one. The bar reuses the dialog's own
// .modal-close button, so every module's existing cleanup still runs on the
// way out — nothing here knows what any particular dialog does.
//
// Dialogs that build their body from scratch can call __backBarHTML() and
// get the same bar inline instead; the auto-injector then leaves them alone.
// ==========================
(function(){
  'use strict';

  var LABEL = { en: 'Back', ar: 'رجوع' };

  // Some dialogs are deliberately chromeless — the onboarding wizard runs the
  // whole screen and has its own step navigation (js/55-onboarding.js's own
  // "← Back" steps BACK one screen; it is not a close button), and the story
  // stack (semester recap + the "why is this locked?" walkthrough,
  // js/56-story-stack.js) has its own progress dots and its own ✕. A second
  // "← Back" pasted on top of either would not just be visual clutter: on
  // the onboarding wizard it silently CLOSED THE WHOLE FIRST-RUN SETUP,
  // because that overlay has no .modal-close for the click handler to defer
  // to, so it fell through to `overlay.classList.remove('open')` — verified
  // by opening a brand-new profile and pressing the injected bar once.
  //
  // This list previously read 'onboardingOverlay' / 'storyOverlay' /
  // 'recapOverlay' / 'shareCardOverlay' — none of which are real element
  // ids (the actual ones are onboardingWizardOverlay and storyStackOverlay;
  // the other two never existed), so neither dialog was actually being
  // skipped despite the comment saying they would be.
  var SKIP = ['onboardingWizardOverlay', 'storyStackOverlay'];

  function isRtlNow(card){
    if(card && card.getAttribute('dir') === 'rtl') return true;
    if(document.documentElement.getAttribute('dir') === 'rtl') return true;
    return !!(window.__anyVisiblePageIsRtl && window.__anyVisiblePageIsRtl());
  }

  // The markup, for dialogs that render their own body and want the bar in a
  // known place rather than injected on top.
  window.__backBarHTML = function(title, overlayId, rtl){
    var label = rtl ? LABEL.ar : LABEL.en;
    return '<div class="back-bar' + (rtl ? ' back-bar-rtl' : '') + '">' +
      '<button type="button" class="back-bar-btn" data-back-for="' +
        window.__escapeHtml(overlayId || '') + '">' +
        '<span class="back-bar-arrow" aria-hidden="true">' + window.AAUP_ICONS.preview('back', 16) + '</span>' +
        '<span>' + window.__escapeHtml(label) + '</span>' +
      '</button>' +
      (title ? '<span class="back-bar-title">' + window.__escapeHtml(title) + '</span>' : '') +
      '</div>';
  };

  // One delegated listener for every bar, however it got onto the page.
  //
  // On the CAPTURE phase, because several dialogs stop click propagation on
  // their own card (so a click inside does not reach the backdrop handler
  // that closes them). A bubbling listener on document never sees those
  // clicks at all, and the back button silently does nothing — which is
  // exactly the problem this whole file exists to fix.
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-back-for]');
    if(!btn) return;
    e.preventDefault();
    var overlay = document.getElementById(btn.getAttribute('data-back-for')) ||
                  btn.closest('.modal-overlay');
    if(!overlay) return;
    // Close through the dialog's own control when it has one, so whatever
    // that module does on close still happens.
    var own = overlay.querySelector('.modal-close, [id$="Close"]');
    if(own && own !== btn){ own.click(); }
    else { overlay.classList.remove('open'); }
  }, true);

  function inject(overlay){
    if(!overlay || SKIP.indexOf(overlay.id) !== -1) return;
    var card = overlay.querySelector('.modal-card');
    if(!card || card.querySelector(':scope > .back-bar')) return;
    // A dialog that already rendered its own bar inside its body is left
    // alone — two bars would be worse than none.
    if(card.querySelector('.back-bar')) return;
    var rtl = isRtlNow(card);
    var bar = document.createElement('div');
    bar.className = 'back-bar back-bar-auto' + (rtl ? ' back-bar-rtl' : '');
    bar.innerHTML =
      '<button type="button" class="back-bar-btn" data-back-for="' + overlay.id + '">' +
        '<span class="back-bar-arrow" aria-hidden="true">' + window.AAUP_ICONS.preview('back', 16) + '</span>' +
        '<span>' + (rtl ? LABEL.ar : LABEL.en) + '</span>' +
      '</button>';
    card.insertBefore(bar, card.firstChild);
  }

  function watch(){
    document.querySelectorAll('.modal-overlay').forEach(function(ov){
      if(ov.classList.contains('open')) inject(ov);
    });
    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        var el = m.target;
        if(el.classList && el.classList.contains('modal-overlay') && el.classList.contains('open')){
          inject(el);
        }
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(function(el){
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Dialogs built after load (the Plan Overview builds its overlay on
    // demand) are picked up here.
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.prototype.forEach.call(m.addedNodes, function(n){
          if(n.nodeType === 1 && n.classList && n.classList.contains('modal-overlay')){
            obs.observe(n, { attributes: true, attributeFilter: ['class'] });
            if(n.classList.contains('open')) inject(n);
          }
        });
      });
    }).observe(document.body, { childList: true });
  }

  if(document.readyState === 'complete'){ watch(); }
  else { window.addEventListener('load', watch); }
})();
