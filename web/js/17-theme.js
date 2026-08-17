// ==========================
// THEME
// ==========================
// Six themes: the original Midnight (dark) and Daylight (light) plus four
// new ones — two more light, two more dark — so "theme" means more than a
// single dark/light switch. Each only ever redefines the same handful of
// CSS custom properties app.css's :root and html[data-theme="light"] block
// already defined (--page-bg, --surface-bg, --header-bg, --panel, --line,
// --text, --text-dim, --accent, --search-bg) — adding a theme here is a
// data-only change, no new selectors anywhere else in the app.
(function(){
  var KEY = 'aaup_theme';
  var DEFAULT = 'dark';

  var THEMES = [
    { id: 'dark', icon: '🌙', en: 'Midnight', ar: 'منتصف الليل', bg: '#0b1330', accent: '#5db8ff' },
    { id: 'light', icon: '☀️', en: 'Daylight', ar: 'ضوء النهار', bg: '#e7ebf1', accent: '#1b4f8c' },
    { id: 'cranberry', icon: '🍷', en: 'Cranberry & Bronze', ar: 'توت العليق والبرونز', bg: '#f3e9dd', accent: '#8c1f3d' },
    { id: 'botanical', icon: '🌿', en: 'Botanical Ivy', ar: 'اللبلاب النباتي', bg: '#eef1e6', accent: '#b3702f' },
    { id: 'indigo', icon: '🔮', en: 'Indigo Dusk', ar: 'غسق نيلي', bg: '#150f2e', accent: '#a56bff' },
    { id: 'amber', icon: '🔥', en: 'Amber Ember', ar: 'جمر العنبر', bg: '#1c1410', accent: '#ff9f43' }
  ];

  function themeById(id){
    for(var i = 0; i < THEMES.length; i++){ if(THEMES[i].id === id) return THEMES[i]; }
    return null;
  }

  function apply(id){
    var t = themeById(id) || themeById(DEFAULT);
    if(t.id === DEFAULT){ document.documentElement.removeAttribute('data-theme'); }
    else{ document.documentElement.setAttribute('data-theme', t.id); }
    document.querySelectorAll('.theme-toggle-icon').forEach(function(el){ el.textContent = t.icon; });
    // The mobile browser chrome / PWA status bar color is a separate meta
    // tag, not CSS — without this it stayed the original dark navy no
    // matter which theme was picked, an odd mismatch right at the top of
    // the screen for every light theme.
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta){ meta.setAttribute('content', t.bg); }
    // Every swatch button in the (possibly currently-open) Settings picker
    // updates its own "active" ring directly — no full re-render needed.
    document.querySelectorAll('[data-theme-swatch]').forEach(function(el){
      el.classList.toggle('theme-swatch-active', el.getAttribute('data-theme-swatch') === t.id);
    });
  }

  function current(){
    try{
      var v = localStorage.getItem(KEY);
      return themeById(v) ? v : DEFAULT;
    }catch(e){ return DEFAULT; }
  }

  function setTheme(id){
    if(!themeById(id)) return;
    try{ localStorage.setItem(KEY, id); }catch(e){}
    apply(id);
    if(window.__showToast){ var t = themeById(id); window.__showToast(t.icon + ' ' + t.en); }
  }

  // Cycles to the next theme in the list — kept for anything still calling
  // the old binary toggle() API; the Settings picker itself calls
  // setTheme(id) directly now.
  function toggle(){
    var ids = THEMES.map(function(t){ return t.id; });
    var idx = ids.indexOf(current());
    setTheme(ids[(idx + 1) % ids.length]);
  }

  // ---------------------------------------------------------------------
  // READING SIZE — how big the plan grid's course cards are.
  //
  // Six themes and no way to make the text bigger: course names sit at
  // 12.5px, and a student who has enlarged their phone's system font gets no
  // benefit from it inside the grid. This scales the cards' type and their
  // minimum height together (--card-scale in css/app.css) rather than zooming
  // the whole page, so the year and semester structure stays where it was.
  var SIZE_KEY = 'aaup_cardScale';
  var SIZES = [
    { id: 'compact', scale: 0.92, en: 'Compact', ar: 'مضغوط' },
    { id: 'normal', scale: 1, en: 'Normal', ar: 'عادي' },
    { id: 'large', scale: 1.16, en: 'Large', ar: 'كبير' },
    { id: 'xlarge', scale: 1.34, en: 'Extra large', ar: 'كبير جدًا' }
  ];
  var SIZE_DEFAULT = 'normal';

  function sizeById(id){
    for(var i = 0; i < SIZES.length; i++){ if(SIZES[i].id === id) return SIZES[i]; }
    return null;
  }
  function currentSize(){
    try{
      var v = localStorage.getItem(SIZE_KEY);
      return sizeById(v) ? v : SIZE_DEFAULT;
    }catch(e){ return SIZE_DEFAULT; }
  }
  function applySize(id){
    var s = sizeById(id) || sizeById(SIZE_DEFAULT);
    document.documentElement.style.setProperty('--card-scale', String(s.scale));
    document.querySelectorAll('[data-size-pick]').forEach(function(el){
      el.classList.toggle('size-pick-active', el.getAttribute('data-size-pick') === s.id);
    });
    // Cards grew or shrank, so the prerequisite lines drawn over them are
    // measuring the old geometry.
    if(window.AAUP_IMPORTED && window.AAUP_IMPORTED.redrawConnectors){
      Object.keys(window.__PLAN_DATA || {}).forEach(function(prefix){
        try{ window.AAUP_IMPORTED.redrawConnectors(prefix); }catch(e){}
      });
    }
  }
  function setSize(id){
    if(!sizeById(id)) return;
    try{ localStorage.setItem(SIZE_KEY, id); }catch(e){}
    applySize(id);
  }

  function init(){ apply(current()); applySize(currentSize()); }

  window.AAUP_THEME = {
    toggle: toggle, setTheme: setTheme, current: current,
    list: function(){ return THEMES.slice(); },
    setSize: setSize, currentSize: currentSize,
    sizes: function(){ return SIZES.slice(); }
  };

  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
