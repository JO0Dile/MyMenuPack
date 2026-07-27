// ==========================
// THEME (DARK / LIGHT)
// ==========================
(function(){
  var KEY = 'aaup_theme';

  function apply(theme){
    if(theme === 'light'){ document.documentElement.setAttribute('data-theme', 'light'); }
    else{ document.documentElement.removeAttribute('data-theme'); }
    document.querySelectorAll('.theme-toggle-icon').forEach(function(el){
      el.textContent = theme === 'light' ? '☀️' : '🌙';
    });
  }

  function current(){
    try{ return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch(e){ return 'dark'; }
  }

  function toggle(){
    var next = current() === 'light' ? 'dark' : 'light';
    try{ localStorage.setItem(KEY, next); }catch(e){}
    apply(next);
    if(window.__showToast){ window.__showToast(next === 'light' ? 'Light mode on' : 'Dark mode on'); }
  }

  function init(){ apply(current()); }

  window.AAUP_THEME = { toggle: toggle };

  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }
})();
