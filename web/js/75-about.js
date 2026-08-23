// ==========================
// ABOUT US
// ==========================
// The home footer carried three lines of prose — an unofficial-project
// disclaimer, a made-in-Palestine line, and a row of links — under every
// screen of the picker. It is one button now, and this is what opens.
//
// Everything factual here (the university's name and website) comes from
// data/aaup/university.json via APP_UNIVERSITIES, so it cannot drift from
// the rest of the app. The credits and contact details are the maintainer's
// own, given deliberately.
(function(){
  'use strict';

  function esc(s){ return window.__escapeHtml ? window.__escapeHtml(String(s == null ? '' : s)) : String(s); }
  function ic(key, size){ return window.AAUP_ICONS ? window.AAUP_ICONS.preview(key, size || 16) : ''; }

  // Phone numbers are given as tel: links so a tap dials rather than
  // making someone copy digits out of a paragraph.
  var MAKER = {
    name: 'AL-Hammam Natsha',
    handles: ['JO0Dile', 'Dile'],
    discord: '_dile_',
    phone: '0543443896'
  };

  var T = {
    en: {
      title: 'About AAUPath',
      what: 'AAUPath is a free, offline-first study planner for AAUP students. It is an unofficial student project — always confirm anything it tells you with your academic advisor.',
      madeIn: 'Made by students in Palestine, for students everywhere.',
      uniLabel: 'The university',
      makerLabel: 'Made by',
      reachLabel: 'Get in touch',
      discord: 'Discord',
      phone: 'Phone',
      uniPhone: 'University switchboard',
      more: 'More ways to reach us are coming.'
    },
    ar: {
      title: 'عن AAUPath',
      what: 'AAUPath مخطِّط دراسي مجاني يعمل بدون إنترنت لطلبة الجامعة العربية الأمريكية. هذا مشروع طلابي غير رسمي — تأكّد دائمًا من أي معلومة مع مرشدك الأكاديمي.',
      madeIn: 'صُنع بأيدي طلبة في فلسطين، لطلبة العالم.',
      uniLabel: 'الجامعة',
      makerLabel: 'من إعداد',
      reachLabel: 'للتواصل',
      discord: 'ديسكورد',
      phone: 'هاتف',
      uniPhone: 'مقسم الجامعة',
      more: 'وسائل تواصل أخرى قريبًا.'
    }
  };

  function uni(){
    var all = window.APP_UNIVERSITIES || {};
    return all.aaup || all[Object.keys(all)[0]] || null;
  }

  function row(iconKey, label, valueHtml){
    return '<div class="ab-row">' +
      '<span class="ab-row-ic">' + ic(iconKey, 16) + '</span>' +
      '<span class="ab-row-body"><span class="ab-row-label">' + esc(label) + '</span>' +
      '<span class="ab-row-value">' + valueHtml + '</span></span></div>';
  }

  function render(rtl){
    var t = T[rtl ? 'ar' : 'en'];
    var u = uni();
    var site = u && u.website ? String(u.website) : '';
    // Only ever an https link to the university's own site, and the visible
    // text is the bare host rather than the raw URL.
    var host = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
    var siteHtml = /^https:\/\//.test(site)
      ? '<a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">' + esc(host) + '</a>'
      : esc(host);

    return (window.__backBarHTML ? window.__backBarHTML('', 'aboutOverlay', rtl) : '') +
      '<h2 class="mh" style="margin-top:0;">' + ic('people', 20) + esc(t.title) + '</h2>' +
      '<p class="ab-lead">' + esc(t.what) + '</p>' +
      '<p class="ab-flag"><span class="ab-flag-mark" aria-hidden="true">🇵🇸</span>' + esc(t.madeIn) + '</p>' +
      '<div class="ab-rows">' +
        (u ? row('university', t.uniLabel,
          '<b>' + esc(u.name && u.name.en ? u.name.en : (u.name || '')) + '</b><br>' + siteHtml) : '') +
        row('person', t.makerLabel,
          '<b>' + esc(MAKER.name) + '</b><br>' + esc(MAKER.handles.join(' · '))) +
        row('speech', t.discord, '<code>' + esc(MAKER.discord) + '</code>') +
        row('mobile', t.phone,
          '<a href="tel:' + esc(MAKER.phone.replace(/\s+/g, '')) + '">' + esc(MAKER.phone) + '</a>') +
      '</div>' +
      '<p class="form-note ab-more">' + esc(t.more) + '</p>';
  }

  function open(){
    var overlay = document.getElementById('aboutOverlay');
    var body = document.getElementById('aboutBody');
    if(!overlay || !body) return;
    var rtl = document.documentElement.getAttribute('lang') === 'ar';
    body.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    body.innerHTML = render(rtl);
    overlay.classList.add('open');
  }

  function close(){
    var overlay = document.getElementById('aboutOverlay');
    if(overlay) overlay.classList.remove('open');
  }

  function init(){
    var overlay = document.getElementById('aboutOverlay');
    var closeBtn = document.getElementById('aboutClose');
    if(closeBtn){ closeBtn.addEventListener('click', close); }
    if(overlay){
      overlay.addEventListener('click', function(e){ if(e.target === overlay){ close(); } });
    }
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && overlay && overlay.classList.contains('open')){ close(); }
    });
  }
  if(document.readyState === 'complete'){ init(); }
  else { window.addEventListener('load', init); }

  window.AAUP_ABOUT = { open: open, close: close };
})();
