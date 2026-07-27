/* ==========================================================================
   CATALOGUE BOOTSTRAP — the only place data enters this file.

   This page holds no university, college, course, or prerequisite data. The
   two registries above start empty and are filled from the API at runtime;
   study plans arrive through this app's own sync module, pointed at the same
   API. Adding a university is a database operation, never an edit here.

   Everything below this line is the app exactly as it was — same renderer,
   same arrows, same modals — just fed from PostgreSQL instead of from
   thousands of lines of literals.
   ========================================================================== */
(function(){
  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  window.APP_API_BASE = isLocal
    ? 'http://localhost:4010/api'
    : 'https://studyplan-api-3aeg.onrender.com/api';
  window.APP_PLANS_FEED_URL = window.APP_API_BASE + '/feed';

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
    if(window.__showToast){
      window.__showToast('\u23f3 Waking the study-plan server \u2014 free hosting sleeps when idle. One moment\u2026');
    }
  }

  function loadRegistry(){
    return fetchWithWake(window.APP_API_BASE + '/feed/registry', announceWaking)
      .then(function(reg){
        if(reg && reg.universities) window.APP_UNIVERSITIES = reg.universities;
        if(reg && reg.colleges) window.APP_COLLEGES = reg.colleges;
        repaintHomeIfIdle();
      });
  }

  function boot(){
    loadRegistry()
      .then(function(){
        // Plans go through the app's existing sync path, so they are
        // sanitized and merged by the same code that always handled them.
        if(window.AAUP_SYNC) return window.AAUP_SYNC.checkForUpdates(false);
      })
      .then(function(){ repaintHomeIfIdle(); })
      .catch(function(){
        if(window.__showToast){
          window.__showToast('\u26a0\ufe0f Could not reach the study-plan server. It may still be starting \u2014 reload in a moment.');
        }
      });
  }

  if(document.readyState === 'complete'){ boot(); }
  else { window.addEventListener('load', boot); }
})();
