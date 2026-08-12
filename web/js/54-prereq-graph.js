// ==========================
// PREREQUISITE MAP — what searching a course actually opens now
// ==========================
// Replaces the old scroll-to-and-highlight-on-the-page behavior for a
// SEARCH result specifically (js/03-search.js's window.__selectCourse and
// its floating popup are untouched — What's Next and other callers still
// use exactly that; this only changes what a manual search click does).
// Per the approved mockup: an interactive node graph of the searched
// course's real prerequisite chain, colored by real status, with a
// legend and a "what's actually left" callout computed from real data —
// not a fabricated term/calendar estimate.
(function(){
  var MAX_ANCESTOR_DEPTH = 4; // matches the mockup's visible depth; deep curricula get "closest N levels," not an unreadable wall
  var NODE_W = 168, NODE_H = 54, COL_GAP = 52, ROW_GAP = 16, PAD = 20;

  function esc(s){ return window.__escapeHtml ? window.__escapeHtml(String(s)) : String(s); }

  function isPassed(prefix, slug){
    var pid = window.AAUP_GPA.primaryId(prefix, slug);
    var progress = window.__getProgress ? window.__getProgress() : {};
    var grades = window.AAUP_GPA.loadGrades();
    return !!progress[pid] && !window.AAUP_GPA.isNonPassing(grades[pid]);
  }

  function statusFor(prefix, slug){
    if(isPassed(prefix, slug)) return 'passed';
    var pid = window.AAUP_GPA.primaryId(prefix, slug);
    var statuses = window.AAUP_GPA.loadStatuses();
    if(statuses[pid] === 'in_progress') return 'in_progress';
    var needs = ((window.__PLAN_DATA[prefix] || {}).needsMap || {})[slug] || [];
    var locked = needs.some(function(n){ return !isPassed(prefix, n); });
    return locked ? 'locked' : 'unlocked';
  }

  function gradeFor(prefix, slug){
    var pid = window.AAUP_GPA.primaryId(prefix, slug);
    return window.AAUP_GPA.loadGrades()[pid] || '';
  }

  // Ancestors up to MAX_ANCESTOR_DEPTH levels back (BFS, depth-limited —
  // a capstone course's true transitive closure can be dozens of courses
  // deep; a graph nobody can read isn't more useful than none), plus the
  // selected course's own direct unlocks (one level forward, matching what
  // the mockup shows — full transitive descendants would be the whole rest
  // of the degree for an early course).
  function collectNodes(prefix, slug){
    var data = window.__PLAN_DATA[prefix] || {};
    var needsMap = data.needsMap || {};
    var unlocksMap = data.unlocksMap || {};
    var depth = {};
    depth[slug] = 0;
    var queue = [slug];
    var truncated = false;
    while(queue.length){
      var cur = queue.shift();
      if(depth[cur] >= MAX_ANCESTOR_DEPTH){ truncated = truncated || (needsMap[cur] || []).length > 0; continue; }
      (needsMap[cur] || []).forEach(function(p){
        if(depth[p] !== undefined) return;
        depth[p] = depth[cur] + 1;
        queue.push(p);
      });
    }
    var children = (unlocksMap[slug] || []).slice();
    return { ancestorDepth: depth, children: children, truncated: truncated };
  }

  function layout(prefix, slug){
    var collected = collectNodes(prefix, slug);
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var ancestorSlugs = Object.keys(collected.ancestorDepth).filter(function(s){ return s !== slug; });
    // Column = distance from the selected course: ancestorDepth is BFS hops
    // BACKWARD from the selected course, so a deeper ancestor (more hops)
    // belongs FURTHER left — negate it directly. The selected course sits
    // at 0, its direct unlocks at +1.
    var columns = {}; // level -> [slug]
    function place(s, level){ (columns[level] = columns[level] || []).push(s); }
    ancestorSlugs.forEach(function(s){ place(s, -collected.ancestorDepth[s]); });
    place(slug, 0);
    collected.children.forEach(function(s){ place(s, 1); });

    var levels = Object.keys(columns).map(Number).sort(function(a, b){ return a - b; });
    var pos = {}; // slug -> {x, y, level}
    levels.forEach(function(level, colIndex){
      columns[level].forEach(function(s, rowIndex){
        pos[s] = { x: PAD + colIndex * (NODE_W + COL_GAP), y: PAD + rowIndex * (NODE_H + ROW_GAP), level: level };
      });
    });

    var allSlugs = Object.keys(pos);
    var width = Math.max.apply(null, allSlugs.map(function(s){ return pos[s].x; })) + NODE_W + PAD;
    var height = Math.max.apply(null, allSlugs.map(function(s){ return pos[s].y; })) + NODE_H + PAD;

    // Every edge worth drawing: prerequisite -> dependent, for pairs where
    // BOTH ends made it into this bounded node set.
    var edges = [];
    allSlugs.forEach(function(s){
      var needs = ((window.__PLAN_DATA[prefix] || {}).needsMap || {})[s] || [];
      needs.forEach(function(n){ if(pos[n]){ edges.push([n, s]); } });
    });

    return { pos: pos, edges: edges, width: width, height: height, info: info, truncated: collected.truncated };
  }

  function statusColor(st){
    return { passed: '#2ecc71', in_progress: 'var(--accent)', unlocked: '#f5a623', locked: 'var(--line)' }[st] || 'var(--line)';
  }

  function nodeHTML(prefix, slug, isSelected, rtl, t){
    var meta = ((window.__PLAN_DATA[prefix] || {}).courseInfo || {})[slug] || {};
    var name = rtl && meta.ar ? meta.ar : (meta.name || slug);
    var st = statusFor(prefix, slug);
    var sub = st === 'passed' ? (t.passed + (gradeFor(prefix, slug) ? ' · ' + esc(gradeFor(prefix, slug)) : ''))
      : st === 'in_progress' ? t.inProgress
      : st === 'unlocked' ? t.unlocked
      : t.locked;
    return '<div class="pg-node pg-node-' + st + (isSelected ? ' pg-node-selected' : '') + '" data-pg-slug="' + esc(slug) + '" tabindex="0" role="button">' +
      '<div class="pg-node-name">' + esc(name) + '</div>' +
      '<div class="pg-node-sub">' + esc(meta.num || '') + (meta.num ? ' · ' : '') + esc(sub) + '</div>' +
    '</div>';
  }

  function edgePath(a, b){
    var x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
    var x2 = b.x, y2 = b.y + NODE_H / 2;
    var midX = (x1 + x2) / 2;
    return 'M ' + x1 + ',' + y1 + ' C ' + midX + ',' + y1 + ' ' + midX + ',' + y2 + ' ' + x2 + ',' + y2;
  }

  // "What's actually left" — the chain of NOT-yet-passed prerequisites
  // between the selected course and where the student really is, walked
  // backward through needsMap. Hop count and credit-hour sum are both read
  // straight off the plan's own data; nothing here is a calendar guess.
  function remainingChain(prefix, slug){
    if(isPassed(prefix, slug)) return null;
    var info = (window.__PLAN_DATA[prefix] || {}).courseInfo || {};
    var needsMap = (window.__PLAN_DATA[prefix] || {}).needsMap || {};
    // Longest remaining-prerequisite chain ending at slug, since that's the
    // real bottleneck — finishing the short branch of a diamond doesn't
    // unlock anything if the long branch is still outstanding.
    var memo = {};
    function longest(s){
      if(memo[s]) return memo[s];
      var needs = (needsMap[s] || []).filter(function(n){ return !isPassed(prefix, n); });
      if(!needs.length){ return (memo[s] = isPassed(prefix, s) ? [] : [s]); }
      var best = [];
      needs.forEach(function(n){
        var chain = longest(n);
        if(chain.length > best.length) best = chain;
      });
      memo[s] = best.concat(isPassed(prefix, s) ? [] : [s]);
      return memo[s];
    }
    var chain = longest(slug);
    var ch = chain.reduce(function(sum, s){ return sum + (parseFloat((info[s] || {}).cr) || 0); }, 0);
    return { chain: chain, hops: chain.length, ch: ch };
  }

  function selectedPanelHTML(prefix, slug, rtl, t){
    var meta = ((window.__PLAN_DATA[prefix] || {}).courseInfo || {})[slug] || {};
    var name = rtl && meta.ar ? meta.ar : (meta.name || slug);
    var st = statusFor(prefix, slug);
    var needs = ((window.__PLAN_DATA[prefix] || {}).needsMap || {})[slug] || [];
    var needNames = needs.map(function(n){
      var nm = ((window.__PLAN_DATA[prefix] || {}).courseInfo || {})[n] || {};
      return (rtl && nm.ar ? nm.ar : nm.name || n) + (isPassed(prefix, n) ? ' ✓' : '');
    });
    var body;
    if(st === 'passed'){
      body = t.alreadyDone;
    } else if(!needs.length){
      body = t.noPrereqs;
    } else {
      body = t.needsList(needNames);
    }
    return '<div class="pg-selected"><div class="pg-panel-label">' + t.selectedLabel + '</div>' +
      '<h3 style="margin:2px 0 6px;">' + esc(name) + '</h3>' +
      '<p class="form-note" style="margin:0;">' + body + '</p></div>';
  }

  function legendHTML(t){
    return '<div class="pg-legend"><div class="pg-panel-label">' + t.legendLabel + '</div>' +
      ['passed', 'in_progress', 'unlocked', 'locked'].map(function(st){
        return '<div class="pg-legend-row"><span class="pg-legend-dot" style="background:' + statusColor(st) + ';"></span>' + t[st === 'in_progress' ? 'inProgress' : st] + '</div>';
      }).join('') + '</div>';
  }

  function routeHTML(prefix, slug, rtl, t){
    var r = remainingChain(prefix, slug);
    if(!r) return '';
    if(!r.hops) return '';
    var names = r.chain.map(function(s){
      var m = ((window.__PLAN_DATA[prefix] || {}).courseInfo || {})[s] || {};
      return rtl && m.ar ? m.ar : (m.name || s);
    });
    return '<div class="pg-route"><div class="pg-panel-label">' + t.routeLabel + '</div>' +
      '<p style="margin:0 0 6px;font-weight:700;">' + names.join(' → ') + '</p>' +
      '<p class="form-note" style="margin:0;">' + t.routeStats(r.hops, r.ch) + '</p></div>';
  }

  var T = {
    en: {
      title: function(name){ return 'Prerequisite map · ' + name; },
      subtitle: function(n){ return n + ' links across this plan'; },
      selectedLabel: 'SELECTED', legendLabel: 'LEGEND', routeLabel: 'SHORTEST ROUTE',
      passed: 'passed', inProgress: 'in progress', unlocked: 'unlocked — you can take it', locked: 'locked behind something',
      alreadyDone: 'Already completed.', noPrereqs: 'No prerequisites — open to take now.',
      needsList: function(names){ return 'Needs ' + names.join(' and ') + '.'; },
      routeStats: function(hops, ch){ return hops + (hops === 1 ? ' course' : ' courses') + ' · ' + Math.round(ch) + ' credit hours'; },
      truncated: 'Showing your closest prerequisites — this chain goes back further.'
    },
    ar: {
      title: function(name){ return 'خريطة المتطلبات السابقة · ' + name; },
      subtitle: function(n){ return n + ' رابطًا في هذه الخطة'; },
      selectedLabel: 'المحدد', legendLabel: 'المفتاح', routeLabel: 'أقصر مسار',
      passed: 'منجز', inProgress: 'قيد الدراسة', unlocked: 'متاح — يمكنك أخذه', locked: 'مغلق خلف مساق آخر',
      alreadyDone: 'أُنجز بالفعل.', noPrereqs: 'لا متطلبات سابقة — متاح الآن.',
      needsList: function(names){ return 'يتطلب ' + names.join(' و') + '.'; },
      routeStats: function(hops, ch){ return hops + ' مساق · ' + Math.round(ch) + ' ساعة معتمدة'; },
      truncated: 'يُعرض أقرب المتطلبات فقط — هذه السلسلة تمتد أبعد من ذلك.'
    }
  };

  function render(prefix, slug, selectedSlug){
    var body = document.getElementById('prereqGraphModalBody');
    if(!body) return;
    var rtl = window.__isRtl ? window.__isRtl(prefix) : false;
    var t = T[rtl ? 'ar' : 'en'];
    var g = layout(prefix, slug);
    var sel = selectedSlug || slug;

    var nodesHTML = Object.keys(g.pos).map(function(s){
      return '<div style="position:absolute; left:' + g.pos[s].x + 'px; top:' + g.pos[s].y + 'px; width:' + NODE_W + 'px;">' +
        nodeHTML(prefix, s, s === sel, rtl, t) + '</div>';
    }).join('');
    var edgesHTML = g.edges.map(function(e){
      var solid = statusFor(prefix, e[1]) !== 'locked' || statusFor(prefix, e[0]) === 'passed';
      return '<path class="pg-edge' + (solid ? '' : ' pg-edge-dashed') + '" d="' + edgePath(g.pos[e[0]], g.pos[e[1]]) + '"></path>';
    }).join('');

    var meta = g.info[slug] || {};
    var name = rtl && meta.ar ? meta.ar : (meta.name || slug);
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    body.innerHTML =
      '<div class="pg-head"><div><h2 style="margin:0;">' + esc(t.title(name)) + '</h2>' +
      '<p class="form-note" style="margin-top:4px;">' + esc(t.subtitle(g.edges.length)) + '</p></div></div>' +
      (g.truncated ? '<p class="form-note pg-truncated">' + esc(t.truncated) + '</p>' : '') +
      '<div class="pg-body">' +
        '<div class="pg-graph-wrap"><div class="pg-graph" style="width:' + g.width + 'px; height:' + g.height + 'px;">' +
          '<svg width="' + g.width + '" height="' + g.height + '" class="pg-svg">' + edgesHTML + '</svg>' +
          nodesHTML +
        '</div></div>' +
        '<div class="pg-side">' +
          selectedPanelHTML(prefix, sel, rtl, t) +
          legendHTML(t) +
          routeHTML(prefix, sel, rtl, t) +
        '</div>' +
      '</div>';

    body.querySelectorAll('[data-pg-slug]').forEach(function(el){
      el.addEventListener('click', function(){
        render(prefix, slug, el.getAttribute('data-pg-slug'));
      });
    });
  }

  function open(prefix, slug){
    var overlay = document.getElementById('prereqGraphModalOverlay');
    if(!overlay) return;
    render(prefix, slug, slug);
    overlay.classList.add('open');
  }
  function close(){
    var overlay = document.getElementById('prereqGraphModalOverlay');
    if(overlay){ overlay.classList.remove('open'); }
  }

  function initModalClose(){
    var closeBtn = document.getElementById('prereqGraphModalClose');
    var overlay = document.getElementById('prereqGraphModalOverlay');
    if(closeBtn){ closeBtn.addEventListener('click', close); }
    if(overlay){ overlay.addEventListener('click', function(e){ if(e.target === overlay){ close(); } }); }
  }
  if(document.readyState === 'complete'){ initModalClose(); }
  else { window.addEventListener('load', initModalClose); }

  window.AAUP_PREREQ_GRAPH = { open: open, close: close };
})();
