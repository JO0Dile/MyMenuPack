// ==========================
// COMMUNITY DATA (anonymous, aggregated course feedback)
// ==========================
(function(){
  function loadCommunity(){
    return window.AAUP_STORAGE.getJSON('aaup_community_feedback', {});
  }
  function saveCommunity(m){
    window.AAUP_STORAGE.setJSON('aaup_community_feedback', m);
  }
  function knownCourseIds(){
    var ids = {};
    (window.__PLANS || []).forEach(function(prefix){
      var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
      Object.keys(info).forEach(function(slug){ ids[slug] = true; });
    });
    // Imported plans keep their own separate course list (see the Imported
    // Plans module) rather than registering into window.__PLAN_DATA, so
    // they need to be folded in here explicitly too.
    try{
      var imported = JSON.parse(localStorage.getItem('aaup_importedPlans') || '{}') || {};
      Object.keys(imported).forEach(function(planId){
        (imported[planId].courses || []).forEach(function(c){ if(c && c.id){ ids[c.id] = true; } });
      });
    }catch(e){}
    return ids;
  }

  // Privacy: only ever reads parsed.feedback — studentName / studentGPA /
  // studentGender / submittedAt from the pasted email body are never
  // touched, let alone stored. Unknown course ids are skipped and reported,
  // not silently dropped.
  function importFeedback(jsonText){
    var parsed;
    try{ parsed = JSON.parse(jsonText); }
    catch(e){ return { ok: false, error: 'Invalid JSON format. Please check your copy.' }; }

    var feedback = parsed && parsed.feedback;
    if(!Array.isArray(feedback)){
      return { ok: false, error: 'Invalid JSON format. Please check your copy.' };
    }

    var known = knownCourseIds();
    var community = loadCommunity();
    var warnings = [];
    var importedCount = 0;

    feedback.forEach(function(item){
      if(!item || typeof item.courseId !== 'string' || item.difficulty === undefined){
        warnings.push('Skipped a malformed entry.');
        return;
      }
      if(!known[item.courseId]){
        // courseId is straight out of a pasted email and this warning is
        // rendered via innerHTML — escape it like any other foreign text.
        warnings.push('Skipped unknown course: ' + window.__escapeHtml(String(item.courseId).slice(0, 60)));
        return;
      }
      var entry = community[item.courseId] || { totalDifficulty: 0, difficultyVotes: 0, workloadCounts: {}, sampleNotes: [] };
      if(typeof item.difficulty === 'number' && item.difficulty > 0){
        entry.totalDifficulty += item.difficulty;
        entry.difficultyVotes += 1;
      }
      // Whitelisted, not just escaped: workload becomes an object KEY that
      // later lands in innerHTML (the ⚡ badge), and the app only has
      // meaning for these three values anyway.
      if(['Easy','Medium','Hard'].indexOf(item.workload) !== -1){
        entry.workloadCounts[item.workload] = (entry.workloadCounts[item.workload] || 0) + 1;
      }
      if(item.note && String(item.note).trim()){
        // Notes render inside the 📝 popover via innerHTML — a student
        // email is exactly as untrusted as the network feed, so they get
        // the same escape-at-the-boundary treatment.
        entry.sampleNotes.push(window.__cleanText(String(item.note).trim().slice(0, 200)));
        if(entry.sampleNotes.length > 5){ entry.sampleNotes = entry.sampleNotes.slice(-5); }
      }
      community[item.courseId] = entry;
      importedCount++;
    });

    saveCommunity(community);
    refreshAllCommunityBadges();
    return { ok: true, imported: importedCount, warnings: warnings };
  }

  function summarize(entry){
    var avgDifficulty = entry.difficultyVotes ? (entry.totalDifficulty / entry.difficultyVotes) : null;
    var topWorkload = null, topCount = 0;
    Object.keys(entry.workloadCounts || {}).forEach(function(w){
      if(entry.workloadCounts[w] > topCount){ topCount = entry.workloadCounts[w]; topWorkload = w; }
    });
    return { avgDifficulty: avgDifficulty, topWorkload: topWorkload, topCount: topCount, notes: entry.sampleNotes || [] };
  }

  function refreshCardBadge(prefix, slug){
    var community = loadCommunity();
    var entry = community[slug];
    var el = document.getElementById(prefix + '-c-' + slug);
    if(!el) return;
    var row = el.querySelector('.community-badge-row');
    if(!entry){
      if(row) row.remove();
      return;
    }
    var s = summarize(entry);
    var html = '';
    if(s.avgDifficulty !== null){ html += '<span class="meta-badge">⭐' + s.avgDifficulty.toFixed(1) + '</span>'; }
    if(s.topWorkload){ html += '<span class="meta-badge">⚡' + s.topWorkload + ' (' + s.topCount + ')</span>'; }
    if(s.notes.length){ html += '<span class="meta-badge" data-notes-for="' + prefix + '-c-' + slug + '">📝' + s.notes.length + '</span>'; }
    if(!html){ if(row) row.remove(); return; }
    if(!row){ row = document.createElement('div'); row.className = 'community-badge-row'; el.appendChild(row); }
    row.innerHTML = html;
  }

  function refreshAllCommunityBadges(){
    (window.__PLANS || []).forEach(function(prefix){
      var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
      Object.keys(info).forEach(function(slug){ refreshCardBadge(prefix, slug); });
    });
    bindNotePopovers();
  }

  function bindNotePopovers(){
    document.querySelectorAll('[data-notes-for]').forEach(function(badge){
      if(badge.getAttribute('data-bound') === '1') return;
      badge.setAttribute('data-bound', '1');
      badge.addEventListener('click', function(e){
        e.stopPropagation();
        var id = badge.getAttribute('data-notes-for');
        var parts = window.__splitCourseId(id);
        var community = loadCommunity();
        var entry = parts && community[parts.slug];
        showNotesPopover(badge, entry ? entry.sampleNotes : []);
      });
    });
  }

  function showNotesPopover(anchor, notes){
    var existing = document.querySelector('.community-notes-popover');
    if(existing) existing.remove();
    var pop = document.createElement('div');
    pop.className = 'community-notes-popover';
    var rect = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, rect.left) + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';
    var html = '<button type="button" class="cnp-close" aria-label="Close">&times;</button>';
    if(notes && notes.length){
      notes.forEach(function(n){ html += '<div class="cnp-note">\u201c' + n + '\u201d</div>'; });
    } else {
      html += '<div class="cnp-note">No sample notes yet.</div>';
    }
    pop.innerHTML = html;
    document.body.appendChild(pop);
    pop.querySelector('.cnp-close').addEventListener('click', function(){ pop.remove(); });
    setTimeout(function(){
      document.addEventListener('click', function onDoc(e){
        if(!pop.contains(e.target)){ pop.remove(); document.removeEventListener('click', onDoc); }
      });
    }, 0);
  }

  window.AAUP_COMMUNITY = {
    importFeedback: importFeedback,
    refreshAllCommunityBadges: refreshAllCommunityBadges,
    loadCommunity: loadCommunity
  };

  function init(){ refreshAllCommunityBadges(); }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
