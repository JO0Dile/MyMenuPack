// ==========================
// MOBILE LEGEND (collapsible, session-only — a plain variable, not localStorage)
// ==========================
(function(){
  var expanded = {};

  function toggle(prefix){
    expanded[prefix] = !expanded[prefix];
    var el = document.getElementById(prefix + '-legend');
    if(el) el.classList.toggle('expanded', expanded[prefix]);
  }

  window.AAUP_LEGEND = { toggle: toggle };
})();
