// ==========================
// LANGUAGE — one switch, for the whole app.
//
// Language used to be per plan and in memory only: js/28-imported.js kept an
// rtlState map, so switching to Arabic on one plan left the next one in
// English, the menu around it in English, and every screen back in English
// after a reload. A student who reads Arabic had to keep saying so.
//
// This is the one place the choice lives. It is the same aaup_lang key the
// landing screen's AR/EN toggle already writes (js/55-onboarding.js), so a
// student who picks Arabic before signing in is still in Arabic afterwards.
//
// Nothing here renders. Screens read isAr() — or, while a plan is on screen,
// the rtl-mode class that render() sets from it, which is the same answer.
// ==========================
(function(){
  'use strict';

  var KEY = 'aaup_lang';
  var cached = null;

  function get(){
    if(cached) return cached;
    try{ cached = localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; }
    catch(e){ cached = 'en'; }
    return cached;
  }
  function isAr(){ return get() === 'ar'; }
  function set(v){
    cached = v === 'ar' ? 'ar' : 'en';
    try{ localStorage.setItem(KEY, cached); }catch(e){}
    // Everything on screen that is not the plan re-reads on its next render;
    // the plan itself is re-rendered by whoever flipped the switch. The
    // document direction is set here so a screen with no plan behind it
    // (Settings, the home picker) still turns around.
    try{ document.documentElement.setAttribute('lang', cached); }catch(e){}
    return cached;
  }
  function toggle(){ return set(isAr() ? 'en' : 'ar'); }

  window.AAUP_LANG = { get: get, set: set, isAr: isAr, toggle: toggle };
})();
