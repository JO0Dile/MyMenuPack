// ==========================
// ADMIN MODE
// ==========================
// The dashboard for the admin Worker (admin/cloudflare-worker.js). It is a
// client for an authenticated API, not an authority: every button here ends in
// a request the Worker independently authorizes and validates. Deleting this
// file, or calling its functions from the console, grants nothing — which is
// the property that makes it safe to ship inside the public app.
//
// Reached at #admin, or from Settings. A student who never types that never
// sees it, and nothing on this page runs until they do.
//
// One shape worth knowing before reading on: a major's metadata, its course
// list, its year/semester layout and its prerequisites all live in ONE file
// (data/<uni>/majors/<slug>.json). So the Majors, Courses, Prerequisites and
// Study Plan sections below are four views of a single in-memory object,
// saved by a single PUT. That is why there is one Save button per major and
// not one per section — and why a course move and a prerequisite edit can
// never land half-applied.
(function(){
  'use strict';

  var TOKEN_KEY = 'aaup_adminToken';   // sessionStorage: dies with the tab
  var state = {
    token: null,
    username: '',
    section: 'dashboard',
    tree: null,
    uni: null,          // slug of the university being edited
    major: null,        // the full in-memory major object
    majorSlug: null,
    dirty: false,
    assets: [],
    status: null,
    // The Majors browser groups by faculty, which needs two things the tree
    // does not carry: the university's faculty list and each major's faculty.
    // Both are fetched per university rather than for the whole catalogue.
    browseUni: null,
    browseFaculties: null,
    browseMajors: null,
    browseLoading: false
  };

  function esc(s){ return window.__escapeHtml(s == null ? '' : String(s)); }

  // The Worker's URL is a guess until someone actually deploys one — Cloudflare
  // builds it from the Worker name and the account subdomain, neither of which
  // this file can know. Getting it wrong produces a bare "Failed to fetch" with
  // nothing to act on, so the sign-in screen lets it be corrected here and
  // remembers it, rather than needing a code change and a redeploy to try a
  // different name.
  var URL_KEY = 'aaup_adminUrl';
  function savedUrl(){
    try{ return localStorage.getItem(URL_KEY) || ''; }catch(e){ return ''; }
  }
  function saveUrl(u){
    try{
      if(u) localStorage.setItem(URL_KEY, u); else localStorage.removeItem(URL_KEY);
    }catch(e){}
  }
  function base(){ return (savedUrl() || window.APP_ADMIN_URL || '').replace(/\/+$/, ''); }

  // ---------- API ----------

  function api(method, path, body){
    if(!base()) return Promise.reject(new Error('No admin API configured (APP_ADMIN_URL is empty).'));
    // no-store, because a cached read here is not a stale view — it is data
    // loss. The editor renders its form from the response and Save posts the
    // whole object back, so a minutes-old copy silently reverts everything
    // saved in between. The Worker sends no-store too; this is the belt to
    // that brace, and it also covers replies cached before the Worker did.
    var opts = { method: method, headers: {}, cache: 'no-store' };
    if(state.token) opts.headers.Authorization = 'Bearer ' + state.token;
    if(body !== undefined){
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(base() + path, opts).catch(function(){
      // fetch() rejects — rather than returning a status — when the request
      // never completed: DNS did not resolve, the Worker is not deployed, its
      // workers.dev route is switched off, or CORS blocked the reply. The
      // browser deliberately does not say which. "Failed to fetch" on its own
      // sends people hunting through their password; this says what it
      // actually means and offers the one thing worth trying.
      var e = new Error('unreachable');
      e.unreachable = true;
      throw e;
    }).then(function(r){
      return r.json().catch(function(){ return { error: 'HTTP ' + r.status }; }).then(function(data){
        // A 401 from /api/login means the password was wrong and must say so.
        // Anywhere else it means the session expired or the signing secret was
        // rotated, so the token is dropped rather than letting every later
        // click fail one at a time.
        if(r.status === 401 && path !== '/api/login'){
          signOut(true);
          throw new Error('Your admin session ended. Sign in again.');
        }
        if(!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    });
  }

  // ---------- shell ----------

  function ensureOverlay(){
    if(document.getElementById('adminOverlay')) return;
    var el = document.createElement('div');
    el.id = 'adminOverlay';
    el.className = 'admin-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Admin');
    el.innerHTML =
      '<div class="admin-shell">' +
        '<header class="admin-top">' +
          '<div class="admin-brand">🛡 <strong>Admin</strong><span id="adminWho"></span></div>' +
          '<div class="admin-top-actions">' +
            '<span id="adminSaveState" class="admin-savestate"></span>' +
            '<button type="button" class="home-btn" id="adminSignOut">Sign out</button>' +
            '<button type="button" class="home-btn" id="adminClose">✕ Close</button>' +
          '</div>' +
        '</header>' +
        '<div class="admin-body">' +
          '<nav class="admin-nav" id="adminNav"></nav>' +
          '<main class="admin-main" id="adminMain"></main>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('adminClose').addEventListener('click', close);
    document.getElementById('adminSignOut').addEventListener('click', function(){ signOut(false); });
  }

  var SECTIONS = [
    ['dashboard',     '📊 Dashboard'],
    ['universities',  '🏛 Universities'],
    ['majors',        '🎓 Majors / Plans'],
    ['courses',       '📚 Courses'],
    ['prereqs',       '🔗 Prerequisites'],
    ['schedule',      '🗓 Study Plan'],
    ['assets',        '🖼 Assets'],
    ['settings',      '⚙️ Settings']
  ];

  function renderNav(){
    var nav = document.getElementById('adminNav');
    if(!nav) return;
    nav.innerHTML = SECTIONS.map(function(s){
      var needsMajor = ['courses', 'prereqs', 'schedule'].indexOf(s[0]) !== -1;
      var off = needsMajor && !state.major;
      return '<button type="button" class="admin-navbtn' + (state.section === s[0] ? ' is-active' : '') +
        (off ? ' is-off' : '') + '" data-section="' + s[0] + '">' + s[1] + '</button>';
    }).join('') +
    (state.major
      ? '<div class="admin-nav-context">Editing<br><strong>' + esc(state.majorSlug) + '</strong>' +
        '<br><span class="admin-dot-dirty" id="adminNavDirty"' +
        (state.dirty ? '' : ' style="display:none"') + '>unsaved changes</span></div>'
      : '');
    nav.querySelectorAll('[data-section]').forEach(function(b){
      b.addEventListener('click', function(){
        var want = b.getAttribute('data-section');
        if(['courses', 'prereqs', 'schedule'].indexOf(want) !== -1 && !state.major){
          toast('Pick a major first — open Majors / Plans and choose one to edit.');
          state.section = 'majors';
        } else {
          state.section = want;
        }
        render();
      });
    });
  }

  function toast(msg){
    if(window.__showToast) window.__showToast(msg);
  }

  function setMsg(html, kind){
    var el = document.getElementById('adminMsg');
    if(!el) return;
    el.innerHTML = html ? '<p class="' + (kind === 'ok' ? 'dev-success-msg' : 'dev-error-msg') + '">' + html + '</p>' : '';
  }

  // Updates the two dirty indicators in place. It must NOT re-render the nav:
  // these fire on every keystroke and every select change, and replacing the
  // nav's DOM between a mousedown and its mouseup means the browser never
  // fires the click at all — so the admin's first click after editing a field
  // was being silently swallowed.
  function setDirty(on){
    state.dirty = on;
    var s = document.getElementById('adminSaveState');
    if(s) s.textContent = on ? '● unsaved' : 'saved';
    var ctx = document.getElementById('adminNavDirty');
    if(ctx) ctx.style.display = on ? '' : 'none';
  }
  function markDirty(){ setDirty(true); }
  function markClean(){ setDirty(false); }

  // ---------- login ----------

  function renderLogin(err, unreachable){
    var main = document.getElementById('adminMain');
    var nav = document.getElementById('adminNav');
    if(nav) nav.innerHTML = '';
    main.innerHTML =
      '<div class="admin-login">' +
        '<h2>Sign in</h2>' +
        '<p class="admin-hint">Your password is checked on the server. It is never stored in this page, ' +
        'and nothing here can change published data without it.</p>' +
        '<div class="form-field"><label for="adminUser">Username</label>' +
        '<input type="text" id="adminUser" autocomplete="username" autocapitalize="none" spellcheck="false"></div>' +
        '<div class="form-field"><label for="adminPass">Password</label>' +
        '<input type="password" id="adminPass" autocomplete="current-password"></div>' +
        '<div class="form-actions"><button type="button" class="home-btn admin-primary" id="adminLoginBtn">Sign in</button></div>' +
        (err ? '<p class="dev-error-msg">' + esc(err) + '</p>' : '') +
        '<p class="admin-hint" id="adminHealth"></p>' +
        '<details class="admin-endpoint"' + (unreachable ? ' open' : '') + '>' +
          '<summary>Admin API address</summary>' +
          (unreachable
            ? '<p class="admin-hint">The browser could not reach it at all — that happens before any ' +
              'password is checked, so this is not about your credentials. Usually it means the ' +
              'Worker is not deployed, is named something else, or its <code>workers.dev</code> ' +
              'route is switched off.</p>' +
              '<p class="admin-hint">Open <code>' + esc(base()) + '/api/health</code> in a tab. ' +
              'If it shows <code>{"ok":true}</code> the address is right; if nothing loads, it is wrong.</p>'
            : '') +
          '<div class="form-field"><label for="adminUrl">Worker URL</label>' +
          '<input type="text" id="adminUrl" spellcheck="false" autocapitalize="none" ' +
          'value="' + esc(base()) + '" placeholder="https://your-worker.your-subdomain.workers.dev"></div>' +
          '<div class="form-actions">' +
          '<button type="button" class="home-btn" id="adminUrlTest">Test</button>' +
          '<button type="button" class="home-btn" id="adminUrlSave">Use this address</button>' +
          (savedUrl() ? '<button type="button" class="home-btn" id="adminUrlReset">Reset to default</button>' : '') +
          '</div><div id="adminUrlMsg" class="admin-hint"></div>' +
        '</details>' +
      '</div>';

    var go = function(){
      var u = document.getElementById('adminUser').value;
      var p = document.getElementById('adminPass').value;
      document.getElementById('adminLoginBtn').disabled = true;
      api('POST', '/api/login', { username: u, password: p }).then(function(res){
        state.token = res.token;
        state.username = res.username || u;
        try{ sessionStorage.setItem(TOKEN_KEY, res.token); }catch(e){}
        return api('GET', '/api/status').then(function(st){ state.status = st; }).catch(function(){})
          .then(loadTree);
      }).then(function(){
        state.section = 'dashboard';
        render();
      }).catch(function(e){
        renderLogin(e.unreachable
          ? 'Could not reach the admin API.'
          : e.message, !!e.unreachable);
      });
    };
    document.getElementById('adminLoginBtn').addEventListener('click', go);

    var urlMsg = function(t, ok){
      var el = document.getElementById('adminUrlMsg');
      if(el){ el.innerHTML = t; el.style.color = ok ? 'var(--unlock)' : 'var(--prereq)'; }
    };
    var typedUrl = function(){
      return (document.getElementById('adminUrl').value || '').trim().replace(/\/+$/, '');
    };
    var testBtn = document.getElementById('adminUrlTest');
    if(testBtn){
      testBtn.addEventListener('click', function(){
        var u = typedUrl();
        // https only, except a local address — a Worker under `wrangler dev`
        // is served over plain http on localhost, and refusing that would make
        // this box useless for the one case where you are actively debugging.
        var okScheme = /^https:\/\//i.test(u) ||
                       /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);
        if(!okScheme){ urlMsg('That needs to start with https://', false); return; }
        urlMsg('Checking…', true);
        fetch(u + '/api/health')
          .then(function(r){ return r.json(); })
          .then(function(h){
            if(h && h.ok && h.originAllowed === false){
              urlMsg('Reached it, but it refuses this site. Set its ALLOWED_ORIGIN to exactly ' +
                     esc(location.origin) + ' and redeploy.', false);
            } else if(h && h.ok){
              urlMsg('✅ Reached it. Press "Use this address", then sign in.', true);
            } else {
              urlMsg('Something answered, but not the admin Worker.', false);
            }
          })
          .catch(function(){
            urlMsg('❌ Nothing there. Check the Worker name, and that its workers.dev route is enabled.', false);
          });
      });
    }
    var saveBtn = document.getElementById('adminUrlSave');
    if(saveBtn){
      saveBtn.addEventListener('click', function(){
        saveUrl(typedUrl());
        renderLogin('', false);
        urlMsg('Saved on this device.', true);
      });
    }
    var resetBtn = document.getElementById('adminUrlReset');
    if(resetBtn){
      resetBtn.addEventListener('click', function(){ saveUrl(''); renderLogin('', false); });
    }
    document.getElementById('adminPass').addEventListener('keydown', function(e){ if(e.key === 'Enter') go(); });
    document.getElementById('adminUser').focus();

    // Reachability only. It deliberately does NOT report whether an admin is
    // configured or which repo is behind it: anyone can open this screen, and
    // those answers tell a stranger there is an account here and what it is
    // worth attacking. That detail now arrives after sign-in, from /api/status.
    if(base()){
      fetch(base() + '/api/health').then(function(r){ return r.json(); }).then(function(h){
        var el = document.getElementById('adminHealth');
        if(!el) return;
        // The Worker answers, so the address is right. If it also says this
        // page's origin is not on its list, every later request will be
        // blocked by the browser with no explanation — name the exact value
        // that needs setting rather than leaving a CORS failure to be guessed.
        // Checked before the origin, because when this is on nothing else can
        // possibly succeed and the origin question is moot.
        if(h && h.accessGateBlocking){
          el.innerHTML = '⚠️ The Worker has <code>REQUIRE_CF_ACCESS</code> switched on, but this ' +
            'request carries no Cloudflare Access token — so every route answers ' +
            '<em>not found</em>, including sign-in. Either finish setting up Cloudflare Access, ' +
            'or delete the <code>REQUIRE_CF_ACCESS</code> variable in the Worker\'s settings.';
        } else if(h && h.originAllowed === false){
          el.innerHTML = '⚠️ The Worker is reachable but is refusing this site. ' +
            'Set its <code>ALLOWED_ORIGIN</code> to exactly <code>' + esc(location.origin) +
            '</code> — an origin only, with no path and no trailing slash — then redeploy.';
        } else {
          el.textContent = '';
        }
      }).catch(function(){
        var el = document.getElementById('adminHealth');
        if(el) el.innerHTML = '⚠️ Could not reach the admin API — see below.';
        var d = document.querySelector('.admin-endpoint');
        if(d) d.open = true;
      });
    } else {
      var el = document.getElementById('adminHealth');
      if(el) el.innerHTML = 'No admin API is configured.';
    }
  }

  function signOut(silent){
    state.token = null; state.username = ''; state.major = null; state.tree = null; state.dirty = false;
    try{ sessionStorage.removeItem(TOKEN_KEY); }catch(e){}
    if(!silent && document.getElementById('adminOverlay')) render();
  }

  function loadTree(){
    return api('GET', '/api/tree').then(function(res){ state.tree = res.universities || []; });
  }

  // Faculties and major metadata for one university, for the Majors browser.
  // Kept separate from loadTree so opening the dashboard stays one request:
  // this is only paid when someone actually looks at a university's majors.
  function loadBrowse(uniSlug){
    state.browseUni = uniSlug;
    state.browseLoading = true;
    state.browseFaculties = null;
    state.browseMajors = null;
    return Promise.all([
      api('GET', '/api/university/' + uniSlug),
      api('GET', '/api/majors/' + uniSlug)
    ]).then(function(res){
      // A university edited in another tab can land here mid-flight; ignoring a
      // reply for a university we are no longer looking at stops it painting
      // over the current one.
      if(state.browseUni !== uniSlug) return;
      state.browseFaculties = (res[0].university || {}).colleges || [];
      state.browseMajors = res[1].majors || [];
      state.browseLoading = false;
    }).catch(function(e){
      if(state.browseUni !== uniSlug) return;
      state.browseLoading = false;
      // /api/majors is newer than some deployed Workers. Say which half failed
      // rather than showing an empty browser with no explanation.
      toast(/404|not found/i.test(e.message)
        ? 'This Worker does not have /api/majors yet — redeploy admin/cloudflare-worker.js.'
        : e.message);
    });
  }

  // ---------- sections ----------

  function sectionDashboard(){
    var unis = state.tree || [];
    var majorCount = unis.reduce(function(n, u){ return n + (u.majors || []).length; }, 0);
    var published = unis.filter(function(u){ return u.published; });
    return '<h2>Overview</h2>' +
      '<div class="admin-stats">' +
        stat(published.length, 'published universities') +
        stat(unis.length - published.length, 'unpublished') +
        stat(majorCount, 'major files') +
        stat(state.assets.length, 'uploaded assets') +
      '</div>' +
      (state.status
        ? '<div class="admin-note">' + (state.status.canWrite
            ? 'Writing to <strong>' + esc(state.status.repo) + '</strong> on <strong>' + esc(state.status.branch) + '</strong>.'
            : '⚠️ Saving will fail: the Worker has no GitHub token configured.') + '</div>'
        : '') +
      '<div class="admin-note">' +
        '<strong>How a change reaches students.</strong> Saving here writes a real commit to ' +
        '<code>data/</code>. CI rebuilds <code>web/plans.json</code> and GitHub Pages redeploys, so an edit is ' +
        'live in about a minute — not instantly. Every change is a commit, so anything can be undone with ' +
        '<code>git revert</code>.' +
      '</div>' +
      '<div class="admin-note admin-note-warn">' +
        '<strong>Students who edited their own copy of a plan are not overwritten.</strong> ' +
        'When your change reaches them, they get a popup listing exactly what changed and choose whether to ' +
        'take it. Everything else — logos, icons, university details — applies with no prompt.' +
      '</div>' +
      '<h3>Universities</h3>' + universityTable();
  }

  function stat(n, label){
    return '<div class="admin-stat"><div class="admin-stat-n">' + n + '</div><div>' + label + '</div></div>';
  }

  function universityTable(){
    var unis = state.tree || [];
    if(!unis.length) return '<p class="ex-note">Nothing loaded.</p>';
    return '<table class="admin-table"><thead><tr><th>University</th><th>Short</th><th>Majors</th><th>Status</th><th></th></tr></thead><tbody>' +
      unis.map(function(u){
        return '<tr><td><strong>' + esc(u.name) + '</strong><br><span class="admin-sub">' + esc(u.slug) + '</span></td>' +
          '<td>' + esc(u.shortName || '') + '</td>' +
          '<td>' + (u.majors || []).length + '</td>' +
          '<td>' + (u.published
            ? '<span class="admin-pill admin-pill-on">Published</span>'
            : '<span class="admin-pill">Hidden</span>') + '</td>' +
          '<td><button type="button" class="home-btn admin-mini" data-edit-uni="' + esc(u.slug) + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function sectionUniversities(){
    return '<h2>Universities</h2>' +
      '<p class="admin-hint">Editing a university changes its name, description and logo for everyone. ' +
      'These are not student-editable, so they apply with no confirmation prompt.</p>' +
      universityTable() +
      '<div id="adminUniEditor"></div>';
  }

  function universityEditor(u, full){
    var pub = u.published !== false;
    return '<div class="admin-editor"><h3>' + esc(full.name || u.slug) + '</h3>' +
      '<div class="form-field-row">' +
        field('auName', 'Name (English)', full.name) +
        field('auNameAr', 'Name (Arabic)', full.nameAr) +
      '</div>' +
      '<div class="form-field-row">' +
        field('auShort', 'Short name', full.shortName) +
        field('auIcon', 'Emoji fallback', full.icon) +
        field('auWebsite', 'Website', full.website) +
      '</div>' +
      '<div class="form-field"><label for="auDesc">Description</label>' +
      '<textarea id="auDesc" rows="3">' + esc(full.description || '') + '</textarea></div>' +
      iconPicker('auIconKey', full.iconKey) +
      '<div class="form-field"><label for="auLogo">Official logo</label>' +
      '<input type="text" id="auLogo" value="' + esc(full.logoUrl || '') + '" placeholder="assets/uploads/aaup-logo.png or https://…">' +
      '<p class="admin-hint">Upload the file in <strong>Assets</strong>, then paste its path here. ' +
      'An uploaded file is served from the app itself, so the logo still shows offline.</p>' +
      '</div>' +
      markPreview('au') +
      '<label class="admin-check"><input type="checkbox" id="auPublished"' + (pub ? ' checked' : '') + '> Published (visible to students)</label>' +
      '<h4>Faculties</h4><div id="auColleges">' + collegeRows(full.colleges || []) + '</div>' +
      '<div class="form-actions">' +
        '<button type="button" class="home-btn admin-mini" id="auAddCollege">+ Add faculty</button>' +
        '<button type="button" class="home-btn admin-primary" id="auSave" data-slug="' + esc(u.slug) + '">Save university</button>' +
      '</div><div id="adminMsg"></div></div>';
  }

  // Three fields, one mark. Which one a student actually sees was invisible
  // here: you could clear the icon, set a logo, and still be looking at the
  // old emoji with nothing explaining why. This shows the real answer, live,
  // and says which field produced it.
  function markPreview(prefix){
    return '<div class="admin-markpreview" data-markpreview="' + prefix + '">' +
      '<div class="admin-markpreview-box" id="' + prefix + 'MarkBox"></div>' +
      '<div><div class="admin-markpreview-title">What students will see</div>' +
      '<div class="admin-hint" id="' + prefix + 'MarkWhy" style="margin:0;"></div></div></div>';
  }

  // The order here is the renderer's order (js/04-icons.js), not a guess: an
  // uploaded image wins, then a built-in icon, then the emoji. Keeping the two
  // in step matters — a preview that disagrees with the app is worse than none.
  function refreshMarkPreview(prefix, fields){
    var box = document.getElementById(prefix + 'MarkBox');
    var why = document.getElementById(prefix + 'MarkWhy');
    if(!box || !why) return;
    var img = (document.getElementById(fields.image) || {}).value || '';
    var key = (document.getElementById(fields.key) || {}).value || '';
    var emoji = (document.getElementById(fields.emoji) || {}).value || '';
    var entity = { imageUrl: img, iconKey: key, icon: emoji };
    box.innerHTML = window.AAUP_ICONS.markup(entity, { size: 52 });

    if(img && window.AAUP_ICONS.safeImageUrl(img)){
      why.innerHTML = 'Using the <strong>uploaded image</strong>. It wins over both the icon and the emoji — clear this field to fall back to them.';
    } else if(img){
      why.innerHTML = '⚠️ That image path is not usable (it must start with <code>assets/</code> or <code>https://</code>), so the icon or emoji is being used instead.';
    } else if(key && window.AAUP_ICONS.has(key)){
      why.innerHTML = 'Using the <strong>built-in icon</strong>. Upload an image above to override it; pick <em>none</em> to fall back to the emoji.';
    } else if(emoji){
      why.innerHTML = 'Using the <strong>emoji</strong>, because no image and no icon are set. This is the last fallback and always works.';
    } else {
      why.innerHTML = 'Nothing is set, so a default mark is shown. Any one of the three fields replaces it.';
    }
  }

  // Four unlabelled boxes in a row gave no clue which was which, and the id was
  // the least obvious of them while being the one that must not change: majors
  // reference it, so renaming it orphans them. It is labelled as such and set
  // apart from the display names.
  function collegeRows(list){
    if(!list.length) return '<p class="ex-note">No faculties yet.</p>';
    return list.map(function(c, i){
      return '<div class="admin-faculty" data-college-row="' + i + '">' +
        '<div class="admin-faculty-head">' +
          '<span class="admin-faculty-n">' + (i + 1) + '</span>' +
          '<strong class="admin-faculty-name">' + esc(c.name || c.slug || 'New faculty') + '</strong>' +
          '<button type="button" class="home-btn admin-mini admin-danger" data-del-college="' + i + '">🗑 Remove</button>' +
        '</div>' +
        '<div class="admin-faculty-grid">' +
          '<label>Name (English)<input type="text" class="ac-name" value="' + esc(c.name) + '" placeholder="Faculty of Information Technology"></label>' +
          '<label>Name (Arabic)<input type="text" class="ac-namear" dir="rtl" value="' + esc(c.nameAr || '') + '" placeholder="كلية تكنولوجيا المعلومات"></label>' +
          '<label>Emoji<input type="text" class="ac-icon" value="' + esc(c.icon || '') + '" placeholder="🏫" maxlength="4"></label>' +
          '<label class="admin-faculty-id">ID <span>— referenced by majors; changing it unlinks them</span>' +
          '<input type="text" class="ac-slug" value="' + esc(c.slug) + '" placeholder="aaup-it" spellcheck="false"></label>' +
        '</div></div>';
    }).join('');
  }

  function field(id, label, val){
    return '<div class="form-field"><label for="' + id + '">' + label + '</label>' +
      '<input type="text" id="' + id + '" value="' + esc(val || '') + '"></div>';
  }

  // The icon picker draws the actual built-in set rather than listing key
  // names, because "datascience" and "network" are indistinguishable as words
  // and obvious as pictures.
  function iconPicker(id, current){
    var keys = window.AAUP_ICONS.keys();
    return '<div class="form-field"><label>Icon</label>' +
      '<input type="hidden" id="' + id + '" value="' + esc(current || '') + '">' +
      '<div class="admin-iconpick" data-for="' + id + '">' +
        '<button type="button" class="admin-icontile' + (!current ? ' is-active' : '') + '" data-key="">none</button>' +
        keys.map(function(k){
          return '<button type="button" class="admin-icontile' + (k === current ? ' is-active' : '') +
            '" data-key="' + k + '" title="' + k + '">' + window.AAUP_ICONS.preview(k, 22) + '</button>';
        }).join('') +
      '</div></div>';
  }

  var MARK_FIELDS = {
    au: { image: 'auLogo',  key: 'auIconKey', emoji: 'auIcon' },
    am: { image: 'amImage', key: 'amIconKey', emoji: 'amIcon' }
  };

  function bindMarkPreview(){
    Object.keys(MARK_FIELDS).forEach(function(prefix){
      var fields = MARK_FIELDS[prefix];
      if(!document.getElementById(prefix + 'MarkBox')) return;
      refreshMarkPreview(prefix, fields);
      [fields.image, fields.key, fields.emoji].forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        // 'input' as well as 'change': the preview should follow typing, since
        // the whole point is answering "what did that just do?" immediately.
        el.addEventListener('input', function(){ refreshMarkPreview(prefix, fields); });
        el.addEventListener('change', function(){ refreshMarkPreview(prefix, fields); });
      });
    });
  }

  function bindIconPickers(){
    document.querySelectorAll('.admin-iconpick').forEach(function(pick){
      pick.addEventListener('click', function(e){
        var b = e.target.closest('.admin-icontile');
        if(!b) return;
        var input = document.getElementById(pick.getAttribute('data-for'));
        if(input) input.value = b.getAttribute('data-key');
        pick.querySelectorAll('.admin-icontile').forEach(function(x){ x.classList.remove('is-active'); });
        b.classList.add('is-active');
        markDirty();
        bindMarkPreview();
      });
    });
    bindMarkPreview();
  }

  // A major belongs to a faculty, and until now the browser could not show
  // that. It listed bare slugs in one flat table per university, with a single
  // "+ New major" that belonged to the university rather than to any faculty —
  // so a new major was created with no faculty at all, and the only way to give
  // it one was to type the exact slug into a free-text box from memory. Getting
  // it wrong, or leaving it blank, silently produced a major that no student
  // could ever reach, with nothing anywhere saying so.
  //
  // So the browser is the real hierarchy now: university, then its faculties,
  // then the majors inside each, with the add button on the faculty it will
  // actually add to.
  function sectionMajors(){
    var unis = state.tree || [];
    if(!unis.length) return '<h2>Majors / Plans</h2><p class="admin-hint">No universities yet.</p>';

    var uniSlug = state.browseUni || (unis[0] && unis[0].slug);
    var picker = unis.length > 1
      ? '<div class="form-field"><label for="amUni">University</label><select id="amUni">' +
          unis.map(function(u){
            return '<option value="' + esc(u.slug) + '"' + (u.slug === uniSlug ? ' selected' : '') + '>' +
              esc(u.name) + (u.published ? '' : ' (hidden)') + '</option>';
          }).join('') + '</select></div>'
      : '';

    var head = '<h2>Majors / Plans</h2>' +
      '<p class="admin-hint">Majors are grouped by the faculty they belong to. ' +
      'Add one from inside a faculty and it starts out in that faculty.</p>' + picker;

    // Metadata arrives from /api/majors/:uni, which is a separate request from
    // the tree. Say so rather than rendering an empty page that looks broken.
    if(state.browseLoading) return head + '<p class="admin-hint">Loading majors…</p><div id="adminMajorEditor"></div>';
    if(!state.browseMajors) return head + '<p class="admin-hint">Could not load this university\'s majors.</p><div id="adminMajorEditor"></div>';

    var faculties = (state.browseFaculties || []).slice();
    var majors = state.browseMajors || [];
    var known = {};
    faculties.forEach(function(f){ known[f.slug] = true; });

    var groups = faculties.map(function(f){
      return { slug: f.slug, name: f.name, icon: f.icon, iconKey: f.iconKey, imageUrl: f.imageUrl,
               majors: majors.filter(function(m){ return m.college === f.slug; }) };
    });

    // Majors whose faculty is blank or points at a faculty that no longer
    // exists. They were invisible before — listed with everything else and
    // indistinguishable — which is how one gets created and then forgotten.
    var orphans = majors.filter(function(m){ return !m.college || !known[m.college]; });

    var body = groups.map(function(g){ return facultyGroup(uniSlug, g, false); }).join('') +
      (orphans.length
        ? facultyGroup(uniSlug, { slug: '', name: 'Not in any faculty', icon: '⚠️', majors: orphans }, true)
        : '') +
      (groups.length ? '' :
        '<p class="admin-hint">This university has no faculties yet. Add one in ' +
        '<strong>Universities → Edit → Faculties</strong>, then come back here to add majors to it.</p>');

    return head +
      '<div class="form-field"><label for="amFilter">Search</label>' +
      '<input type="text" id="amFilter" placeholder="Filter by name or slug…"></div>' +
      body + '<div id="adminMajorEditor"></div>';
  }

  function facultyGroup(uniSlug, g, isOrphan){
    var mark = isOrphan ? '⚠️' : window.AAUP_ICONS.markup(g, { size: 20, fallback: '🏫' });
    return '<section class="admin-facgroup' + (isOrphan ? ' is-orphan' : '') + '">' +
      '<div class="admin-facgroup-head">' +
        '<span class="admin-facgroup-mark">' + mark + '</span>' +
        '<div><h3>' + esc(g.name) + '</h3>' +
          (isOrphan
            ? '<span class="admin-sub">These are not reachable by students until they are given a faculty.</span>'
            : '<span class="admin-sub">' + esc(g.slug) + ' · ' + g.majors.length +
              ' major' + (g.majors.length === 1 ? '' : 's') + '</span>') +
        '</div>' +
        (isOrphan ? '' :
          '<button type="button" class="home-btn admin-mini admin-addhere" data-new-major="' + esc(uniSlug) +
          '" data-faculty="' + esc(g.slug) + '">+ Add major here</button>') +
      '</div>' +
      (g.majors.length
        ? '<table class="admin-table admin-major-table"><tbody>' + g.majors.map(function(m){
            return '<tr data-major-row="' + esc(m.slug) + '">' +
              '<td><strong>' + esc(m.name || m.slug) + '</strong>' +
                (m.nameAr ? '<br><span class="admin-sub" dir="rtl">' + esc(m.nameAr) + '</span>' : '') +
                '<br><span class="admin-sub">' + esc(m.slug) + ' · ' + (m.courseCount || 0) + ' courses</span>' +
                (m.unreadable ? '<br><span class="admin-sub admin-warn">⚠️ this file could not be read</span>' : '') +
              '</td>' +
              '<td style="text-align:right;">' +
              '<button type="button" class="home-btn admin-mini" data-edit-major="' + esc(m.slug) + '" data-uni="' + esc(uniSlug) + '">Edit</button> ' +
              '<button type="button" class="home-btn admin-mini admin-danger" data-del-major="' + esc(m.slug) + '" data-uni="' + esc(uniSlug) + '">Delete</button>' +
              '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p class="admin-hint admin-facgroup-empty">No majors in this faculty yet.</p>') +
      '</section>';
  }

  function majorEditor(m){
    return '<div class="admin-editor"><h3>' + esc(m.name || m.slug) + '</h3>' +
      '<p class="admin-hint">This major\'s courses, prerequisites and semester layout are edited in the ' +
      '<strong>Courses</strong>, <strong>Prerequisites</strong> and <strong>Study Plan</strong> sections — ' +
      'they are all one file, saved together.</p>' +
      '<div class="form-field-row">' + field('amName', 'Name (English)', m.name) + field('amNameAr', 'Name (Arabic)', m.nameAr) + '</div>' +
      '<div class="form-field-row">' + field('amSub', 'Subtitle', m.subtitle) + field('amSubAr', 'Subtitle (Arabic)', m.subtitleAr) + '</div>' +
      facultyField(m) +
      '<div class="form-field-row">' + field('amIcon', 'Emoji fallback', m.icon) +
      field('amHours', 'Degree credit hours', m.degreeHours == null ? '' : m.degreeHours) + '</div>' +
      iconPicker('amIconKey', m.iconKey) +
      '<div class="form-field"><label for="amImage">Icon image (optional)</label>' +
      '<input type="text" id="amImage" value="' + esc(m.imageUrl || '') + '" placeholder="assets/uploads/…"></div>' +
      markPreview('am') +
      '<div class="form-field"><label for="amBio">Description</label><textarea id="amBio" rows="3">' + esc(m.bio || '') + '</textarea></div>' +
      '<div class="form-field"><label for="amBioAr">Description (Arabic)</label><textarea id="amBioAr" rows="3">' + esc(m.bioAr || '') + '</textarea></div>' +
      saveBar() + '</div>';
  }

  // This was a free-text box labelled "Faculty slug". It required knowing that
  // the Faculty of Information Technology is "aaup-it", and a typo produced a
  // major filed under a faculty that does not exist — which looks exactly like
  // a major that saved fine, right up until nobody can find it.
  //
  // A list cannot be mistyped. The one case a list cannot express is a value
  // already stored that matches no faculty, so that is kept as an option and
  // called out, rather than being silently corrected to something else.
  function facultyField(m){
    var list = state.browseFaculties || [];
    var known = list.some(function(f){ return f.slug === m.college; });
    var stray = m.college && !known;
    return '<div class="form-field"><label for="amCollege">Faculty</label>' +
      '<select id="amCollege">' + facultyOptions(m.college, true) +
        (stray ? '<option value="' + esc(m.college) + '" selected>' + esc(m.college) + ' — not a faculty here</option>' : '') +
      '</select>' +
      (stray
        ? '<p class="admin-hint admin-warn">⚠️ This major is filed under <code>' + esc(m.college) +
          '</code>, which is not one of this university\'s faculties, so students cannot reach it. ' +
          'Pick a real faculty, or add that one in Universities → Edit → Faculties.</p>'
        : (!m.college
            ? '<p class="admin-hint admin-warn">⚠️ No faculty set — students cannot reach this major.</p>'
            : '')) +
      '</div>';
  }

  function saveBar(){
    return '<div class="form-actions admin-savebar">' +
      '<button type="button" class="home-btn admin-primary" id="amSave">💾 Save major</button>' +
      '<span class="admin-hint">Writes a commit and redeploys. Live in about a minute.</span>' +
      '</div><div id="adminMsg"></div>';
  }

  // Courses, Prerequisites and Study Plan are three views of one major, reached
  // from a nav that does not say which major, on top of a university and a
  // faculty chosen two screens earlier. With fifty courses on screen that is
  // very easy to lose — and every one of these screens can write to the file.
  function crumbs(){
    var m = state.major || {};
    var uni = (state.tree || []).filter(function(u){ return u.slug === state.uni; })[0];
    var fac = (state.browseFaculties || []).filter(function(f){ return f.slug === m.college; })[0];
    return '<nav class="admin-crumbs">' +
      '<span>' + esc(uni ? uni.name : (state.uni || '—')) + '</span>' +
      '<span class="admin-crumb-sep">›</span>' +
      '<span' + (fac ? '' : ' class="admin-warn"') + '>' +
        esc(fac ? fac.name : (m.college ? m.college + ' (unknown faculty)' : 'no faculty')) + '</span>' +
      '<span class="admin-crumb-sep">›</span>' +
      '<strong>' + esc(m.name || m.slug || '—') + '</strong>' +
      '</nav>';
  }

  var SEM_LABEL = { s1: 'Semester 1', s2: 'Semester 2', s3: 'Summer', summer: 'Summer' };

  function semKey(c){
    if(c.semester === 'summer') return 's3';
    return c.semester || '';
  }

  // One table of every course in the degree, in file order, was unreadable —
  // and it was also the only place the year/semester columns could be checked,
  // so a course sitting in the wrong term was invisible unless you happened to
  // scan the right row. Grouping by the structure the plan actually has makes
  // a misplaced course obvious, and gives the credit-hour total per term for
  // free. Unscheduled courses get their own group instead of being scattered.
  function sectionCourses(){
    var m = state.major;
    var years = m.years || [];
    var all = m.courses || [];

    var buckets = [];
    years.forEach(function(y){
      ['s1', 's2'].concat(y.hasSummer ? ['s3'] : []).forEach(function(sem){
        buckets.push({
          title: y.id.toUpperCase() + ' · ' + SEM_LABEL[sem],
          rows: all.map(function(c, i){ return { c: c, i: i }; })
                   .filter(function(r){ return r.c.yearId === y.id && semKey(r.c) === sem; })
        });
      });
    });
    var placed = {};
    buckets.forEach(function(b){ b.rows.forEach(function(r){ placed[r.i] = true; }); });
    var loose = all.map(function(c, i){ return { c: c, i: i }; }).filter(function(r){ return !placed[r.i]; });
    if(loose.length){
      buckets.push({ title: 'Not placed in a year or semester', rows: loose, warn: true });
    }

    return '<h2>Courses</h2>' + crumbs() +
      '<p class="admin-hint">Grouped by where each course sits in the plan. ' +
      'Changing a course\'s Year or Sem here moves it, and it lands in the matching group after Save.</p>' +
      '<div class="form-field"><label for="acFilter">Search</label><input type="text" id="acFilter" placeholder="Filter by name or code…"></div>' +
      '<div id="acBody">' + buckets.map(function(b){
        var ch = b.rows.reduce(function(n, r){ return n + (Number(r.c.creditHours) || 0); }, 0);
        return '<section class="admin-termgroup' + (b.warn ? ' is-orphan' : '') + '">' +
          '<h4>' + (b.warn ? '⚠️ ' : '') + esc(b.title) +
            ' <span class="admin-sub">' + b.rows.length + ' course' + (b.rows.length === 1 ? '' : 's') +
            ' · ' + ch + ' CH</span></h4>' +
          (b.rows.length
            ? '<table class="admin-table admin-course-table"><thead><tr>' +
              '<th>Code</th><th>Name</th><th>Arabic</th><th>CH</th><th>Category</th><th>Year</th><th>Sem</th><th></th>' +
              '</tr></thead><tbody>' +
              b.rows.map(function(r){ return courseRow(r.c, r.i, years); }).join('') +
              '</tbody></table>'
            : '<p class="admin-hint admin-facgroup-empty">Empty.</p>') +
          '</section>';
      }).join('') + '</div>' +
      '<div class="form-actions"><button type="button" class="home-btn admin-mini" id="acAdd">+ Add course</button></div>' +
      saveBar();
  }

  var CATS = [['skills', 'Skills'], ['core', 'Core'], ['math', 'Math'], ['dept', 'Department'],
              ['eng', 'English'], ['uni', 'University'], ['free', 'Free elective']];

  function courseRow(c, i, years){
    return '<tr data-course="' + i + '">' +
      '<td><input type="text" class="cc-num" value="' + esc(c.courseNumber || '') + '"></td>' +
      '<td><input type="text" class="cc-name" value="' + esc(c.name || '') + '"></td>' +
      '<td><input type="text" class="cc-namear" value="' + esc(c.nameAr || '') + '" dir="rtl"></td>' +
      '<td><input type="number" class="cc-ch" min="0" max="20" step="1" value="' + esc(c.creditHours) + '"></td>' +
      '<td><select class="cc-cat">' + CATS.map(function(k){
        return '<option value="' + k[0] + '"' + (c.category === k[0] ? ' selected' : '') + '>' + k[1] + '</option>';
      }).join('') + '</select></td>' +
      '<td><select class="cc-year">' + years.map(function(y){
        return '<option value="' + esc(y.id) + '"' + (c.yearId === y.id ? ' selected' : '') + '>' + esc(y.id) + '</option>';
      }).join('') + '</select></td>' +
      '<td><select class="cc-sem">' +
        ['s1', 's2', 's3'].map(function(s){
          return '<option value="' + s + '"' + (c.semester === s || (s === 's3' && c.semester === 'summer') ? ' selected' : '') + '>' +
            (s === 's3' ? 'Summer' : s.toUpperCase()) + '</option>';
        }).join('') + '</select></td>' +
      '<td><button type="button" class="home-btn admin-mini admin-danger" data-del-course="' + i + '">✕</button></td></tr>';
  }

  function sectionPrereqs(){
    var m = state.major;
    var courses = m.courses || [];
    // Fifty courses in one flat dropdown, in file order, meant scrolling for a
    // name you already knew the position of in the plan. Grouped by term, the
    // list matches how the courses are actually thought about.
    var byTerm = {};
    courses.forEach(function(c){
      var k = (c.yearId || '—') + '|' + (semKey(c) || '—');
      (byTerm[k] = byTerm[k] || []).push(c);
    });
    var opts = Object.keys(byTerm).sort().map(function(k){
      var parts = k.split('|');
      var label = parts[0].toUpperCase() + ' · ' + (SEM_LABEL[parts[1]] || 'Unscheduled');
      return '<optgroup label="' + esc(label) + '">' + byTerm[k].map(function(c){
        return '<option value="' + esc(c.id) + '">' +
          esc((c.courseNumber ? c.courseNumber + ' · ' : '') + c.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');

    return '<h2>Prerequisites</h2>' + crumbs() +
      '<p class="admin-hint">Each row is “must pass <strong>before</strong> → can then take <strong>after</strong>”. ' +
      'The server rejects a loop, so a plan can never be saved in a state where a course is impossible to reach.</p>' +
      '<table class="admin-table"><thead><tr><th>Before</th><th>After</th><th></th></tr></thead><tbody id="apBody">' +
      (m.prerequisites || []).map(function(p, i){
        return '<tr data-pr="' + i + '"><td>' + nameOf(p[0]) + '</td><td>' + nameOf(p[1]) + '</td>' +
          '<td><button type="button" class="home-btn admin-mini admin-danger" data-del-pr="' + i + '">✕</button></td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="admin-row"><select id="apBefore">' + opts + '</select>' +
      '<span>→</span><select id="apAfter">' + opts + '</select>' +
      '<button type="button" class="home-btn admin-mini" id="apAdd">+ Add</button></div>' +
      saveBar();
  }

  function nameOf(id){
    var c = (state.major.courses || []).filter(function(x){ return x.id === id; })[0];
    return esc(c ? ((c.courseNumber ? c.courseNumber + ' · ' : '') + c.name) : id);
  }

  function sectionSchedule(){
    var m = state.major;
    var years = m.years || [];
    return '<h2>Study Plan</h2>' + crumbs() +
      '<p class="admin-hint">Move a course to a different year or semester, or change the year layout. ' +
      'Same file as Courses — one Save covers both.</p>' +
      '<h4>Years</h4><div id="asYears">' + years.map(function(y, i){
        return '<div class="admin-row"><input type="text" class="ay-id" value="' + esc(y.id) + '" style="max-width:80px;">' +
          '<label class="admin-check"><input type="checkbox" class="ay-summer"' + (y.hasSummer ? ' checked' : '') + '> has summer</label>' +
          '<button type="button" class="home-btn admin-mini admin-danger" data-del-year="' + i + '">✕</button></div>';
      }).join('') + '</div>' +
      '<div class="form-actions"><button type="button" class="home-btn admin-mini" id="asAddYear">+ Add year</button></div>' +
      years.map(function(y){
        return ['s1', 's2'].concat(y.hasSummer ? ['s3'] : []).map(function(sem){
          var list = (m.courses || []).filter(function(c){
            return c.yearId === y.id && (c.semester === sem || (sem === 's3' && c.semester === 'summer'));
          });
          return '<h4>' + esc(y.id) + ' · ' + (sem === 's3' ? 'Summer' : sem.toUpperCase()) +
            ' <span class="admin-sub">' + list.reduce(function(n, c){ return n + (Number(c.creditHours) || 0); }, 0) + ' CH</span></h4>' +
            '<ul class="admin-semlist">' + (list.map(function(c){
              var idx = m.courses.indexOf(c);
              return '<li><span>' + esc(c.name) + '</span>' + moveSelect(idx, y.id, sem, years) + '</li>';
            }).join('') || '<li class="ex-note">Empty</li>') + '</ul>';
        }).join('');
      }).join('') +
      saveBar();
  }

  function moveSelect(idx, curYear, curSem, years){
    var opts = '';
    years.forEach(function(y){
      ['s1', 's2'].concat(y.hasSummer ? ['s3'] : []).forEach(function(sem){
        var sel = (y.id === curYear && sem === curSem) ? ' selected' : '';
        opts += '<option value="' + esc(y.id) + '|' + sem + '"' + sel + '>' +
          esc(y.id) + ' · ' + (sem === 's3' ? 'Summer' : sem.toUpperCase()) + '</option>';
      });
    });
    return '<select class="admin-move" data-move="' + idx + '">' + opts + '</select>';
  }

  function sectionAssets(){
    return '<h2>Assets</h2>' +
      '<p class="admin-hint">Uploads are committed into <code>web/assets/uploads/</code>, so they deploy with the ' +
      'app and keep working offline. PNG, JPEG, WebP or SVG, up to 512 KB.</p>' +
      '<div class="form-field"><label for="aaFile">Upload an image</label><input type="file" id="aaFile" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div>' +
      '<div id="aaPreview"></div>' +
      '<div class="form-actions"><button type="button" class="home-btn admin-primary" id="aaUpload" disabled>Upload</button></div>' +
      '<div id="adminMsg"></div>' +
      '<h3>Uploaded</h3>' +
      (state.assets.length
        ? '<div class="admin-assets">' + state.assets.map(function(a){
            return '<div class="admin-asset"><img src="' + esc(base() ? a.url : a.url) + '" alt="" loading="lazy">' +
              '<code>' + esc(a.url) + '</code>' +
              '<div><button type="button" class="home-btn admin-mini" data-copy-asset="' + esc(a.url) + '">Copy path</button> ' +
              '<button type="button" class="home-btn admin-mini admin-danger" data-del-asset="' + esc(a.filename) + '">Delete</button></div></div>';
          }).join('') + '</div>'
        : '<p class="ex-note">Nothing uploaded yet.</p>');
  }

  function sectionSettings(){
    return '<h2>Settings</h2>' +
      '<div class="admin-note"><strong>Signed in as</strong> ' + esc(state.username) + '.<br>' +
      'The session lasts 8 hours and lives only in this tab — closing it signs you out.</div>' +
      '<div class="admin-note"><strong>Changing your password.</strong> Run ' +
      '<code>python3 tools/hash-admin-password.py</code> and paste the result into the Worker\'s ' +
      '<code>ADMIN_PASSWORD_HASH</code> secret. The password itself is never stored anywhere.</div>' +
      '<div class="admin-note"><strong>Revoking access.</strong> Replace <code>SESSION_SECRET</code> in the ' +
      'Worker. Every signed-in session stops working immediately.</div>' +
      '<div class="admin-note"><strong>Refresh from GitHub.</strong> Re-reads the list of ' +
      'universities and majors from the repo. It changes nothing and deletes nothing — ' +
      'use it if you edited files in GitHub directly and want this dashboard to catch up. ' +
      'Any major you have open with unsaved changes is left alone.</div>' +
      '<div class="form-actions"><button type="button" class="home-btn" id="adminReload">🔄 Refresh list from GitHub</button></div>';
  }

  // ---------- render + binding ----------

  function render(){
    ensureOverlay();
    var main = document.getElementById('adminMain');
    var who = document.getElementById('adminWho');
    if(!state.token){ if(who) who.textContent = ''; renderLogin(''); return; }
    if(who) who.textContent = ' · ' + state.username;

    renderNav();
    var s = state.section;

    // Opening Majors for the first time needs the faculty grouping data. Fetch
    // it once and re-render when it lands, rather than making every caller of
    // render() remember to do it.
    if(s === 'majors' && !state.browseLoading && !state.browseMajors){
      var want = state.browseUni || ((state.tree || [])[0] || {}).slug;
      if(want) loadBrowse(want).then(render);
    }

    if(s === 'dashboard') main.innerHTML = sectionDashboard();
    else if(s === 'universities') main.innerHTML = sectionUniversities();
    else if(s === 'majors') main.innerHTML = sectionMajors();
    else if(s === 'courses') main.innerHTML = sectionCourses();
    else if(s === 'prereqs') main.innerHTML = sectionPrereqs();
    else if(s === 'schedule') main.innerHTML = sectionSchedule();
    else if(s === 'assets') main.innerHTML = sectionAssets();
    else main.innerHTML = sectionSettings();
    bindMain();
  }

  function on(sel, ev, fn){
    var el = typeof sel === 'string' ? document.getElementById(sel) : sel;
    if(el) el.addEventListener(ev, fn);
  }

  function bindMain(){
    var main = document.getElementById('adminMain');
    bindIconPickers();

    main.querySelectorAll('[data-edit-uni]').forEach(function(b){
      b.addEventListener('click', function(){
        var slug = b.getAttribute('data-edit-uni');
        var row = (state.tree || []).filter(function(u){ return u.slug === slug; })[0] || { slug: slug };
        api('GET', '/api/university/' + slug).then(function(res){
          var host = document.getElementById('adminUniEditor') || main;
          // The version this form is a picture of. Save sends it back so the
          // Worker can tell an edit from an accidental rollback.
          state.uniSha = res.sha || '';
          host.innerHTML = universityEditor(row, res.university);
          bindIconPickers();
          bindUniEditor(slug);
          host.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }).catch(function(e){ toast(e.message); });
      });
    });

    main.querySelectorAll('[data-edit-major]').forEach(function(b){
      b.addEventListener('click', function(){
        openMajor(b.getAttribute('data-uni'), b.getAttribute('data-edit-major'));
      });
    });
    main.querySelectorAll('[data-del-major]').forEach(function(b){
      b.addEventListener('click', function(){
        var slug = b.getAttribute('data-del-major');
        if(!confirm('Delete the major "' + slug + '"?\n\nIt stops being offered to students. The file is removed by a commit, so it can be restored with git revert.')) return;
        api('DELETE', '/api/major/' + b.getAttribute('data-uni') + '/' + slug)
          .then(function(){ toast('Removed ' + slug + '.'); return loadTree(); })
          .then(function(){ return state.browseUni ? loadBrowse(state.browseUni) : null; })
          .then(render).catch(function(e){ toast(e.message); });
      });
    });
    main.querySelectorAll('[data-new-major]').forEach(function(b){
      b.addEventListener('click', function(){
        openNewMajorForm(b.getAttribute('data-new-major'), b.getAttribute('data-faculty') || '');
      });
    });

    on('amUni', 'change', function(e){ loadBrowse(e.target.value).then(render); });
    on('amFilter', 'input', function(e){ filterRows(e.target.value, '[data-major-row]'); });
    on('acFilter', 'input', function(e){ filterRows(e.target.value, '[data-course]'); });

    if(state.section === 'courses') bindCourses();
    if(state.section === 'prereqs') bindPrereqs();
    if(state.section === 'schedule') bindSchedule();
    if(state.section === 'assets') bindAssets();
    if(document.getElementById('amSave')) bindMajorSave();
    on('adminReload', 'click', function(){ loadTree().then(render).catch(function(e){ toast(e.message); }); });
  }

  // Turns "AI and Robotics" into "ai-and-robotics". The slug is the filename
  // and every reference to the major, so it is still editable — but nobody
  // should have to invent one to create a major, which is what a bare prompt()
  // for the slug demanded.
  function slugify(s){
    return String(s || '').toLowerCase().trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  function facultyOptions(selected, includeNone){
    var list = state.browseFaculties || [];
    return (includeNone ? '<option value="">— no faculty —</option>' : '') +
      list.map(function(f){
        return '<option value="' + esc(f.slug) + '"' + (f.slug === selected ? ' selected' : '') + '>' +
          esc(f.name) + ' (' + esc(f.slug) + ')</option>';
      }).join('');
  }

  // The old flow asked for a slug in a window.prompt and created the major with
  // no faculty at all, no name, and no way to set either without knowing to go
  // looking. Everything a major needs to exist somewhere a student can find it
  // is asked for here, once, with the faculty already filled in from whichever
  // group the button was pressed in.
  function openNewMajorForm(uni, faculty){
    var host = document.getElementById('adminMajorEditor');
    if(!host) return;
    host.innerHTML =
      '<div class="admin-editor"><h3>New major</h3>' +
      '<p class="admin-hint">This creates <code>data/' + esc(uni) + '/majors/&lt;slug&gt;.json</code>. ' +
      'You can add courses, prerequisites and the year layout straight after.</p>' +
      '<div class="form-field-row">' +
        field('anName', 'Name (English)', '') +
        field('anNameAr', 'Name (Arabic)', '') +
      '</div>' +
      '<div class="form-field"><label for="anFaculty">Faculty</label>' +
      '<select id="anFaculty">' + facultyOptions(faculty, true) + '</select>' +
      '<p class="admin-hint">A major with no faculty does not appear anywhere for students.</p></div>' +
      '<div class="form-field"><label for="anSlug">Slug (the filename)</label>' +
      '<input type="text" id="anSlug" value="" placeholder="filled in from the name">' +
      '<p class="admin-hint">Lowercase letters, numbers and hyphens. Other majors and saved student ' +
      'plans reference this, so it is worth getting right — renaming it later orphans them.</p></div>' +
      '<div class="form-actions">' +
        '<button type="button" class="home-btn admin-primary" id="anCreate">Create major</button> ' +
        '<button type="button" class="home-btn admin-mini" id="anCancel">Cancel</button>' +
      '</div><div id="adminMsg"></div></div>';
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var slugEl = document.getElementById('anSlug');
    var touched = false;
    on('anSlug', 'input', function(){ touched = true; });
    on('anName', 'input', function(e){ if(!touched) slugEl.value = slugify(e.target.value); });
    on('anCancel', 'click', function(){ host.innerHTML = ''; });

    on('anCreate', 'click', function(){
      var name = val('anName').trim();
      var slug = slugify(val('anSlug') || name);
      if(!name){ setMsg('Give the major a name.', 'err'); return; }
      if(!/^[a-z0-9][a-z0-9-]{1,48}$/.test(slug)){
        setMsg('Slug must be lowercase letters, numbers and hyphens.', 'err'); return;
      }
      var clash = (state.browseMajors || []).filter(function(m){ return m.slug === slug; })[0];
      if(clash){ setMsg('A major with the slug “' + esc(slug) + '” already exists here.', 'err'); return; }

      state.uni = uni;
      state.majorSlug = slug;
      state.majorSha = '';   // nothing to be stale against — this is a create
      state.major = {
        schemaVersion: 1, slug: slug, university: uni,
        name: name, nameAr: val('anNameAr').trim(),
        college: val('anFaculty'),
        icon: '🎓', iconKey: '',
        years: [{ id: 'y1', hasSummer: false }], courses: [], prerequisites: []
      };
      state.section = 'majors';
      markDirty();
      render();
      var h = document.getElementById('adminMajorEditor');
      if(h){
        h.innerHTML = majorEditor(state.major);
        bindIconPickers(); bindMajorSave();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setMsg('Not created yet — press Save major to write the file.', 'ok');
    });
  }

  function filterRows(q, sel){
    var needle = String(q || '').toLowerCase();
    document.querySelectorAll(sel).forEach(function(r){
      r.style.display = !needle || r.textContent.toLowerCase().indexOf(needle) !== -1 ||
        (r.querySelector('input') && Array.prototype.some.call(r.querySelectorAll('input'), function(i){
          return i.value.toLowerCase().indexOf(needle) !== -1;
        })) ? '' : 'none';
    });
  }

  function openMajor(uni, slug){
    // The editor's faculty list comes from the browse data. Opening a major
    // belonging to a university we have not browsed would otherwise render an
    // empty dropdown and look like the major has no faculty to choose from.
    var ready = (state.browseUni === uni && state.browseFaculties)
      ? Promise.resolve() : loadBrowse(uni);
    return ready.then(function(){
    return api('GET', '/api/major/' + uni + '/' + slug).then(function(res){
      state.uni = uni; state.majorSlug = slug; state.major = res.major; state.dirty = false;
      state.majorSha = res.sha || '';
      state.section = 'majors'; render();
      var host = document.getElementById('adminMajorEditor');
      if(host){
        host.innerHTML = majorEditor(state.major);
        bindIconPickers(); bindMajorSave();
        host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    }).catch(function(e){ toast(e.message); });
  }

  function val(id){ var el = document.getElementById(id); return el ? el.value : ''; }

  function bindUniEditor(slug){
    on('auAddCollege', 'click', function(){
      var host = document.getElementById('auColleges');
      var rows = host.querySelectorAll('[data-college-row]').length;
      if(!rows) host.innerHTML = '';
      // Rendered with its real index rather than string-patching index 0, which
      // produced duplicate indices as soon as two were added.
      var html = collegeRows([{ slug: '', name: '', nameAr: '', icon: '🏫' }])
        .replace(/data-college-row="0"/, 'data-college-row="' + rows + '"')
        .replace(/data-del-college="0"/, 'data-del-college="' + rows + '"')
        .replace(/admin-faculty-n">1</, 'admin-faculty-n">' + (rows + 1) + '<');
      host.insertAdjacentHTML('beforeend', html);
      bindCollegeDeletes();
      var last = host.querySelector('[data-college-row="' + rows + '"] .ac-name');
      if(last) last.focus();
    });
    bindCollegeDeletes();
    on('auSave', 'click', function(){
      var colleges = [];
      document.querySelectorAll('[data-college-row]').forEach(function(r){
        var s = r.querySelector('.ac-slug').value.trim();
        if(!s) return;
        colleges.push({ slug: s, name: r.querySelector('.ac-name').value.trim(),
                        nameAr: r.querySelector('.ac-namear').value.trim(),
                        icon: r.querySelector('.ac-icon').value.trim() });
      });
      var payload = {
        university: {
          slug: slug, name: val('auName'), nameAr: val('auNameAr'), shortName: val('auShort'),
          icon: val('auIcon'), iconKey: val('auIconKey'), website: val('auWebsite'),
          description: val('auDesc'), logoUrl: val('auLogo'), colleges: colleges
        },
        published: document.getElementById('auPublished').checked,
        baseSha: state.uniSha || ''
      };
      setMsg('Saving…', 'ok');
      api('PUT', '/api/university/' + slug, payload).then(function(res){
        // Track forward, so pressing Save twice in a row is not a conflict.
        state.uniSha = res.sha || '';
        setMsg('Saved. Live for everyone in about a minute.', 'ok');
        return loadTree();
      }).catch(function(e){ setMsg(esc(e.message), 'err'); });
    });
  }

  // Every destructive control asks first. A misclick in a table of forty rows
  // is easy and, before this, instant and silent.
  function bindCollegeDeletes(){
    document.querySelectorAll('[data-del-college]').forEach(function(b){
      b.addEventListener('click', function(){
        var row = b.closest('[data-college-row]');
        var name = (row.querySelector('.ac-name').value || row.querySelector('.ac-slug').value || 'this faculty').trim();
        if(!confirm('Remove the faculty "' + name + '"?\n\nMajors already pointing at it keep their own copy of the name, ' +
                    'but they stop being grouped under it. Nothing is saved until you press Save university.')) return;
        row.remove();
      });
    });
  }

  // Reads every input back into state.major. Called before any save and before
  // switching section, so edits typed in one view are not lost by navigating.
  function harvestCourses(){
    if(!state.major) return;
    document.querySelectorAll('[data-course]').forEach(function(r){
      var c = state.major.courses[Number(r.getAttribute('data-course'))];
      if(!c) return;
      c.courseNumber = r.querySelector('.cc-num').value.trim();
      c.name = r.querySelector('.cc-name').value.trim();
      c.nameAr = r.querySelector('.cc-namear').value.trim();
      c.creditHours = Number(r.querySelector('.cc-ch').value) || 0;
      c.category = r.querySelector('.cc-cat').value;
      c.yearId = r.querySelector('.cc-year').value;
      c.semester = r.querySelector('.cc-sem').value;
    });
  }

  function harvestMajorMeta(){
    if(!state.major || !document.getElementById('amName')) return;
    var m = state.major;
    m.name = val('amName'); m.nameAr = val('amNameAr');
    m.subtitle = val('amSub'); m.subtitleAr = val('amSubAr');
    m.college = val('amCollege'); m.icon = val('amIcon'); m.iconKey = val('amIconKey');
    m.imageUrl = val('amImage'); m.bio = val('amBio'); m.bioAr = val('amBioAr');
    var h = val('amHours'); m.degreeHours = h === '' ? null : Number(h);
  }

  function bindCourses(){
    document.querySelectorAll('[data-course] input, [data-course] select').forEach(function(i){
      i.addEventListener('change', markDirty);
    });
    document.querySelectorAll('[data-del-course]').forEach(function(b){
      b.addEventListener('click', function(){
        harvestCourses();
        var i = Number(b.getAttribute('data-del-course'));
        var c = state.major.courses[i];
        var links = (state.major.prerequisites || []).filter(function(p){
          return p[0] === c.id || p[1] === c.id;
        }).length;
        if(!confirm('Remove "' + (c.name || c.id) + '"?' +
                    (links ? '\n\nThis also removes ' + links + ' prerequisite link' + (links === 1 ? '' : 's') +
                             ' that refer to it — otherwise the plan could not be saved.' : '') +
                    '\n\nNothing is saved until you press Save major.')) return;
        var id = c.id;
        state.major.courses.splice(i, 1);
        // A dangling prerequisite would fail server validation, so the pairs
        // that referenced this course go with it.
        state.major.prerequisites = (state.major.prerequisites || []).filter(function(p){
          return p[0] !== id && p[1] !== id;
        });
        markDirty(); render();
      });
    });
    on('acAdd', 'click', function(){
      harvestCourses();
      var n = state.major.courses.length + 1;
      var years = state.major.years || [{ id: 'y1' }];
      state.major.courses.push({ id: 'new-course-' + n, courseNumber: '', name: 'New course',
        nameAr: '', creditHours: 3, category: 'core', yearId: years[0].id, semester: 's1' });
      markDirty(); render();
    });
  }

  function bindPrereqs(){
    on('apAdd', 'click', function(){
      var a = val('apBefore'), b = val('apAfter');
      if(!a || !b || a === b){ toast('Pick two different courses.'); return; }
      var exists = (state.major.prerequisites || []).some(function(p){ return p[0] === a && p[1] === b; });
      if(exists){ toast('That prerequisite is already there.'); return; }
      state.major.prerequisites = (state.major.prerequisites || []).concat([[a, b]]);
      markDirty(); render();
    });
    document.querySelectorAll('[data-del-pr]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var i = Number(btn.getAttribute('data-del-pr'));
        var p = state.major.prerequisites[i];
        if(!confirm('Remove this prerequisite?\n\n' + nameOf(p[0]) + '  →  ' + nameOf(p[1]) +
                    '\n\nThe second course becomes available without the first. ' +
                    'Nothing is saved until you press Save major.')) return;
        state.major.prerequisites.splice(i, 1);
        markDirty(); render();
      });
    });
  }

  function bindSchedule(){
    document.querySelectorAll('.admin-move').forEach(function(sel){
      sel.addEventListener('change', function(){
        var parts = sel.value.split('|');
        var c = state.major.courses[Number(sel.getAttribute('data-move'))];
        c.yearId = parts[0]; c.semester = parts[1];
        markDirty(); render();
      });
    });
    on('asAddYear', 'click', function(){
      var years = state.major.years || (state.major.years = []);
      years.push({ id: 'y' + (years.length + 1), hasSummer: false });
      markDirty(); render();
    });
    document.querySelectorAll('[data-del-year]').forEach(function(b){
      b.addEventListener('click', function(){
        var i = Number(b.getAttribute('data-del-year'));
        var y = state.major.years[i];
        var used = (state.major.courses || []).filter(function(c){ return c.yearId === y.id; }).length;
        if(!confirm('Remove year ' + y.id + '?' +
                    (used ? '\n\nIt still holds ' + used + ' course' + (used === 1 ? '' : 's') +
                            ', which would need a new year before this major can be saved.' : '') +
                    '\n\nNothing is saved until you press Save major.')) return;
        state.major.years.splice(i, 1);
        markDirty(); render();
      });
    });
    document.querySelectorAll('.ay-summer').forEach(function(cb, i){
      cb.addEventListener('change', function(){ state.major.years[i].hasSummer = cb.checked; markDirty(); render(); });
    });
  }

  function bindMajorSave(){
    on('amSave', 'click', function(){
      harvestCourses(); harvestMajorMeta();
      setMsg('Saving…', 'ok');
      api('PUT', '/api/major/' + state.uni + '/' + state.majorSlug,
          { major: state.major, baseSha: state.majorSha || '' })
        .then(function(res){
          state.major = res.major;
          state.majorSha = res.sha || '';
          markClean();
          setMsg('Saved. Live for everyone in about a minute.', 'ok');
          // Refresh the browser too, not just the tree — a new major, a
          // renamed one, or one moved to another faculty has to appear in its
          // group, and the tree does not carry faculties.
          return loadTree().then(function(){
            return state.browseUni === state.uni ? loadBrowse(state.uni) : null;
          });
        })
        .catch(function(e){ setMsg(esc(e.message), 'err'); });
    });
  }

  function bindAssets(){
    var pending = null;
    on('aaFile', 'change', function(e){
      var f = e.target.files && e.target.files[0];
      var btn = document.getElementById('aaUpload');
      var prev = document.getElementById('aaPreview');
      if(!f){ pending = null; btn.disabled = true; prev.innerHTML = ''; return; }
      var reader = new FileReader();
      reader.onload = function(){
        pending = { name: f.name, contentType: f.type, dataBase64: String(reader.result).split(',')[1] };
        btn.disabled = false;
        prev.innerHTML = '<div class="admin-logo-preview"><img src="' + String(reader.result) +
          '" alt="preview" style="max-width:160px;max-height:120px;object-fit:contain;"></div>' +
          '<p class="admin-hint">' + esc(f.name) + ' · ' + Math.round(f.size / 1024) + ' KB</p>';
      };
      reader.readAsDataURL(f);
    });
    on('aaUpload', 'click', function(){
      if(!pending) return;
      setMsg('Uploading…', 'ok');
      api('POST', '/api/assets', pending).then(function(res){
        setMsg('Uploaded as <code>' + esc(res.url) + '</code>. Paste that path into a logo or icon field.', 'ok');
        return refreshAssets();
      }).then(render).catch(function(e){ setMsg(esc(e.message), 'err'); });
    });
    document.querySelectorAll('[data-del-asset]').forEach(function(b){
      b.addEventListener('click', function(){
        var f = b.getAttribute('data-del-asset');
        if(!confirm('Delete ' + f + '? Anything still pointing at it will fall back to its icon.')) return;
        api('DELETE', '/api/assets/' + encodeURIComponent(f))
          .then(refreshAssets).then(render).catch(function(e){ toast(e.message); });
      });
    });
    document.querySelectorAll('[data-copy-asset]').forEach(function(b){
      b.addEventListener('click', function(){
        var v = b.getAttribute('data-copy-asset');
        if(navigator.clipboard) navigator.clipboard.writeText(v);
        toast('Copied ' + v);
      });
    });
  }

  function refreshAssets(){
    return api('GET', '/api/assets').then(function(res){ state.assets = res.assets || []; });
  }

  // ---------- open / close ----------

  function open(){
    ensureOverlay();
    document.getElementById('adminOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    try{ state.token = state.token || sessionStorage.getItem(TOKEN_KEY); }catch(e){}
    if(state.token && !state.tree){
      api('GET', '/api/status').then(function(me){
        state.username = me.username || '';
        state.status = me;
        return loadTree();
      }).then(function(){ return refreshAssets().catch(function(){}); })
        .then(render)
        .catch(function(){ signOut(true); render(); });
    } else {
      render();
    }
  }

  function close(){
    if(state.dirty && !confirm('You have unsaved changes. Close anyway?')) return;
    var el = document.getElementById('adminOverlay');
    if(el) el.classList.remove('open');
    document.body.style.overflow = '';
    if(location.hash === '#admin'){
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  window.AAUP_ADMIN = { open: open, close: close, isOpen: function(){
    var el = document.getElementById('adminOverlay');
    return !!(el && el.classList.contains('open'));
  } };

  function checkHash(){ if(location.hash === '#admin') open(); }
  window.addEventListener('hashchange', checkHash);
  if(document.readyState === 'complete') checkHash();
  else window.addEventListener('load', checkHash);
})();
