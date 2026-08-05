/* ==========================================================================
   CATALOGUE — the only place university, college, plan, and course data
   enters this app.

   Every registry below starts EMPTY and is filled from plans.json, a static
   file shipped alongside the app: universities, colleges, the University
   Elective pool, each plan's free-elective suggestions, and all 34 study
   plans with their courses and prerequisites.

   That file is generated from data/ by tools/build-catalogue.py, so plans are
   still authored and reviewed in one place — but the app needs no server at
   runtime. It is precached by the service worker, so the whole catalogue is
   available offline, first visit onward.

   Plans are handed to the app's own sync module (AAUP_SYNC), so they are
   sanitized and merged by the code that always handled them.
   ========================================================================== */

// Filled by loadRegistry() below.
window.APP_UNIVERSITIES = {};
window.APP_COLLEGES = {};
window.APP_UNIV_ELECTIVES = {};
window.APP_FREE_ELECTIVE_SUGGESTIONS = {};

window.APP_SUBMIT_URL = '';
// AUTO-COLLECT endpoint. When set, every plan a user builds or edits in the
// app — its college, courses, prerequisites: plan STRUCTURE only, never any
// personal progress, GPA, grades, name, or ID — is sent here quietly in the
// background so you can gather community plans without anyone pressing a
// "submit" button. This MUST be a small serverless endpoint that holds a
// GitHub token PRIVATELY and commits on the app's behalf (see COLLECTING.md
// for a ready-to-deploy Cloudflare Worker + setup). A static GitHub Pages
// site can't write to the repo by itself, and a token pasted into this file
// would be public — anyone could wipe the repo, and GitHub auto-revokes
// leaked tokens — so it never goes here, only in the collector's secrets.
// Leave '' to disable auto-collection entirely (nothing is sent anywhere).
// The one part of the app that goes online, and only when a student chooses
// to share a plan they built. Everything else works with no network at all.
// Nothing personal is ever sent — plan structure only (see 31-collect.js).
window.APP_COLLECT_URL = 'https://plan-collector.pmhtrfalab999.workers.dev';
// Optional shared secret sent with each auto-collect POST, so your collector
// can ignore random traffic. Match it to the collector's COLLECT_SECRET. It's
// not a login and grants no repo access on its own — worst case someone reads
// it and can POST plan JSON to your collector, same as using the app — so a
// simple value is fine. Leave '' to send none.
window.APP_COLLECT_SECRET = 'Winston';
// Which collector you're pointing at, so the app sends in the shape that host
// accepts. Only two values:
//   'cloudflare'  (default) — sends JSON with the secret in a header, and
//                 reads the response to confirm delivery. Use with
//                 collector/cloudflare-worker.js. This is the tested path.
//   'appsscript'  — for a Google Apps Script web app (collector/
//                 google-apps-script.gs). Apps Script can't do the same CORS,
//                 so the app sends a "simple" text POST with the secret inside
//                 the body and can't read the reply back — delivery is
//                 best-effort (the collector overwrites by id, so a rare
//                 retry just re-saves the same plan, never a duplicate).
// Leave it 'cloudflare' unless/until you deploy the Apps Script version.
window.APP_COLLECT_MODE = 'cloudflare';
// SMART ASSISTANT endpoint — a small Cloudflare Worker that holds a free
// Gemini API key privately and answers the in-app assistant's questions (see
// ai/README.md for the 5-minute setup). Same reasoning as the collector above:
// a key pasted into this file would be public, since GitHub Pages serves it to
// anyone. The Worker also holds the assistant's system prompt and the list of
// things it is allowed to do, so those cannot be rewritten from a browser.
//
// Leave '' and the app is unchanged: the assistant runs entirely on-device
// from the knowledge base in js/41-assistant-kb.js, the ✨ toggle never
// appears, and nothing a student types can leave their phone.
//
// Set here in advance to the URL the Worker WILL have once it is deployed —
// Cloudflare names workers <worker-name>.<account-subdomain>.workers.dev, and
// this account's subdomain is already known from the collector. Pointing at a
// Worker that does not exist yet is safe: the fetch fails, the app falls back
// to the on-device assistant, and the student sees a normal answer. So this
// can ship before the Worker does.
//
// If the Worker is named anything other than "studyplan-ai", change it here.
window.APP_AI_URL = 'https://studyplan-ai.pmhtrfalab999.workers.dev';
// Optional. Match it to SHARED_SECRET on the Worker to turn away traffic that
// did not come from this app. Not a login and it protects a free quota, not
// money — so a simple value is fine. Leave '' to send none.
window.APP_AI_SECRET = '';
// Hosted JSON manifest of official/community plans the app can pull updates
// from when online (see "Check for updates" in Settings). A relative path
// works once this file is served (GitHub Pages, any static host) alongside
// plans/index.json — same-origin, no CORS setup needed. Opened as a local
// file:// this fetch just fails silently and the app stays fully offline,
// same as always. Leave '' to disable online sync entirely.
// APP_PLANS_FEED_URL is set below, to the bundled plans.json.
// Repo the "📨 Contribute" button offers to open a pre-filled GitHub issue
// against when APP_SUBMIT_URL is empty — no account/server needed, just a
// place for submitted plan JSON to land for review. Leave '' to skip that
// option and fall back to "download + send it to the maintainer yourself".
window.APP_GITHUB_REPO = 'jo0dile/mymenupack';
// Shown next to "Developer" on Home and in Settings — the one unambiguous
// way to tell whether an update actually reached a given device, since the
// hosted version can otherwise look identical before and after a real
// change until the caching layers above catch up. Bump on every commit
// that reaches main:
//   fix / small tweak         -> +0.01  (2.00 -> 2.01)
//   small feature             -> +0.1   (2.0  -> 2.1)
//   big feature / redesign    -> next .5, or next whole number if already
//                                 past x.5 (2.0 -> 2.5, 2.5 -> 3.0)
window.APP_VERSION = '4.7';

(function(){
  // The catalogue ships with the app. Relative on purpose: it must resolve the
  // same whether this is served from GitHub Pages, a subfolder, or a phone's
  // home screen.
  window.APP_PLANS_FEED_URL = 'plans.json';

  // Cached so the home screen paints from the last known catalogue instantly,
  // before plans.json is even read — and so a student whose cache was cleared
  // while offline still has something to show.
  var REGISTRY_KEY = 'studyplan.registry.v1';

  function applyRegistry(reg){
    if(!reg || !reg.universities) return false;
    window.APP_UNIVERSITIES = reg.universities;
    var pools = {};
    Object.keys(reg.universities).forEach(function(uid){
      pools[uid] = reg.universities[uid].electivePool || [];
    });
    window.APP_UNIV_ELECTIVES = pools;
    if(reg.colleges) window.APP_COLLEGES = reg.colleges;
    return Object.keys(reg.universities).length > 0;
  }

  function cachedRegistry(){
    try{ return JSON.parse(localStorage.getItem(REGISTRY_KEY) || 'null'); }
    catch(e){ return null; }
  }
  function cacheRegistry(reg){
    try{ localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg)); }catch(e){ /* quota/private mode */ }
  }

  // Only shown when there is nothing cached to draw yet — an empty grid is
  // indistinguishable from "this app has no study plans".
  function showGridMessage(text, withRetry){
    var grid = document.getElementById('homeUniversityGrid');
    var step = document.getElementById('homeStepUniversities');
    if(!grid || !step || step.style.display === 'none') return;
    if(grid.querySelector('.plan-card')) return;
    grid.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'catalogue-status';
    box.textContent = text;
    if(withRetry){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'home-btn';
      btn.textContent = 'Try again';
      btn.addEventListener('click', function(){ boot(); });
      box.appendChild(document.createElement('br'));
      box.appendChild(btn);
    }
    grid.appendChild(box);
  }

  // Repaint step 1 only while the student is still looking at it — calling
  // this after they have drilled into a college would yank them back out.
  function repaintHomeIfIdle(){
    var step = document.getElementById('homeStepUniversities');
    var visible = step && step.style.display !== 'none';
    if(visible && window.AAUP_HOME && window.AAUP_HOME.showUniversities){
      window.AAUP_HOME.showUniversities();
    }
  }

  function boot(){
    var haveCache = applyRegistry(cachedRegistry());
    if(haveCache){ repaintHomeIfIdle(); }
    else { showGridMessage('\u2026 Loading study plans\u2026', false); }

    fetch(window.APP_PLANS_FEED_URL, { cache: 'no-store' })
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(feed){
        if(applyRegistry(feed)){
          cacheRegistry({ universities: feed.universities, colleges: feed.colleges });
        }
        var suggestions = {};
        (feed.plans || []).forEach(function(p){
          if(p.freeElectiveSuggestions && p.freeElectiveSuggestions.length){
            suggestions[p.id] = p.freeElectiveSuggestions;
          }
        });
        window.APP_FREE_ELECTIVE_SUGGESTIONS = suggestions;
        repaintHomeIfIdle();
        // Hand the plans to the module that has always merged them, so a
        // student's own edits are still protected from being overwritten.
        if(window.AAUP_SYNC) return window.AAUP_SYNC.checkForUpdates(false);
      })
      .then(function(){ repaintHomeIfIdle(); })
      .catch(function(){
        // With a cached catalogue the app is fully usable, so a failed read is
        // not worth interrupting anyone over.
        if(haveCache) return;
        showGridMessage('\u26a0\ufe0f Could not load the study plans. Try reloading the page.', true);
      });
  }

  if(document.readyState === 'complete'){ boot(); }
  else { window.addEventListener('load', boot); }
})();
