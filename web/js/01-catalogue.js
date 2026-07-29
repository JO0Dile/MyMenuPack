/* ==========================================================================
   CATALOGUE — the only place university, college, plan, and course data
   enters this app.

   Every registry below starts EMPTY and is filled from the API at runtime:
   universities, colleges, the University Elective pool, each plan's
   free-elective suggestions, and all 34 study plans with their courses and
   prerequisites. There is no hardcoded catalogue data anywhere in this
   frontend — adding a university, a college, a plan, or a course is a
   database operation, never an edit to a file here.

   Plans themselves arrive through the app's own sync module (AAUP_SYNC),
   pointed at the same API, so they are sanitized and merged by the code that
   always handled them.
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
// Disabled: the collector Worker committed into app/plans/collected/,
// which no longer exists. Re-point this at a real import endpoint
// before turning the contribute flow back on.
window.APP_COLLECT_URL = '';
// Optional shared secret sent with each auto-collect POST, so your collector
// can ignore random traffic. Match it to the collector's COLLECT_SECRET. It's
// not a login and grants no repo access on its own — worst case someone reads
// it and can POST plan JSON to your collector, same as using the app — so a
// simple value is fine. Leave '' to send none.
window.APP_COLLECT_SECRET = '';
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
// Hosted JSON manifest of official/community plans the app can pull updates
// from when online (see "Check for updates" in Settings). A relative path
// works once this file is served (GitHub Pages, any static host) alongside
// plans/index.json — same-origin, no CORS setup needed. Opened as a local
// file:// this fetch just fails silently and the app stays fully offline,
// same as always. Leave '' to disable online sync entirely.
// APP_PLANS_FEED_URL is set below, from APP_API_BASE.
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
window.APP_VERSION = '4.4';

(function(){
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  window.APP_API_BASE = isLocal
    ? 'http://localhost:4010/api'
    : 'https://studyplan-api-3aeg.onrender.com/api';
  window.APP_PLANS_FEED_URL = window.APP_API_BASE + '/feed';

  // An empty grid is indistinguishable from "this app has no study plans",
  // which is exactly how a sleeping free-tier server reads to a student. Say
  // which of the two it actually is.
  function showGridMessage(text, withRetry){
    var grid = document.getElementById('homeUniversityGrid');
    var step = document.getElementById('homeStepUniversities');
    if(!grid || !step || step.style.display === 'none') return;
    if(grid.querySelector('.plan-card')) return; // real content already won
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

  // Free hosting sleeps when idle and takes ~30-60s to wake, during which the
  // proxy returns 502/503. A single attempt turned that ordinary cold start
  // into "could not reach the server", so this retries with backoff and says
  // what is actually happening instead of blaming the student's connection.
  function fetchWithWake(url, onWaking){
    var delays = [0, 2000, 3000, 5000, 8000, 10000, 12000, 15000];
    var told = false;
    function attempt(i){
      return fetch(url, { cache: 'no-store' })
        .then(function(r){
          if(r.ok) return r.json();
          if(r.status >= 500 && i < delays.length - 1) throw new Error('retry');
          throw new Error('HTTP ' + r.status);
        })
        .catch(function(err){
          if(i >= delays.length - 1) throw err;
          if(!told && i >= 1){ told = true; if(onWaking) onWaking(); }
          return new Promise(function(res){ setTimeout(res, delays[i + 1]); })
            .then(function(){ return attempt(i + 1); });
        });
    }
    return attempt(0);
  }

  function announceWaking(){
    showGridMessage('\u23f3 Waking the study-plan server\u2026 free hosting sleeps when idle, so the first visit can take up to a minute.', false);
    if(window.__showToast){
      window.__showToast('\u23f3 Waking the study-plan server \u2014 free hosting sleeps when idle. One moment\u2026');
    }
  }

  function loadRegistry(){
    return fetchWithWake(window.APP_API_BASE + '/feed/registry', announceWaking)
      .then(function(reg){
        if(reg && reg.universities){
          window.APP_UNIVERSITIES = reg.universities;
          // The elective pool rides along with each university rather than
          // being a second request — the course popup needs it the moment a
          // placeholder is tapped.
          var pools = {};
          Object.keys(reg.universities).forEach(function(uid){
            pools[uid] = reg.universities[uid].electivePool || [];
          });
          window.APP_UNIV_ELECTIVES = pools;
        }
        if(reg && reg.colleges) window.APP_COLLEGES = reg.colleges;
        repaintHomeIfIdle();
      });
  }

  // Per-plan free-elective suggestions, read from the same feed the plans
  // came from so they can never disagree with the plan they belong to.
  function loadSuggestions(){
    return fetch(window.APP_PLANS_FEED_URL, { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(feed){
        if(!feed || !feed.plans) return;
        var out = {};
        feed.plans.forEach(function(p){
          if(p.freeElectiveSuggestions && p.freeElectiveSuggestions.length){
            out[p.id] = p.freeElectiveSuggestions;
          }
        });
        window.APP_FREE_ELECTIVE_SUGGESTIONS = out;
      })
      .catch(function(){ /* suggestions are a nicety, never a blocker */ });
  }

  function boot(){
    showGridMessage('\u2026 Loading universities\u2026', false);
    loadRegistry()
      .then(function(){
        // Plans go through the app's existing sync path, so they are
        // sanitized and merged by the same code that always handled them.
        if(window.AAUP_SYNC) return window.AAUP_SYNC.checkForUpdates(false);
      })
      .then(function(){ return loadSuggestions(); })
      .then(function(){ repaintHomeIfIdle(); })
      .catch(function(){
        showGridMessage('\u26a0\ufe0f Could not reach the study-plan server. It may still be starting up.', true);
        if(window.__showToast){
          window.__showToast('\u26a0\ufe0f Could not reach the study-plan server. It may still be starting \u2014 reload in a moment.');
        }
      });
  }

  if(document.readyState === 'complete'){ boot(); }
  else { window.addEventListener('load', boot); }
})();
