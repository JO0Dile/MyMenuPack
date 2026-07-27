// ==========================
// AUTO-COLLECT — quietly sends user-built plans (structure only) to the
// collector so the owner can gather community plans with no "submit" step.
//
// The whole thing is a no-op unless window.APP_COLLECT_URL is set. It never
// touches personal data: it sends exactly the same plan-only bundle that the
// manual Contribute button builds (college, courses, prerequisites) and
// never progress, GPA, grades, name, or ID. It can't and doesn't write to
// GitHub from the browser — it POSTs to a small serverless collector that
// holds the write token privately (see COLLECTING.md). Offline-safe: unsent
// plans wait in a local queue and retry on the next change, the next time
// the app opens, and whenever the device comes back online. Deduped by a
// content hash so an unchanged plan is never re-sent.
// ==========================
(function(){
  var QUEUE_KEY = 'aaup_collectQueue'; // { id: {hash, bundle} } waiting to send
  var SENT_KEY  = 'aaup_collectSent';  // { id: hash } already accepted, to dedupe
  var scanTimer = null, flushing = false;

  function enabled(){ return !!(window.APP_COLLECT_URL && typeof fetch === 'function'); }
  function getMap(k){ return (window.AAUP_STORAGE ? window.AAUP_STORAGE.getJSON(k, {}) : {}) || {}; }
  function setMap(k, v){ if(window.AAUP_STORAGE){ window.AAUP_STORAGE.setJSON(k, v); } }

  // djb2 — a tiny, fast string hash. Only used to tell "did this plan change
  // since we last sent it?", so collisions are harmless (worst case: a rare
  // re-send). Not security-sensitive.
  function hashStr(s){
    var h = 5381, i = s.length;
    while(i){ h = (h * 33) ^ s.charCodeAt(--i); }
    return (h >>> 0).toString(36);
  }

  // Plan-only bundle — deliberately mirrors AAUP_IMPORTED.planBundle: no
  // progress, no importedAt, no anything personal. Just the definition of the
  // plan itself, which is the only thing worth collecting.
  function bundleOf(id, p){
    if(!p) return null;
    return {
      id: id,
      majorName: p.majorName, icon: p.icon, bio: p.bio,
      structure: p.structure, courses: p.courses, prerequisites: p.prerequisites,
      university: p.university || 'aaup', college: p.college
    };
  }

  // Called (debounced) from AAUP_STORAGE.setJSON whenever aaup_importedPlans
  // is written. Figures out which plans actually changed and queues those.
  function onPlansChanged(plansObj){
    if(!enabled()) return;
    if(scanTimer){ clearTimeout(scanTimer); }
    scanTimer = setTimeout(function(){ scan(plansObj); }, 1200);
  }

  function scan(plansObj){
    var plans = plansObj || getMap('aaup_importedPlans');
    var sent = getMap(SENT_KEY);
    var queue = getMap(QUEUE_KEY);
    var changed = false;
    Object.keys(plans || {}).forEach(function(id){
      var p = plans[id];
      // Only collect plans a student actually BUILT. Plans pulled from the
      // feed live in this same store but carry official:true — collecting
      // those would just bounce official content back to the collector from
      // every device. (An official plan a user edited stays official:true and
      // is likewise left alone.)
      if(p && p.official){ return; }
      var bundle = bundleOf(id, p);
      if(!bundle) return;
      var text = JSON.stringify(bundle);
      var h = hashStr(text);
      // Skip empty shells: a plan with no courses AND no college text isn't
      // worth sending yet — it'll get collected once the student adds to it.
      var hasContent = (bundle.courses && bundle.courses.length) ||
        (bundle.college && (String((bundle.college.en||'')).trim() || String((bundle.college.ar||'')).trim()));
      if(!hasContent){ return; }
      if(sent[id] === h){ return; }        // already delivered, unchanged
      if(queue[id] && queue[id].hash === h){ return; } // already queued
      queue[id] = { hash: h, bundle: bundle };
      changed = true;
    });
    if(changed){ setMap(QUEUE_KEY, queue); }
    flush();
  }

  function flush(){
    if(!enabled() || flushing) return;
    if(navigator.onLine === false) return;
    var queue = getMap(QUEUE_KEY);
    var ids = Object.keys(queue);
    if(!ids.length) return;
    flushing = true;
    sendNext(ids, 0, queue);
  }

  function sendNext(ids, i, queue){
    if(i >= ids.length){ flushing = false; return; }
    var id = ids[i];
    var item = queue[id];
    if(!item){ return sendNext(ids, i + 1, queue); }

    function delivered(){
      // Remember its hash and drop it from the queue so it's never re-sent
      // until it actually changes again.
      var sent = getMap(SENT_KEY); sent[id] = item.hash; setMap(SENT_KEY, sent);
      var q = getMap(QUEUE_KEY); delete q[id]; setMap(QUEUE_KEY, q);
      sendNext(ids, i + 1, queue);
    }
    // Stop this pass but keep the item queued — it retries on the next change,
    // the next app open, and the 'online' event, without spamming.
    function retryLater(){ flushing = false; }

    var payload = {
      id: id,
      plan: item.bundle,
      appVersion: window.APP_VERSION || '',
      submittedAt: new Date().toISOString()
    };

    if(window.APP_COLLECT_MODE === 'appsscript'){
      // Google Apps Script web apps can't return the CORS headers we'd need to
      // read the response, so we send a "simple request" (text/plain, secret
      // in the body, no custom headers) that never triggers a CORS preflight,
      // and treat a resolved fetch as delivered. The collector overwrites by
      // id, so an occasional unconfirmed retry just re-saves the same plan.
      if(window.APP_COLLECT_SECRET){ payload.secret = window.APP_COLLECT_SECRET; }
      fetch(window.APP_COLLECT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function(){ delivered(); }).catch(function(){ retryLater(); });
      return;
    }

    // Default: Cloudflare Worker — JSON body, secret in a header, confirmed by
    // reading res.ok.
    var headers = { 'Content-Type': 'application/json' };
    if(window.APP_COLLECT_SECRET){ headers['X-Collect-Secret'] = window.APP_COLLECT_SECRET; }
    fetch(window.APP_COLLECT_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function(res){
      if(res && res.ok){ delivered(); }
      else { retryLater(); } // reachable but unhappy (bad secret, rate limit, 5xx)
    }).catch(function(){ retryLater(); }); // network dropped mid-send
  }

  window.__collectOnPlansChanged = onPlansChanged;
  window.AAUP_COLLECT = { flush: flush, scan: function(){ scan(null); } };

  function init(){
    if(!enabled()) return;
    // Catch anything created before the collector URL existed (or left over
    // from an offline session) and try to deliver it.
    setTimeout(function(){ scan(null); }, 2000);
    window.addEventListener('online', flush);
  }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
