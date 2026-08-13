// ==========================
// STORY STACK — a reusable full-screen card sequence (Instagram-Stories
// style: segmented progress bar, swipe or tap Continue/Back to move,  a
// close button to bail at any time). Not tied to any one feature — the
// semester recap (js/08-celebrations.js) and the prerequisite "why is this
// locked?" walkthrough (js/54-prereq-graph.js) both open the same stack with
// their own card content, instead of building their own modal each.
// ==========================
(function(){
  var cards = [];
  var index = 0;
  var onFinish = null;
  var rtl = false;

  function overlay(){ return document.getElementById('storyStackOverlay'); }
  function body(){ return document.getElementById('storyStackBody'); }

  function close(){
    var ov = overlay();
    if(ov) ov.classList.remove('open');
  }

  function goNext(){
    if(index >= cards.length - 1){ close(); if(onFinish) onFinish(); return; }
    index++; render();
  }
  function goBack(){ index = Math.max(0, index - 1); render(); }

  // Horizontal drag/swipe on the card body — a real "swipe" feel, not just
  // tap-through buttons. Vertical drags are left alone (touch-action:pan-y
  // in CSS) so a tall card can still scroll if its content overflows.
  function bindSwipe(el){
    if(!el) return;
    var startX = null, startY = null, dragging = false;
    el.addEventListener('pointerdown', function(e){ startX = e.clientX; startY = e.clientY; dragging = true; });
    el.addEventListener('pointerup', function(e){
      if(!dragging) return;
      dragging = false;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)){
        if(dx < 0) goNext(); else goBack();
      }
    });
    el.addEventListener('pointercancel', function(){ dragging = false; });
  }

  function render(){
    var b = body();
    if(!b) return;
    var c = cards[index] || {};
    var segs = cards.map(function(_, i){ return '<span class="' + (i <= index ? 'filled' : '') + '"></span>'; }).join('');
    var backLabel = rtl ? 'رجوع →' : '← Back';
    var continueLabel = c.primary || (index >= cards.length - 1 ? (rtl ? 'تم' : 'Done') : (rtl ? '← متابعة' : 'Continue →'));
    var card = overlay().querySelector('.modal-card');
    if(card) card.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    b.innerHTML =
      '<div class="story-progress">' + segs + '</div>' +
      '<button type="button" class="story-close" id="storyClose" aria-label="Close">&times;</button>' +
      (c.crumb ? '<div class="story-crumb">' + c.crumb + '</div>' : '') +
      '<div class="story-body" id="storyBodyArea">' +
        (c.icon ? '<div class="story-ic">' + c.icon + '</div>' : '') +
        (c.title ? '<div class="story-title">' + c.title + '</div>' : '') +
        (c.sub ? '<div class="story-sub">' + c.sub + '</div>' : '') +
        (c.content ? '<div class="story-content">' + c.content + '</div>' : '') +
      '</div>' +
      '<div class="story-foot">' +
        (index > 0 ? '<button type="button" class="story-back" id="storyBack">' + backLabel + '</button>' : '<span></span>') +
        '<button type="button" class="story-continue" id="storyContinue">' + continueLabel + '</button>' +
      '</div>';
    var closeBtn = document.getElementById('storyClose');
    var back = document.getElementById('storyBack');
    var cont = document.getElementById('storyContinue');
    if(closeBtn) closeBtn.addEventListener('click', close);
    if(back) back.addEventListener('click', goBack);
    if(cont) cont.addEventListener('click', goNext);
    bindSwipe(document.getElementById('storyBodyArea'));
  }

  // cards: [{ icon, title, sub, content, crumb, primary }, ...]
  // opts: { onFinish(), rtl } — onFinish is called once, after the stack
  // closes (via the last card's primary button or the ✕), never on an early
  // abandon that isn't the natural end — same "only celebrate a real finish"
  // spirit as the rest of this app's celebration hooks. rtl only flips the
  // stack's own chrome (Back/Continue labels, footer order) — card text
  // direction is whatever the caller already put in icon/title/sub/content.
  function open(list, opts){
    cards = list || [];
    if(!cards.length) return;
    index = 0;
    onFinish = (opts && opts.onFinish) || null;
    rtl = !!(opts && opts.rtl);
    var ov = overlay();
    if(!ov) return;
    ov.classList.add('open');
    render();
  }

  window.AAUP_STORY = { open: open, close: close };
})();
