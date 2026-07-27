// ==========================
// PER-SEMESTER WORKLOAD SUMMARY — surfaces the private Easy/Medium/Hard
// difficulty ratings the student can already set on each course (from its
// details popup) as a small "⚡2 hard · 1 easy" roll-up on every semester
// header, so the data the app was already collecting is actually shown
// back. Reads the exact same aaup_ratings map the course badges use.
// ==========================
(function(){
  function rootFor(prefix){ return document.getElementById('page-' + prefix); }

  // Built-in majors group a semester as `.sem` (label = .sem-label);
  // imported plans as `.imp-semester-block` (label = .imp-semester-title).
  function semesterBlocks(root){
    var built = root.querySelectorAll('.sem');
    if(built.length) return Array.prototype.slice.call(built).map(function(el){
      return { block: el, label: el.querySelector('.sem-label') };
    });
    return Array.prototype.slice.call(root.querySelectorAll('.imp-semester-block')).map(function(el){
      return { block: el, label: el.querySelector('.imp-semester-title') };
    });
  }

  function refresh(prefix){
    var root = rootFor(prefix);
    if(!root) return;
    var ratings = (window.AAUP_PERSONAL && window.AAUP_PERSONAL.loadRatings) ? window.AAUP_PERSONAL.loadRatings() : {};
    var rtl = root.classList.contains('rtl-mode');
    var LABELS = rtl
      ? { Hard: 'صعب', Medium: 'متوسط', Easy: 'سهل' }
      : { Hard: 'hard', Medium: 'medium', Easy: 'easy' };

    semesterBlocks(root).forEach(function(entry){
      var label = entry.label;
      if(!label) return;
      var counts = { Hard: 0, Medium: 0, Easy: 0 };
      var seen = {};
      entry.block.querySelectorAll('.course[id]:not(.course-removed)').forEach(function(course){
        var parts = window.__splitCourseId(course.id);
        if(!parts) return;
        // A lecture + its lab share one rating (same primaryId) — count once.
        var pid = (window.AAUP_GPA && window.AAUP_GPA.primaryId) ? window.AAUP_GPA.primaryId(parts.prefix, parts.slug) : course.id;
        if(seen[pid]) return;
        seen[pid] = true;
        var w = ratings[pid] && ratings[pid].workload;
        if(w && counts.hasOwnProperty(w)){ counts[w]++; }
      });

      var existing = label.querySelector('.sem-workload');
      var total = counts.Hard + counts.Medium + counts.Easy;
      if(!total){ if(existing) existing.remove(); return; }
      var parts = [];
      ['Hard','Medium','Easy'].forEach(function(k){
        if(counts[k]){
          parts.push('<span class="swl swl-' + k.toLowerCase() + '">' + counts[k] + ' ' + LABELS[k] + '</span>');
        }
      });
      var html = parts.join('');
      if(!existing){
        existing = document.createElement('span');
        existing.className = 'sem-workload';
        label.appendChild(existing);
      }
      existing.innerHTML = html;
    });
  }

  window.__refreshWorkloadSummary = refresh;
})();
