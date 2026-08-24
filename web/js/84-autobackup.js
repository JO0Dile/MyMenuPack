// ==========================
// AUTOMATIC BACKUPS
//
// There was already a line on the Dashboard telling a student to back up.
// A line is not a backup. Four years of ticked courses and entered grades
// live in one browser's localStorage, and the ways that goes away — a
// cleared cache, a reinstall, a new phone, a "clear site data" tap while
// looking for something else — do not announce themselves first.
//
// So the app takes its own copy, every two weeks, and keeps the last three.
//
// What this deliberately does NOT do is claim to write a file to the
// device. A web page cannot silently save to a student's disk, and
// pretending otherwise would be worse than saying nothing: they would
// believe a file exists that does not. The copies live inside the app,
// each one dated, each one restorable in a tap and downloadable as the
// same .json the Export button produces — so the honest version of "a file
// every few weeks" is "three restore points, and a download button on
// each".
//
// SIZE. A full export carries aaup_importedPlans, which holds all 77
// catalogue plans — about a megabyte of JSON that localStorage would then
// be asked to hold three more times. It does not need to: a plan that came
// from the official feed and has not been edited (js/72-share.js relies on
// the same two flags) is re-downloaded on the next sync. Only the plans a
// student actually built or changed are stored, alongside the ids of the
// official ones, so a restore knows what it is expecting the feed to bring
// back. Everything else — progress, grades, retakes, notes, achievements,
// settings — is stored in full.
// ==========================
(function(){
  'use strict';

  var KEY = 'aaup_autoBackups';
  var KEEP = 3;
  var EVERY_MS = 14 * 24 * 60 * 60 * 1000;   // a fortnight

  var TX = {
    en: {
      title: 'Automatic backups',
      lead: 'The app keeps its own copy every two weeks. The last three are here.',
      none: 'No copy taken yet — one is made once there is progress to lose.',
      restore: 'Restore', download: 'Download', kept: 'kept in the app',
      confirmTitle: 'Restore this copy?',
      confirmBody: 'Everything you have ticked, graded and changed since this copy was taken will be replaced by what it holds. The page reloads afterwards.',
      done: 'Restored — reloading…',
      failed: 'Could not restore that copy.',
      today: 'today', yesterday: 'yesterday',
      daysAgo: function(n){ return n + ' days ago'; },
      nCourses: function(n){ return n + (n === 1 ? ' course' : ' courses'); },
      nGrades: function(n){ return n + (n === 1 ? ' grade' : ' grades'); },
      nPlans: function(n){ return n + (n === 1 ? ' plan of yours' : ' plans of yours'); }
    },
    ar: {
      title: 'نسخ احتياطية تلقائية',
      lead: 'التطبيق بياخد نسخته كل أسبوعين. آخر ثلاث نسخ هون.',
      none: 'ما في نسخة بعد — بتنعمل أول ما يصير في تقدّم تخسره.',
      restore: 'استرجاع', download: 'تنزيل', kept: 'محفوظة داخل التطبيق',
      confirmTitle: 'استرجاع هذه النسخة؟',
      confirmBody: 'كل اللي علّمته وأدخلته وغيّرته بعد هذه النسخة رح ينستبدل باللي فيها. الصفحة رح تتحدث بعدها.',
      done: 'تم الاسترجاع — جاري التحديث…',
      failed: 'تعذّر استرجاع هذه النسخة.',
      today: 'اليوم', yesterday: 'إمبارح',
      daysAgo: function(n){ return 'قبل ' + n + ' يوم'; },
      nCourses: function(n){ return n + ' مساق'; },
      nGrades: function(n){ return n + ' علامة'; },
      nPlans: function(n){ return n + ' خطة إلك'; }
    }
  };
  function t(r){ return r ? TX.ar : TX.en; }

  function load(){
    var v = window.AAUP_STORAGE.getJSON(KEY, []);
    return Array.isArray(v) ? v : [];
  }
  function save(list){ window.AAUP_STORAGE.setJSON(KEY, list); }

  // Every key this app owns, minus the backup store itself — copying the
  // copies into the copy is how three snapshots become nine.
  function ownKeys(){
    var keys = [];
    // The main progress key is aaup-ai-study-plans-progress-<buildId> — it
    // starts with "aaup-", not "aaup_", so the prefix scan below misses it
    // entirely. js/16-data.js's own key list pushes it first for exactly
    // this reason; a backup without it would have held every setting and
    // none of the ticks.
    var progressKey = window.__PROGRESS_STORAGE_KEY;
    if(progressKey) keys.push(progressKey);
    try{
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(!k || k === KEY) continue;
        if(k.indexOf('aaup_') === 0 || k.indexOf('aaup-imported-progress-') === 0){ keys.push(k); }
      }
    }catch(e){ /* storage unavailable */ }
    return keys;
  }

  // A plan the feed will bring back on its own does not need to be carried.
  function splitPlans(){
    var plans = window.AAUP_IMPORTED ? (window.AAUP_IMPORTED.loadImportedPlans() || {}) : {};
    var mine = {}, fromFeed = [];
    Object.keys(plans).forEach(function(id){
      var p = plans[id] || {};
      if(p.official && !p.wasEdited){ fromFeed.push(id); }
      else { mine[id] = p; }
    });
    return { mine: mine, fromFeed: fromFeed };
  }

  function snapshot(){
    var split = splitPlans();
    var data = {};
    ownKeys().forEach(function(k){
      try{
        var raw = localStorage.getItem(k);
        if(raw === null) return;
        data[k] = JSON.parse(raw);
      }catch(e){ /* a key that is not JSON is not ours to restore */ }
    });
    data.aaup_importedPlans = split.mine;
    return {
      at: new Date().toISOString(),
      fromFeed: split.fromFeed,
      data: data
    };
  }

  // Enough progress to be worth protecting. A brand-new install with three
  // ticks does not need a restore point; it needs to be left alone.
  function hasSomethingToLose(){
    try{
      var progress = window.__getProgress ? window.__getProgress() : {};
      var done = Object.keys(progress).filter(function(k){ return progress[k]; }).length;
      if(done >= 5) return true;
      var grades = window.AAUP_GPA ? window.AAUP_GPA.loadGrades() : {};
      return Object.keys(grades).length >= 3;
    }catch(e){ return false; }
  }

  function takeIfDue(){
    if(!hasSomethingToLose()) return;
    var list = load();
    var last = list[0];
    if(last && (Date.now() - new Date(last.at).getTime()) < EVERY_MS) return;
    try{
      list.unshift(snapshot());
      save(list.slice(0, KEEP));
    }catch(e){ /* out of quota: an unwritten backup must never break the app */ }
  }

  // ---------- restoring ----------

  function applyRestore(entry){
    if(!entry || !entry.data) return false;
    try{
      // Clear this app's own keys first, so a course removed since the copy
      // was taken does not survive the restore as a leftover.
      ownKeys().forEach(function(k){ localStorage.removeItem(k); });
      Object.keys(entry.data).forEach(function(k){
        localStorage.setItem(k, JSON.stringify(entry.data[k]));
      });
      return true;
    }catch(e){ return false; }
  }

  function restore(index){
    var rtl = !!(window.AAUP_LANG && window.AAUP_LANG.isAr());
    var T = t(rtl);
    var entry = load()[index];
    if(!entry) return;
    var go = function(){
      if(applyRestore(entry)){
        if(window.__showToast) window.__showToast(T.done);
        setTimeout(function(){ location.reload(); }, 700);
      } else if(window.__showToast){ window.__showToast(T.failed); }
    };
    if(window.__showConfirmDialog){
      window.__showConfirmDialog(T.confirmTitle + '\n\n' + T.confirmBody, go, rtl);
    } else { go(); }
  }

  // The same bundle shape js/16-data.js writes, so a downloaded copy goes
  // back in through the ordinary Import Progress button.
  function download(index){
    var entry = load()[index];
    if(!entry) return;
    var bundle = {
      app: 'AAUP Planner', version: 1,
      exportedAt: entry.at, autoBackup: true,
      data: entry.data
    };
    var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'aaupath-' + entry.at.slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }

  // ---------- the section in Settings ----------

  function ago(iso, T){
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if(days <= 0) return T.today;
    if(days === 1) return T.yesterday;
    return T.daysAgo(days);
  }

  // What is IN the copy, not how many bytes it takes. A student deciding
  // whether to restore a fortnight-old snapshot is asking "how much of my
  // work is in there", and "3 KB" does not answer it — nor does "0 KB",
  // which is what the honest byte count rounded to once the catalogue plans
  // were left out of the snapshot.
  function contentsOf(entry, T){
    var d = (entry && entry.data) || {};
    var progressKey = window.__PROGRESS_STORAGE_KEY || 'aaup_progress';
    var prog = d[progressKey] || {};
    var done = Object.keys(prog).filter(function(k){ return prog[k]; }).length;
    var grades = Object.keys(d.aaup_grades || {}).length;
    var mine = Object.keys(d.aaup_importedPlans || {}).length;
    var parts = [T.nCourses(done)];
    if(grades) parts.push(T.nGrades(grades));
    if(mine) parts.push(T.nPlans(mine));
    return parts.join(' · ');
  }

  function sectionHtml(rtl){
    var T = t(rtl);
    var list = load();
    var rows = list.length
      ? list.map(function(e, i){
          return '<div class="ab-row">' +
            '<div class="ab-when"><b>' + window.__escapeHtml(e.at.slice(0, 10)) + '</b>' +
              '<span>' + window.__escapeHtml(ago(e.at, T) + ' · ' + contentsOf(e, T)) + '</span></div>' +
            '<div class="ab-acts">' +
              '<button type="button" class="home-btn" data-ab-restore="' + i + '">' +
                window.AAUP_ICONS.preview('refresh', 13) + T.restore + '</button>' +
              '<button type="button" class="home-btn" data-ab-download="' + i + '">' +
                window.AAUP_ICONS.preview('download', 13) + T.download + '</button>' +
            '</div></div>';
        }).join('')
      : '<p class="form-note" style="margin-top:0;">' + T.none + '</p>';
    return '<h3 class="mh" style="margin:18px 0 6px;">' +
      window.AAUP_ICONS.preview('save', 18) + T.title + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' + T.lead + '</p>' +
      '<div class="ab-list">' + rows + '</div>';
  }

  function bind(root){
    if(!root) return;
    root.querySelectorAll('[data-ab-restore]').forEach(function(b){
      b.addEventListener('click', function(){ restore(parseInt(b.getAttribute('data-ab-restore'), 10)); });
    });
    root.querySelectorAll('[data-ab-download]').forEach(function(b){
      b.addEventListener('click', function(){ download(parseInt(b.getAttribute('data-ab-download'), 10)); });
    });
  }

  window.AAUP_AUTOBACKUP = {
    sectionHtml: sectionHtml, bind: bind,
    takeIfDue: takeIfDue, list: load
  };

  // After the plans and progress have loaded, not before — a snapshot taken
  // mid-boot would record a half-built state as if it were the student's.
  if(document.readyState === 'complete'){ setTimeout(takeIfDue, 2500); }
  else { window.addEventListener('load', function(){ setTimeout(takeIfDue, 2500); }); }
})();
