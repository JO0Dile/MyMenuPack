// ==========================
// THOUGHTS — a shared wall for everyone studying the same major.
//
// Write one line, press Send, and it is live for every student on that plan.
// "Show thoughts" opens the wall full-screen.
//
// THREE RULES, IN THE ORDER THEY RUN
//
// 1. The word filter (js/58-wordfilter.js) checks the text BEFORE anything
//    else happens. A rejected thought is never stored, never queued, never
//    sent — it does not exist. The student gets one of a set of messages and
//    the text stays in the box so they can edit rather than retype.
// 2. A thought is text written by a stranger and rendered in everyone else's
//    browser, which is the exact shape of an XSS hole. It is escaped exactly
//    ONCE, at render, and never handed to innerHTML unescaped anywhere in
//    this file. Escaping on the way in as well looks safer and is not: the
//    text gets escaped twice and a student who types "<3" reads back "&lt;3".
// 3. Offline is normal here, not an error. A thought written on the bus is
//    queued and posted the next time the app has a connection — the student
//    is told which of the two happened rather than being left guessing.
//
// The wall lives on its own Worker (workers/thoughts-worker.js), separate
// from the admin one on purpose: this endpoint takes writes from anyone with
// the app, so it must not sit behind the same key that can commit to the
// repository. Until APP_THOUGHTS_URL is configured the whole feature runs
// device-local — you can write, read and delete your own thoughts, and
// nothing leaves the phone.
// ==========================
(function(){
  'use strict';

  var LOCAL_KEY = 'aaup_thoughts';        // this device's own thoughts
  var QUEUE_KEY = 'aaup_thoughtsQueue';   // written offline, not yet posted
  var CACHE_KEY = 'aaup_thoughtsCache';   // last wall we successfully fetched
  var MAX_LEN = 280;
  var COOLDOWN_MS = 20 * 1000;            // between one student's posts

  function esc(s){ return window.__escapeHtml(s == null ? '' : String(s)); }
  function store(){ return window.AAUP_STORAGE; }
  function endpoint(){ return window.APP_THOUGHTS_URL || ''; }
  function online(){ return typeof navigator === 'undefined' || navigator.onLine !== false; }

  function isRtl(prefix){ return window.__isRtl ? window.__isRtl(prefix) : false; }

  // ---- the rejection messages --------------------------------------------
  //
  // A blocked post is the one moment this feature talks back, so it does it
  // with a joke rather than a scolding — the student is a classmate, not a
  // suspect. Every message ends the same way, because the instruction has to
  // be clear even when the joke is not.
  var REJECT_EN = [
    'Nope. Your keyboard slipped and hit a word we cannot publish.',
    'That word is doing the heavy lifting there, and it is not coming with us.',
    'Blocked. Somewhere a lecturer felt that one.',
    'We ran that past the filter and the filter said absolutely not.',
    'Bold. Illegal, but bold.',
    'The wall has standards, and that word is under all of them.',
    'Not posting that one. Your future employer thanks us.',
    'That is a no from the filter, and the filter does not negotiate.',
    'Strong words. Wrong app.',
    'Rejected — try saying it the way you would in front of your mother.'
  ];
  var REJECT_AR = [
    'لأ. إصبعك زلّ على كلمة ما بنقدر ننشرها.',
    'الكلمة هاي شايلة الموضوع كله، وما رح تمرّ معنا.',
    'مرفوض. في دكتور حسّ فيها من بعيد.',
    'مرّرناها على الفلتر، والفلتر قال أبداً.',
    'جريئة. ممنوعة، بس جريئة.',
    'الحائط عندو مبادئ، والكلمة هاي تحتها كلها.',
    'ما رح ننشرها. صاحب الشغل المستقبلي بيشكرنا.',
    'الفلتر قال لأ، والفلتر ما بيفاوض.',
    'كلام قوي. تطبيق غلط.',
    'مرفوضة — جرّب تقولها زي ما بتقولها قدام أمك.'
  ];
  function rejectMessage(rtl, word){
    var list = rtl ? REJECT_AR : REJECT_EN;
    var msg = list[Math.floor(Math.random() * list.length)];
    var tail = rtl
      ? ' احذف كلمة «' + word + '» وجرّب مرة ثانية.'
      : ' Remove “' + word + '” and try again.';
    return msg + tail;
  }

  // ---- storage ------------------------------------------------------------

  function loadLocal(){ return store().getJSON(LOCAL_KEY, []); }
  function saveLocal(list){ store().setJSON(LOCAL_KEY, list.slice(0, 200)); }
  function loadQueue(){ return store().getJSON(QUEUE_KEY, []); }
  function saveQueue(list){ store().setJSON(QUEUE_KEY, list.slice(0, 50)); }
  function loadCache(){ return store().getJSON(CACHE_KEY, {}); }
  function saveCache(map){ store().setJSON(CACHE_KEY, map); }

  function displayName(){
    var s = window.AAUP_STUDENT ? window.AAUP_STUDENT.get() : null;
    var n = s && (s.name || s.displayName);
    return (n && String(n).trim()) || '';
  }

  // A stable id for this device so a student can delete their own thought
  // from the wall without any account existing.
  function deviceId(){
    var k = 'aaup_deviceId';
    try{
      var v = localStorage.getItem(k);
      if(!v){
        v = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(k, v);
      }
      return v;
    }catch(e){ return 'd-anon'; }
  }

  var lastPostAt = 0;

  // ---- network ------------------------------------------------------------

  function postThought(item){
    var url = endpoint();
    if(!url) return Promise.reject(new Error('not configured'));
    return fetch(url.replace(/\/$/, '') + '/thoughts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    }).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function fetchWall(prefix){
    var url = endpoint();
    if(!url) return Promise.resolve(null);
    return fetch(url.replace(/\/$/, '') + '/thoughts?plan=' + encodeURIComponent(prefix), {
      method: 'GET'
    }).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(data){
      var list = (data && Array.isArray(data.thoughts)) ? data.thoughts : [];
      // Everything from the wire is a stranger's text. It is length-capped and
      // typed here, then escaped at render (thoughtHTML) like every other
      // thought — one escape, in one place, for both sources.
      list = list.slice(0, 200).map(function(t){
        return {
          id: String(t.id || '').slice(0, 60),
          text: String(t.text || '').slice(0, MAX_LEN),
          name: String(t.name || '').slice(0, 40),
          at: Number(t.at) || 0,
          by: String(t.by || '').slice(0, 40)
        };
      }).filter(function(t){ return t.text; });
      var cache = loadCache();
      cache[prefix] = { at: Date.now(), list: list };
      saveCache(cache);
      return list;
    });
  }

  // Anything written while offline goes out on the next connection.
  function flushQueue(){
    var q = loadQueue();
    if(!q.length || !endpoint() || !online()) return Promise.resolve(0);
    var sent = 0;
    return q.reduce(function(chain, item){
      return chain.then(function(){
        return postThought(item).then(function(){ sent++; }).catch(function(){});
      });
    }, Promise.resolve()).then(function(){
      // Keep only what genuinely failed.
      saveQueue(q.slice(sent));
      return sent;
    });
  }

  // ---- publishing ---------------------------------------------------------

  // Returns { ok: true, queued: bool } or { ok: false, reason, message }.
  function publish(prefix, text){
    var rtl = isRtl(prefix);
    var raw = String(text || '').trim();

    if(!raw){
      return { ok: false, reason: 'empty',
        message: rtl ? 'اكتب شيئًا أولاً.' : 'Write something first.' };
    }
    if(raw.length > MAX_LEN){
      return { ok: false, reason: 'long',
        message: rtl ? ('أطول من اللازم — الحد ' + MAX_LEN + ' حرفًا.')
                     : ('Too long — ' + MAX_LEN + ' characters is the limit.') };
    }
    // Rule 1: the filter runs before anything is stored or sent.
    var verdict = window.AAUP_WORDFILTER ? window.AAUP_WORDFILTER.check(raw) : { clean: true };
    if(!verdict.clean){
      return { ok: false, reason: 'blocked', word: verdict.word,
        message: rejectMessage(rtl, verdict.word) };
    }
    // The cooldown is checked AFTER the filter on purpose: a student told to
    // "remove that word and try again" must be able to do exactly that
    // straight away. Only a post that actually goes out starts the clock.
    var now = Date.now();
    if(now - lastPostAt < COOLDOWN_MS){
      var wait = Math.ceil((COOLDOWN_MS - (now - lastPostAt)) / 1000);
      return { ok: false, reason: 'slow',
        message: rtl ? ('استنى ' + wait + ' ثانية قبل التالية.')
                     : ('Give it ' + wait + 's before the next one.') };
    }

    // Stored as written. Escaping happens once, at render (thoughtHTML), the
    // same way for a thought from this device and one from the wire — escape
    // it here too and a student who types "<3" reads back "&lt;3".
    var item = {
      id: deviceId() + '-' + now.toString(36),
      plan: prefix,
      text: raw,
      name: displayName(),
      at: now,
      by: deviceId()
    };

    var mine = loadLocal();
    mine.unshift(item);
    saveLocal(mine);
    lastPostAt = now;

    if(!endpoint()){
      return { ok: true, queued: false, local: true, item: item };
    }
    if(!online()){
      var q = loadQueue();
      q.push(item);
      saveQueue(q);
      return { ok: true, queued: true, item: item };
    }
    postThought(item).catch(function(){
      var q2 = loadQueue();
      q2.push(item);
      saveQueue(q2);
    });
    return { ok: true, queued: false, item: item };
  }

  function removeMine(id){
    saveLocal(loadLocal().filter(function(t){ return t.id !== id; }));
    saveQueue(loadQueue().filter(function(t){ return t.id !== id; }));
    var url = endpoint();
    if(url && online()){
      fetch(url.replace(/\/$/, '') + '/thoughts/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ by: deviceId() })
      }).catch(function(){});
    }
  }

  // The wall as it should be shown right now: what the server last gave us,
  // plus anything this device wrote that has not come back yet.
  function wallFor(prefix){
    var cache = loadCache()[prefix];
    var remote = (cache && Array.isArray(cache.list)) ? cache.list : [];
    var seen = Object.create(null);
    remote.forEach(function(t){ seen[t.id] = true; });
    var mine = loadLocal().filter(function(t){
      return t.plan === prefix && !seen[t.id];
    });
    return mine.concat(remote).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
  }

  // ---- the wall UI --------------------------------------------------------

  function timeAgo(ts, rtl){
    var s = Math.max(0, Math.floor((Date.now() - (ts || 0)) / 1000));
    if(s < 60) return rtl ? 'الآن' : 'just now';
    var m = Math.floor(s / 60);
    if(m < 60) return rtl ? ('قبل ' + m + ' د') : (m + 'm ago');
    var h = Math.floor(m / 60);
    if(h < 24) return rtl ? ('قبل ' + h + ' س') : (h + 'h ago');
    var d = Math.floor(h / 24);
    return rtl ? ('قبل ' + d + ' يوم') : (d + 'd ago');
  }

  function thoughtHTML(t, rtl){
    var isMine = t.by === deviceId();
    return '<div class="th-item' + (isMine ? ' th-mine' : '') + '">' +
      '<div class="th-head">' +
        '<span class="th-who">' + esc(t.name || (rtl ? 'طالب' : 'A student')) + '</span>' +
        '<span class="th-when">' + esc(timeAgo(t.at, rtl)) + '</span>' +
      '</div>' +
      '<p class="th-text">' + esc(t.text) + '</p>' +
      (isMine ? '<button type="button" class="th-del" data-th-del="' + esc(t.id) + '">' +
        (rtl ? 'حذف' : 'Delete') + '</button>' : '') +
      '</div>';
  }

  function render(prefix){
    var body = document.getElementById('thoughtsModalBody');
    if(!body) return;
    var rtl = isRtl(prefix);
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    var list = wallFor(prefix);
    var queued = loadQueue().length;

    body.innerHTML =
      window.__backBarHTML(rtl ? 'أفكار الطلاب' : 'Student thoughts', 'thoughtsModalOverlay', rtl) +
      '<p class="form-note" style="margin-top:0;">' +
        (rtl
          ? 'اكتب سطرًا يشوفه كل طالب في نفس التخصص. بلا شتائم — الفلتر بيرفضها فورًا.'
          : 'Write one line every student on this plan can see. No abuse — the filter rejects it on the spot.') +
      '</p>' +
      '<div class="th-compose">' +
        '<textarea id="thInput" maxlength="' + MAX_LEN + '" rows="3" placeholder="' +
          (rtl ? 'شو رأيك بهالفصل؟' : 'What is on your mind about this semester?') + '"></textarea>' +
        '<div class="th-compose-row">' +
          '<span class="th-count" id="thCount">0 / ' + MAX_LEN + '</span>' +
          '<button type="button" class="home-btn th-send" id="thSend">' +
            (rtl ? 'إرسال' : 'Send') + '</button>' +
        '</div>' +
        '<p class="th-error" id="thError" role="alert" hidden></p>' +
      '</div>' +
      (queued ? '<p class="th-queued">' + (rtl
        ? ('في ' + queued + ' فكرة مخزّنة، رح تُنشر أول ما يرجع الإنترنت.')
        : (queued + ' thought' + (queued === 1 ? '' : 's') + ' waiting to go out when you are back online.')) + '</p>' : '') +
      '<div class="th-list" id="thList">' +
        (list.length
          ? list.map(function(t){ return thoughtHTML(t, rtl); }).join('')
          : '<p class="ncp-empty">' + (rtl ? 'لا أفكار بعد — كن أول واحد.' : 'Nothing here yet — be the first.') + '</p>') +
      '</div>' +
      (endpoint() ? '' : '<p class="form-note th-localnote">' + (rtl
        ? 'الوضع المحلي: أفكارك محفوظة على جهازك فقط، لأن خادم الأفكار غير مُهيّأ بعد.'
        : 'Local mode: your thoughts stay on this device — the thoughts server is not configured yet.') + '</p>');

    bind(prefix, rtl);
  }

  function bind(prefix, rtl){
    var input = document.getElementById('thInput');
    var send = document.getElementById('thSend');
    var count = document.getElementById('thCount');
    var error = document.getElementById('thError');
    if(!input || !send) return;

    input.addEventListener('input', function(){
      count.textContent = input.value.length + ' / ' + MAX_LEN;
      error.hidden = true;
    });

    send.addEventListener('click', function(){
      var result = publish(prefix, input.value);
      if(!result.ok){
        // Rejected: say why, keep what they wrote so it can be edited.
        error.textContent = result.message;
        error.hidden = false;
        if(result.reason === 'blocked'){ input.focus(); }
        return;
      }
      input.value = '';
      if(count) count.textContent = '0 / ' + MAX_LEN;
      if(window.__showToast){
        window.__showToast(result.queued
          ? (rtl ? 'محفوظة — رح تُنشر أول ما يرجع الإنترنت.' : 'Saved — it goes out when you are back online.')
          : (rtl ? 'تم النشر.' : 'Posted.'));
      }
      render(prefix);
    });

    document.getElementById('thList').addEventListener('click', function(e){
      var btn = e.target.closest('[data-th-del]');
      if(!btn) return;
      removeMine(btn.getAttribute('data-th-del'));
      render(prefix);
    });
  }

  function open(prefix){
    var overlay = document.getElementById('thoughtsModalOverlay');
    if(!overlay) return;
    render(prefix);
    overlay.classList.add('open');
    // Refresh from the wall in the background; the cached copy is already on
    // screen, so a slow or missing network changes nothing the student sees.
    flushQueue().then(function(){ return fetchWall(prefix); })
      .then(function(list){ if(list) render(prefix); })
      .catch(function(){});
  }

  function close(){
    var overlay = document.getElementById('thoughtsModalOverlay');
    if(overlay) overlay.classList.remove('open');
  }

  function bindShell(){
    var overlay = document.getElementById('thoughtsModalOverlay');
    if(!overlay) return;
    var btn = document.getElementById('thoughtsModalClose');
    if(btn) btn.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
    var card = overlay.querySelector('.modal-card');
    if(card) card.addEventListener('click', function(e){ e.stopPropagation(); });
  }
  if(document.readyState === 'complete'){ bindShell(); }
  else { window.addEventListener('load', bindShell); }

  window.addEventListener('online', function(){ flushQueue(); });

  window.AAUP_THOUGHTS = {
    open: open, close: close, publish: publish, wallFor: wallFor,
    flushQueue: flushQueue, count: function(prefix){ return wallFor(prefix).length; }
  };
})();
