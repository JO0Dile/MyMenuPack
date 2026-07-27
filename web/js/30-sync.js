// ==========================
// ONLINE SYNC — pulls new/updated official plans from APP_PLANS_FEED_URL
// ==========================
// This is the one place text from OUTSIDE the user's own browser enters the
// app (every other imported plan came from a file the user personally chose
// to open). Every string field is HTML-escaped and every id is re-slugified
// to a safe [a-z0-9-]+ shape before it ever reaches the same render paths
// AAUP_IMPORTED already uses — those paths interpolate plan data into
// innerHTML/attribute strings without re-checking it, which is fine for a
// user's own data (self-XSS at worst) but not for data that arrived over
// the network on behalf of every user of the feed.
(function(){
  function safeId(s, fallback){
    var out = String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return out || fallback || ('x-' + Math.random().toString(36).slice(2, 8));
  }
  function esc(s){ return window.__escapeHtml(s); }
  function escName(n){
    if(!n) return { big: '', small: '' };
    if(typeof n === 'object') return { big: esc(n.big || ''), small: esc(n.small || '') };
    return { big: esc(n), small: '' };
  }
  var CATS = ['skills','core','math','dept','eng','uni','free'];

  function sanitizePlan(fp){
    if(!fp || !fp.id || !fp.majorName) return null;
    var id = safeId(fp.id);
    var university = (window.APP_UNIVERSITIES && window.APP_UNIVERSITIES[fp.university]) ? fp.university : 'aaup';
    var years = Array.isArray(fp.structure && fp.structure.years) ? fp.structure.years.map(function(y){
      return { id: safeId(y.id, 'y1'), hasSummer: !!y.hasSummer };
    }) : [{ id: 'y1', hasSummer: false }];
    var yearIds = years.map(function(y){ return y.id; });
    var courses = Array.isArray(fp.courses) ? fp.courses.slice(0, 400).map(function(c){
      var out = {
        id: safeId(c.id), name: esc(c.name || c.id || ''), ar: esc(c.ar || ''),
        creditHours: Math.max(0, Math.min(20, Number(c.creditHours) || 0)),
        category: CATS.indexOf(c.category) !== -1 ? c.category : 'core',
        yearId: yearIds.indexOf(safeId(c.yearId)) !== -1 ? safeId(c.yearId) : yearIds[0],
        // "summer" is a friendly alias for the renderer's s3 summer slot —
        // normalize so a feed plan's summer courses actually render.
        semester: window.__normalizeSemester ? window.__normalizeSemester(c.semester) : (['s1','s2'].indexOf(c.semester) !== -1 ? c.semester : 's1')
      };
      // The real catalog code (e.g. "100411010") — was silently dropped by
      // this sanitizer even though __sanitizeImportedPlan (the other entry
      // point, for manually-pasted/imported plans) already preserved it;
      // every course synced from the online feed showed "-" for its course
      // number in the popup and couldn't be found by searching its code.
      if(c.courseNumber != null){ out.courseNumber = esc(String(c.courseNumber)).slice(0, 30); }
      return out;
    }) : [];
    var prerequisites = Array.isArray(fp.prerequisites) ? fp.prerequisites.slice(0, 800).map(function(pair){
      return [safeId(pair[0]), safeId(pair[1])];
    }).filter(function(pair){ return pair[0] && pair[1]; }) : [];
    return {
      id: id,
      majorName: { en: escName(fp.majorName.en), ar: escName(fp.majorName.ar) },
      icon: String(fp.icon || '🎓').slice(0, 8),
      bio: { en: esc(fp.bio && fp.bio.en), ar: esc(fp.bio && fp.bio.ar) },
      college: { en: esc(fp.college && fp.college.en), ar: esc(fp.college && fp.college.ar) },
      university: university,
      structure: { years: years },
      courses: courses,
      prerequisites: prerequisites,
      official: true,
      feedVersion: Number(fp.version) || 1,
      importedAt: new Date().toISOString()
    };
  }

  function fetchFeed(){
    if(!window.APP_PLANS_FEED_URL || typeof fetch !== 'function') return Promise.resolve(null);
    return fetch(window.APP_PLANS_FEED_URL, { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }

  function applyFeed(feed){
    var result = { added: 0, updated: 0, skipped: 0 };
    if(!feed || !Array.isArray(feed.plans) || !window.AAUP_IMPORTED) return result;
    var local = window.AAUP_IMPORTED.loadImportedPlans();
    feed.plans.forEach(function(fp){
      var sanitized = sanitizePlan(fp);
      if(!sanitized) return;
      var existing = local[sanitized.id];
      if(!existing){
        local[sanitized.id] = sanitized;
        result.added++;
      } else if(existing.official && !existing.wasEdited){
        if((existing.feedVersion || 0) < sanitized.feedVersion){
          local[sanitized.id] = sanitized;
          result.updated++;
        }
      } else {
        // A locally-made or locally-edited plan happens to share this id —
        // never overwrite someone's own work with a feed version.
        result.skipped++;
      }
    });
    if(result.added || result.updated){ window.AAUP_IMPORTED.saveImportedPlans(local); }
    return result;
  }

  function lastSyncLabel(){
    var t = 0;
    try{ t = parseInt(localStorage.getItem('aaup_lastSync') || '0', 10) || 0; }catch(e){}
    if(!t) return 'Never checked yet.';
    var mins = Math.round((Date.now() - t) / 60000);
    if(mins < 1) return 'Last checked just now.';
    if(mins < 60) return 'Last checked ' + mins + ' min ago.';
    var hrs = Math.round(mins / 60);
    if(hrs < 24) return 'Last checked ' + hrs + 'h ago.';
    return 'Last checked ' + Math.round(hrs / 24) + 'd ago.';
  }

  function checkForUpdates(manual){
    return fetchFeed().then(function(feed){
      if(!feed){
        if(manual && window.__showToast){ window.__showToast('⚠️ Could not reach the plans feed — check your connection.'); }
        return { added: 0, updated: 0, skipped: 0 };
      }
      var result = applyFeed(feed);
      try{ localStorage.setItem('aaup_lastSync', String(Date.now())); }catch(e){}
      if(manual || result.added || result.updated){
        var msg = '🔄 ' + result.added + ' new, ' + result.updated + ' updated' + (result.skipped ? ', ' + result.skipped + ' skipped (you’ve customized ' + (result.skipped === 1 ? 'it' : 'them') + ')' : '') + '.';
        if(window.__showToast){ window.__showToast(msg); }
      }
      return result;
    });
  }

  window.AAUP_SYNC = { checkForUpdates: checkForUpdates, lastSyncLabel: lastSyncLabel };

  function init(){
    // Quiet on startup — only speaks up if it actually found something new,
    // or (via the Settings button) if someone asked it to.
    if(navigator.onLine === false) return;
    checkForUpdates(false);
  }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
