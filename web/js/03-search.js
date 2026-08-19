/* =====================================================================
   SEARCH (shared)
   Search, cross-highlighting, and the floating course popup.
   Reads the COURSE_INFO / PREREQS data that each plan's own script
   registers via window.__registerPlanData(). Nothing here touches the
   existing per-plan drawing/hover/modal logic — it only adds classes
   with new names (search-*) and a separate popup element.
   ===================================================================== */
(function(){

  function normalize(s){
    return (s || '').toString().trim().toLowerCase()
      .replace(/[\u064B-\u0652\u0670\u0640]/g,'')      // Arabic diacritics/tatweel
      .replace(/[\u0623\u0625\u0622\u0671]/g,'\u0627') // alef variants -> ا
      .replace(/\u0649/g,'\u064A')                     // alef maksura -> ya
      .replace(/\s+/g,' ');
  }

  function escapeHTML(s){
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function isRtl(prefix){
    var page = document.getElementById('page-' + prefix);
    return !!(page && page.classList.contains('rtl-mode'));
  }

  // ---- typo tolerance: a fallback only, never the primary match. Exact
  // substring matching (below) stays first and untouched — this only kicks
  // in when it finds nothing, so a correctly-typed query behaves exactly as
  // it always has. Compares the query against each word of the text with a
  // classic edit-distance, tolerant threshold scaling with query length so
  // "cs" doesn't fuzzy-match half the catalogue.
  function levenshtein(a, b){
    if(a === b) return 0;
    var al = a.length, bl = b.length;
    if(!al) return bl;
    if(!bl) return al;
    var prev = new Array(bl + 1);
    for(var j = 0; j <= bl; j++) prev[j] = j;
    for(var i = 1; i <= al; i++){
      var cur = [i];
      for(var jj = 1; jj <= bl; jj++){
        var cost = a.charAt(i - 1) === b.charAt(jj - 1) ? 0 : 1;
        cur[jj] = Math.min(prev[jj] + 1, cur[jj - 1] + 1, prev[jj - 1] + cost);
      }
      prev = cur;
    }
    return prev[bl];
  }
  function fuzzyContains(q, text){
    if(q.length < 3) return false;
    var threshold = q.length <= 5 ? 1 : (q.length <= 9 ? 2 : 3);
    var words = text.split(/\s+/);
    for(var i = 0; i < words.length; i++){
      var w = words[i];
      if(!w || Math.abs(w.length - q.length) > threshold + 2) continue;
      if(levenshtein(q, w) <= threshold) return true;
    }
    return false;
  }

  /* ---------------- generic search-box wiring ---------------- */
  function renderDropdown(dropdownEl, results, opts){
    dropdownEl.innerHTML = '';
    if(!results.length){
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = opts.emptyText || 'No matches';
      dropdownEl.appendChild(empty);
      dropdownEl.classList.add('open');
      return;
    }
    results.forEach(function(r){
      var hit = document.createElement('div');
      hit.className = 'search-hit';
      var en = document.createElement('div');
      en.className = 'sh-en';
      en.textContent = r.en;
      hit.appendChild(en);
      if(r.ar){
        var ar = document.createElement('div');
        ar.className = 'sh-ar';
        ar.textContent = r.ar;
        hit.appendChild(ar);
      }
      if(r.code){
        var meta = document.createElement('div');
        meta.className = 'sh-meta';
        meta.textContent = r.code;
        hit.appendChild(meta);
      }
      hit.addEventListener('mousedown', function(e){
        e.preventDefault();
        opts.onSelect(r);
      });
      dropdownEl.appendChild(hit);
    });
    dropdownEl.classList.add('open');
  }

  function attachSearch(opts){
    var input = opts.input, box = opts.box, clearBtn = opts.clear, dropdown = opts.dropdown;
    var activeIndex = -1, currentResults = [];

    function runSearch(){
      var q = normalize(input.value);
      box.classList.toggle('has-value', input.value.length > 0);
      if(!q){ dropdown.classList.remove('open'); currentResults = []; return; }
      var all = opts.getIndex();
      currentResults = all.filter(function(item){
        return normalize(item.en).indexOf(q) !== -1 ||
               normalize(item.ar).indexOf(q) !== -1 ||
               (item.code && item.code.toLowerCase().indexOf(q) !== -1);
      });
      // Nothing matched exactly — try a typo-tolerant pass before giving up.
      if(!currentResults.length){
        currentResults = all.filter(function(item){
          return fuzzyContains(q, normalize(item.en)) || fuzzyContains(q, normalize(item.ar));
        });
      }
      currentResults = currentResults.slice(0, 10);
      activeIndex = -1;
      renderDropdown(dropdown, currentResults, {
        emptyText: opts.emptyText,
        onSelect: function(r){
          input.value = r.en;
          dropdown.classList.remove('open');
          box.classList.remove('has-value');
          opts.onSelect(r);
        }
      });
    }

    input.addEventListener('input', runSearch);
    input.addEventListener('focus', function(){ if(input.value) runSearch(); });
    input.addEventListener('keydown', function(e){
      var hits = dropdown.querySelectorAll('.search-hit');
      if(e.key === 'ArrowDown'){
        if(!hits.length) return;
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, hits.length - 1);
        hits.forEach(function(h,i){ h.classList.toggle('active-hit', i === activeIndex); });
        hits[activeIndex].scrollIntoView({block:'nearest'});
      } else if(e.key === 'ArrowUp'){
        if(!hits.length) return;
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        hits.forEach(function(h,i){ h.classList.toggle('active-hit', i === activeIndex); });
        hits[activeIndex].scrollIntoView({block:'nearest'});
      } else if(e.key === 'Enter'){
        e.preventDefault();
        var pick = (activeIndex >= 0 && currentResults[activeIndex]) ? currentResults[activeIndex] : currentResults[0];
        if(pick){
          input.value = pick.en;
          dropdown.classList.remove('open');
          box.classList.remove('has-value');
          opts.onSelect(pick);
        }
      } else if(e.key === 'Escape'){
        dropdown.classList.remove('open');
      }
    });
    document.addEventListener('click', function(e){
      if(!box.contains(e.target) && !dropdown.contains(e.target)){
        dropdown.classList.remove('open');
      }
    });
    if(clearBtn){
      clearBtn.addEventListener('click', function(){
        input.value = '';
        box.classList.remove('has-value');
        dropdown.classList.remove('open');
        input.focus();
      });
    }
  }

  /* ---------------- homepage major search ---------------- */
  function initHomeSearch(){
    var input = document.getElementById('homeSearchInput');
    var box = document.getElementById('homeSearchBox');
    var clear = document.getElementById('homeSearchClear');
    var dropdown = document.getElementById('homeSearchDropdown');
    if(!input) return;
    // Rebuilt on every keystroke rather than snapshotted once at init —
    // imported/custom plan cards (and their data-search-* attributes) are
    // re-rendered into the DOM whenever a plan is created/edited/deleted,
    // well after this module's own load-time init runs.
    function buildIndex(){
      return Array.prototype.map.call(document.querySelectorAll('.plan-card[data-page]'), function(el){
        return { page: el.dataset.page, imported: el.dataset.imported === '1', en: el.dataset.searchEn || '', ar: el.dataset.searchAr || '', el: el };
      });
    }
    attachSearch({
      input: input, box: box, clear: clear, dropdown: dropdown,
      getIndex: buildIndex,
      emptyText: 'No matching major found / لا يوجد تخصص مطابق',
      onSelect: function(r){
        input.value = '';
        box.classList.remove('has-value');
        if(r.imported && window.AAUP_DASHBOARD){ window.AAUP_DASHBOARD.selectAndOpen(r.page); }
        else { showPage(r.page); }
      }
    });
  }

  /* ---------------- per-plan course search ---------------- */
  function buildCourseIndex(prefix){
    var data = window.__PLAN_DATA[prefix];
    if(!data) return;
    var nodes = document.querySelectorAll('#page-' + prefix + ' .course[id]');
    var idx = [];
    nodes.forEach(function(el){
      var nameEl = el.querySelector('.name');
      if(!nameEl) return;
      var slug = el.id.replace(prefix + '-c-', '');
      var en = (nameEl.dataset.en || nameEl.textContent || '').trim();
      var ar = nameEl.getAttribute('data-ar') || '';
      var info = data.courseInfo[slug];
      idx.push({ slug: slug, id: el.id, en: en, ar: ar, code: info ? info.num : '' });
    });
    data.index = idx;
  }

  function courseLabel(prefix, slug){
    var data = window.__PLAN_DATA[prefix];
    var item = data && data.index && data.index.filter(function(i){ return i.slug === slug; })[0];
    if(!item) return slug;
    return (isRtl(prefix) && item.ar) ? item.ar : item.en;
  }

  function initCourseSearch(prefix){
    var input = document.getElementById(prefix + '-courseSearchInput');
    var box = document.getElementById(prefix + '-courseSearchBox');
    var clear = document.getElementById(prefix + '-courseSearchClear');
    var dropdown = document.getElementById(prefix + '-courseSearchDropdown');
    if(!input) return;
    buildCourseIndex(prefix);
    attachSearch({
      input: input, box: box, clear: clear, dropdown: dropdown,
      getIndex: function(){ return (window.__PLAN_DATA[prefix] && window.__PLAN_DATA[prefix].index) || []; },
      emptyText: 'No matching course found / لا يوجد مساق مطابق',
      onSelect: function(r){
        input.value = '';
        box.classList.remove('has-value');
        // Searching a course now opens its prerequisite map (js/54-prereq-
        // graph.js) — the approved mockup for what a search result looks
        // like — instead of the old scroll-to-and-highlight-on-the-page
        // behavior. selectCourse() itself is untouched and still exposed
        // as window.__selectCourse for other callers (What's Next) that
        // want that original behavior, not this one.
        if(window.AAUP_PREREQ_GRAPH){ window.AAUP_PREREQ_GRAPH.open(prefix, r.slug); }
        else { selectCourse(prefix, r.slug); }
      }
    });
  }

  function updateSearchPlaceholder(prefix){
    var input = document.getElementById(prefix + '-courseSearchInput');
    if(!input) return;
    input.placeholder = isRtl(prefix)
      ? (input.dataset.phAr || input.placeholder)
      : (input.dataset.phEn || input.placeholder);
  }

  /* ---------------- cross-highlighting on the plan page ---------------- */
  var currentHighlightPrefix = null;

  function addBadge(el, symbol){
    var b = document.createElement('span');
    b.className = 'search-badge';
    b.textContent = symbol;
    el.appendChild(b);
  }

  function clearHighlights(prefix){
    if(!prefix) return;
    var page = document.getElementById('page-' + prefix);
    if(!page) return;
    page.querySelectorAll('.course.search-selected, .course.search-prereq, .course.search-unlock').forEach(function(el){
      el.classList.remove('search-selected','search-prereq','search-unlock');
      var b = el.querySelector('.search-badge');
      if(b) b.remove();
    });
    var svg = document.getElementById(prefix + '-connectorSvg');
    if(svg){
      svg.querySelectorAll('path.edge').forEach(function(p){
        p.classList.remove('search-active','search-dim');
        p.style.strokeDasharray = '';
        p.style.strokeDashoffset = '';
      });
    }
  }

  function selectCourse(prefix, slug){
    clearHighlights(currentHighlightPrefix);
    currentHighlightPrefix = prefix;

    var el = document.getElementById(prefix + '-c-' + slug);
    if(!el) return;

    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('search-selected');

    var data = window.__PLAN_DATA[prefix] || {};
    var needs = (data.needsMap && data.needsMap[slug]) || [];
    var unlocks = (data.unlocksMap && data.unlocksMap[slug]) || [];

    needs.forEach(function(s){
      var e = document.getElementById(prefix + '-c-' + s);
      if(e){ e.classList.add('search-prereq'); addBadge(e, '✅'); }
    });
    unlocks.forEach(function(s){
      var e = document.getElementById(prefix + '-c-' + s);
      if(e){ e.classList.add('search-unlock'); addBadge(e, '🔓'); }
    });

    var svg = document.getElementById(prefix + '-connectorSvg');
    if(svg){
      var id = prefix + '-c-' + slug;
      var allPaths = Array.prototype.slice.call(svg.querySelectorAll('path.edge'));
      var relatedPaths = allPaths.filter(function(p){
        return p.getAttribute('data-from') === id || p.getAttribute('data-to') === id;
      });
      // Same "sketch" draw-in technique as the hover trace: measure real
      // path length first so the transition has an exact starting point.
      relatedPaths.forEach(function(p){
        var len; try{ len = p.getTotalLength(); }catch(e){ len = 2000; }
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
      });
      void svg.getBoundingClientRect();
      requestAnimationFrame(function(){
        allPaths.forEach(function(p){
          var related = relatedPaths.indexOf(p) !== -1;
          p.classList.toggle('search-active', related);
          p.classList.toggle('search-dim', !related);
          // Same specificity fix as the hover trace: the target value has
          // to be set inline too, or the class's stroke-dashoffset:0 is
          // silently beaten by the inline starting value set above.
          if(related){ p.style.strokeDashoffset = 0; }
        });
      });
    }

    openFloatingPopup(prefix, slug);
  }
  // Exposed so other features (e.g. the "What Can I Take Next" sidebar list)
  // can trigger the exact same scroll + highlight + popup behavior as a
  // manual search selection, instead of re-implementing it.
  window.__selectCourse = selectCourse;
  // Exposed so imported/custom plans reuse the exact same search box +
  // dropdown + keyboard navigation the built-in majors already have,
  // instead of a second implementation.
  window.__buildCourseIndex = buildCourseIndex;
  window.__attachSearch = attachSearch;

  /* ---------------- floating draggable popup ---------------- */
  var popupEl, popupHead, popupTitle, popupBody, popupCloseBtn;
  var POPUP_POS_KEY = 'aaup_popupPos';
  function loadPopupPos(){
    try{
      var v = JSON.parse(localStorage.getItem(POPUP_POS_KEY));
      return (v && typeof v.left === 'string' && typeof v.top === 'string') ? v : null;
    }catch(e){ return null; }
  }
  function savePopupPos(pos){
    try{ localStorage.setItem(POPUP_POS_KEY, JSON.stringify(pos)); }catch(e){}
  }
  var lastPopupPos = loadPopupPos();

  function listHTML(prefix, slugs){
    return '<ul>' + slugs.map(function(s){
      return '<li>' + escapeHTML(courseLabel(prefix, s)) + '</li>';
    }).join('') + '</ul>';
  }

  function whyNeedsText(prefix, slug, needs, rtl){
    var courseName = courseLabel(prefix, slug);
    var needNames = needs.map(function(s){ return courseLabel(prefix, s); }).join(rtl ? '، ' : ', ');
    return rtl
      ? ('يبني مساق «' + courseName + '» على المفاهيم والمهارات التي تُكتسب في ' + needNames + '، لذلك يجب إنهاء هذه المساقات أولًا لضمان الاستعداد الكافي لمتابعة محتواه بنجاح.')
      : ('"' + courseName + '" builds directly on the concepts and skills covered in ' + needNames + ', so those courses must be completed first to make sure you have the right foundation.');
  }

  function whyUnlocksText(prefix, slug, unlocks, rtl){
    var courseName = courseLabel(prefix, slug);
    var unlockNames = unlocks.map(function(s){ return courseLabel(prefix, s); }).join(rtl ? '، ' : ', ');
    return rtl
      ? ('يمنحك مساق «' + courseName + '» الأساس اللازم للانتقال إلى ' + unlockNames + '، حيث تُبنى تلك المساقات على ما يتم تعلمه هنا.')
      : ('"' + courseName + '" gives you the foundation you need to move on to ' + unlockNames + ', which build on what you learn here.');
  }

  function consequenceText(prefix, slug, unlocks, rtl){
    var courseName = courseLabel(prefix, slug);
    if(unlocks.length){
      var unlockNames = unlocks.map(function(s){ return courseLabel(prefix, s); }).join(rtl ? '، ' : ', ');
      return rtl
        ? ('إذا لم تنجح في مساق «' + courseName + '»، فلن تتمكن من التسجيل في ' + unlockNames + ' في الفصل التالي لأنها تتطلبه كمتطلب سابق — وهذا قد يؤخر خطتك الدراسية فصلاً دراسياً كاملاً أو أكثر. لهذا السبب من المهم جداً إعادته في الفصل الصيفي: فالإعادة الصيفية تتيح لك اجتياز المتطلب بسرعة والعودة إلى مسارك الطبيعي في الفصل التالي، بدلاً من خسارة فصل دراسي كامل بانتظار الطرح النظامي التالي للمساق.')
        : ('If you don\u2019t pass "' + courseName + '", you won\u2019t be able to register for ' + unlockNames + ' next semester, since they list it as a prerequisite — which can push your whole plan back by a semester or more. That\u2019s exactly why it\u2019s important to retake it in the summer semester: a summer retake clears the prerequisite quickly so you\u2019re back on track for the following fall/spring, instead of losing a full semester waiting for the next regular offering.');
    }
    return rtl
      ? ('يبقى مساق «' + courseName + '» متطلبًا أساسيًا لإكمال ساعات التخرج، لذا فإن الرسوب فيه يعني ضرورة إعادته. تأجيله إلى الفصل النظامي التالي (خريف أو ربيع) يضيف عبئًا إضافيًا على جدول دراسي مزدحم أصلاً وقد يؤخر موعد تخرجك. أما إعادته في الفصل الصيفي فتتيح لك إنهاءه مبكرًا دون التأثير على باقي مساقاتك، والحفاظ على مسارك الدراسي دون تأخير.')
      : ('"' + courseName + '" is still a required course for your graduation credit hours, so failing it means retaking it before those requirements are complete. Leaving it for the next regular fall/spring semester adds extra load to an already full schedule and can delay your graduation date. Retaking it in summer clears it out of the way early, without crowding your other courses, and keeps the rest of your plan on schedule.');
  }

  function buildPopupHTML(prefix, slug){
    var data = window.__PLAN_DATA[prefix] || {};
    var rtl = isRtl(prefix);
    var needs = (data.needsMap && data.needsMap[slug]) || [];
    var unlocks = (data.unlocksMap && data.unlocksMap[slug]) || [];

    var L = rtl ? {
      needs:'المتطلبات السابقة (تحتاج إلى)', unlocks:'يفتح المجال أمام',
      whyNeeds:'لماذا تحتاج إلى هذه المتطلبات', whyUnlocks:'كيف يؤهلك هذا المساق للمساقات التالية',
      none:'لا توجد متطلبات سابقة لهذا المساق.',
      noneUnlocks:'هذا المساق لا يفتح مساقات لاحقة مباشرة ضمن المخطط.',
      consequence:'ماذا لو لم تنجح في هذا المساق؟'
    } : {
      needs:'Prerequisites (Needs)', unlocks:'Unlocks',
      whyNeeds:'Why you need these prerequisites', whyUnlocks:'Why this course unlocks the following courses',
      none:'This course has no prerequisites.',
      noneUnlocks:'This course does not directly unlock further courses in the plan.',
      consequence:'If you don\u2019t pass this course'
    };

    var html = '';
    html += '<h4><span class="badge-ic">✅</span>' + L.needs + '</h4>';
    html += needs.length ? listHTML(prefix, needs) : ('<div class="fp-empty">' + L.none + '</div>');
    if(needs.length){
      html += '<h4>' + L.whyNeeds + '</h4>';
      html += '<div class="fp-why">' + escapeHTML(whyNeedsText(prefix, slug, needs, rtl)) + '</div>';
    }

    html += '<h4><span class="badge-ic">🔓</span>' + L.unlocks + '</h4>';
    html += unlocks.length ? listHTML(prefix, unlocks) : ('<div class="fp-empty">' + L.noneUnlocks + '</div>');
    if(unlocks.length){
      html += '<h4>' + L.whyUnlocks + '</h4>';
      html += '<div class="fp-why">' + escapeHTML(whyUnlocksText(prefix, slug, unlocks, rtl)) + '</div>';
    }

    html += '<h4><span class="badge-ic">⚠️</span>' + L.consequence + '</h4>';
    html += '<div class="fp-warn">' + escapeHTML(consequenceText(prefix, slug, unlocks, rtl)) + '</div>';

    return html;
  }

  function refreshPopupContent(prefix, slug){
    var rtl = isRtl(prefix);
    popupEl.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    popupTitle.textContent = (rtl ? 'المساق: ' : 'Course: ') + courseLabel(prefix, slug);
    popupBody.innerHTML = buildPopupHTML(prefix, slug);
  }

  function positionPopup(){
    if(lastPopupPos){
      popupEl.style.left = lastPopupPos.left;
      popupEl.style.top = lastPopupPos.top;
      popupEl.style.right = 'auto';
      // Mobile's default placement pins the popup with `bottom` (see the
      // max-width:640px rule); once it's been dragged even once, top/left
      // drive its position instead, and leaving the old `bottom` in place
      // too would fight them for the box's height.
      popupEl.style.bottom = 'auto';
    }
  }

  function openFloatingPopup(prefix, slug){
    if(!popupEl) return;
    positionPopup();
    refreshPopupContent(prefix, slug);
    popupEl.classList.remove('minimized');
    popupEl.style.display = 'block';
    popupEl.dataset.prefix = prefix;
    popupEl.dataset.slug = slug;
  }

  function closeFloatingPopup(){
    if(!popupEl || popupEl.style.display === 'none') return;
    popupEl.style.display = 'none';
    clearHighlights(currentHighlightPrefix);
    currentHighlightPrefix = null;
  }

  function initFloatingPopup(){
    popupEl = document.getElementById('floatPopup');
    popupHead = document.getElementById('floatPopupHead');
    popupTitle = document.getElementById('floatPopupTitle');
    popupBody = document.getElementById('floatPopupBody');
    popupCloseBtn = document.getElementById('floatPopupClose');
    var popupMinBtn = document.getElementById('floatPopupMin');
    if(!popupEl) return;

    popupCloseBtn.addEventListener('click', closeFloatingPopup);
    if(popupMinBtn){
      popupMinBtn.addEventListener('click', function(){
        popupEl.classList.toggle('minimized');
      });
    }

    var dragging = false, startX, startY, startLeft, startTop;
    popupHead.addEventListener('pointerdown', function(e){
      if(e.target.closest('.float-popup-close, .float-popup-min')) return;
      dragging = true;
      var rect = popupEl.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      popupEl.style.right = 'auto';
      popupEl.style.bottom = 'auto';
      popupEl.style.left = startLeft + 'px';
      popupEl.style.top = startTop + 'px';
      try{ popupHead.setPointerCapture(e.pointerId); }catch(err){}
    });
    popupHead.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      var newLeft = Math.max(4, Math.min(window.innerWidth - 60, startLeft + dx));
      var newTop = Math.max(4, Math.min(window.innerHeight - 40, startTop + dy));
      popupEl.style.left = newLeft + 'px';
      popupEl.style.top = newTop + 'px';
    });
    function endDrag(){
      if(!dragging) return;
      dragging = false;
      lastPopupPos = { left: popupEl.style.left, top: popupEl.style.top };
      savePopupPos(lastPopupPos);
    }
    popupHead.addEventListener('pointerup', endDrag);
    popupHead.addEventListener('pointercancel', endDrag);
  }

  /* ---------------- wire into existing showPage / toggleLang ---------------- */
  var _origShowPage = window.showPage;
  window.showPage = function(id){
    if(popupEl && popupEl.style.display !== 'none' && popupEl.dataset.prefix !== id){
      closeFloatingPopup();
    }
    _origShowPage(id);
  };

  var _origToggleLang = window.toggleLang;
  window.toggleLang = function(prefix){
    _origToggleLang(prefix);
    updateSearchPlaceholder(prefix);
    if(popupEl && popupEl.style.display !== 'none' && popupEl.dataset.prefix === prefix){
      refreshPopupContent(prefix, popupEl.dataset.slug);
    }
  };

  function initAll(){
    initFloatingPopup();
    initHomeSearch();
    Object.keys(window.__PLAN_DATA || {}).forEach(initCourseSearch);
  }

  if(document.readyState === 'complete'){ initAll(); }
  else { window.addEventListener('load', initAll); }

})();
