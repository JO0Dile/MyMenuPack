// ==========================
// CLOUD SYNC
// ==========================
// Real sign-in: an email and password, verified by cloud/cloudflare-worker.js
// against Cloudflare D1, so a student's selected plan, progress, grades, and
// custom plans follow them to a new device. This is a different feature from
// js/38-accounts.js's "Accounts" — that lets ONE device hold several separate
// local profiles (a sibling sharing a laptop); this lets ONE profile follow a
// student across devices. Two different problems, so they get two different
// names throughout the UI: "Accounts" stays local-profile switching, this is
// always "Cloud Sync."
//
// Optional end to end: with window.APP_CLOUD_URL left '', isConfigured() is
// false, the Settings section says so, and nothing else about the app
// changes. Nobody's data leaves their device until a student actually signs
// up.
(function(){
  var TOKEN_KEY = 'aaup_cloudToken';
  var EMAIL_KEY = 'aaup_cloudEmail';
  var LAST_SYNC_KEY = 'aaup_cloudLastSyncedAt';
  // Keys that exist under the aaup_ prefix but describe THIS DEVICE, not the
  // signed-in student, so they must never round-trip through a sync blob —
  // syncing "the list of local profile names on this device" from one
  // device to another would just corrupt both.
  var EXCLUDE_EXACT = { aaup_cloudToken: 1, aaup_cloudEmail: 1, aaup_cloudLastSyncedAt: 1,
                         aaup_accounts: 1, aaup_currentAccount: 1 };
  var EXCLUDE_PREFIX = 'aaup_account_snapshot_';
  var AUTO_SYNC_MS = 45000;

  function apiBase(){ return window.APP_CLOUD_URL || ''; }
  function isConfigured(){ return !!apiBase(); }

  function getToken(){ try{ return localStorage.getItem(TOKEN_KEY) || ''; }catch(e){ return ''; } }
  function setToken(t){ try{ localStorage.setItem(TOKEN_KEY, t); }catch(e){} }
  function clearToken(){ try{ localStorage.removeItem(TOKEN_KEY); }catch(e){} }
  function getEmail(){ try{ return localStorage.getItem(EMAIL_KEY) || ''; }catch(e){ return ''; } }
  function setEmail(e){ try{ localStorage.setItem(EMAIL_KEY, e); }catch(e){} }
  function getLastSyncedAt(){ try{ return parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0', 10) || 0; }catch(e){ return 0; } }
  function setLastSyncedAt(t){ try{ localStorage.setItem(LAST_SYNC_KEY, String(t)); }catch(e){} }

  function isSignedIn(){ return isConfigured() && !!getToken(); }

  // ---------- HTTP ----------
  function request(path, opts){
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if(token){ headers.Authorization = 'Bearer ' + token; }
    return fetch(apiBase() + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      keepalive: !!opts.keepalive
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        return { ok: res.ok, status: res.status, data: data };
      });
    }).catch(function(){
      return { ok: false, status: 0, data: { error: 'could not reach the server — check your connection' } };
    });
  }

  // ---------- the synced blob ----------
  function relevantKeys(){
    var keys = [];
    var progressKey = window.__PROGRESS_STORAGE_KEY;
    if(progressKey) keys.push(progressKey);
    try{
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(!k || keys.indexOf(k) !== -1) continue;
        if(EXCLUDE_EXACT[k] || k.indexOf(EXCLUDE_PREFIX) === 0) continue;
        if(k.indexOf('aaup_') === 0 || k.indexOf('aaup-imported-progress-') === 0){ keys.push(k); }
      }
    }catch(e){}
    return keys;
  }
  function collectLocalData(){
    var data = {};
    relevantKeys().forEach(function(k){ data[k] = localStorage.getItem(k); });
    return data;
  }
  function localHasMeaningfulData(){
    return relevantKeys().some(function(k){
      var v = localStorage.getItem(k);
      return v && v !== '{}' && v !== '[]' && v !== 'null';
    });
  }
  function applyRemoteData(data){
    if(!data || typeof data !== 'object') return;
    Object.keys(data).forEach(function(k){
      if(EXCLUDE_EXACT[k] || k.indexOf(EXCLUDE_PREFIX) === 0) return; // never let a synced blob overwrite this device's own identity
      if(data[k] !== null && data[k] !== undefined){ try{ localStorage.setItem(k, data[k]); }catch(e){} }
    });
  }

  // ---------- auth ----------
  function signUp(email, password){
    return request('/api/signup', { method: 'POST', body: { email: email, password: password } }).then(function(r){
      if(!r.ok) return r;
      setToken(r.data.token); setEmail(r.data.email);
      // A brand-new account has nothing to conflict with — push straight away
      // so this device's data is the starting point.
      return push(null).then(function(){ return r; });
    });
  }
  function signIn(email, password){
    return request('/api/login', { method: 'POST', body: { email: email, password: password } }).then(function(r){
      if(!r.ok) return r;
      setToken(r.data.token); setEmail(r.data.email);
      return r;
    });
  }
  function signOut(){
    // Best-effort final push so the account is left holding this device's
    // latest state, but never blocks signing out on it — a flaky connection
    // must not trap someone in a signed-in state they asked to leave.
    if(isSignedIn()){ push(getLastSyncedAt(), true); }
    clearToken(); setEmail('');
  }
  function changePassword(current, next){
    return request('/api/password/change', { method: 'POST', body: { currentPassword: current, newPassword: next } })
      .then(function(r){ if(r.ok){ setToken(r.data.token); } return r; });
  }
  function deleteCloudAccount(){
    return request('/api/account', { method: 'DELETE' }).then(function(r){
      if(r.ok){ clearToken(); setEmail(''); setLastSyncedAt(0); }
      return r;
    });
  }

  // ---------- sync ----------
  // keepalive lets this survive a tab actually closing (used on sign-out and
  // on visibilitychange->hidden); it is NOT used for interactive pushes,
  // where a real response (and conflict handling) is expected.
  function push(baseUpdatedAt, keepalive){
    return request('/api/sync', {
      method: 'POST', keepalive: keepalive,
      body: { data: collectLocalData(), baseUpdatedAt: baseUpdatedAt }
    }).then(function(r){
      if(r.ok){ setLastSyncedAt(r.data.updatedAt); }
      return r;
    });
  }
  function pull(){
    return request('/api/sync', { method: 'GET' }).then(function(r){
      if(r.ok){ setLastSyncedAt(r.data.updatedAt); }
      return r;
    });
  }

  // The one moment this module ever has to choose between two DIFFERENT
  // sets of real data rather than just moving one forward: right after
  // sign-in, when this device already has its own progress AND the account
  // already has synced data from somewhere else. Every other push carries a
  // baseUpdatedAt and either applies cleanly or 409s onto the explicit
  // "Sync now" flow, which is never silent about a conflict either.
  function reconcileAfterSignIn(rtl, onDone){
    pull().then(function(r){
      if(!r.ok){ onDone(r); return; }
      var serverHasData = r.data.updatedAt > 0 && r.data.data && Object.keys(r.data.data).length;
      var localHasData = localHasMeaningfulData();
      if(!serverHasData){
        // Nothing synced yet under this account — this device's data becomes
        // the starting point.
        push(r.data.updatedAt).then(function(){ onDone({ ok: true }); });
        return;
      }
      if(!localHasData){
        // A fresh device (or a student who hasn't used this browser before)
        // signing into an account that already has real progress — just
        // load it, nothing here is worth asking about.
        applyRemoteData(r.data.data);
        onDone({ ok: true, applied: true });
        return;
      }
      // Both sides have something real. Ask, rather than guessing which one
      // to throw away — the whole point of this feature is that neither copy
      // is disposable.
      showConflictChoice(rtl, function(choice){
        if(choice === 'remote'){
          applyRemoteData(r.data.data);
          onDone({ ok: true, applied: true, reload: true });
        } else if(choice === 'local'){
          push(r.data.updatedAt).then(function(){ onDone({ ok: true }); });
        } else {
          onDone({ ok: true, skipped: true });
        }
      });
    });
  }

  function showConflictChoice(rtl, onChoice){
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.zIndex = '999';
    var card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '380px';
    card.style.textAlign = 'center';
    var title = document.createElement('h3');
    title.style.margin = '0 0 8px';
    title.textContent = rtl ? '☁️ يوجد تقدّم محفوظ في الحسابين' : '☁️ Both this device and your account have progress';
    var text = document.createElement('p');
    text.style.cssText = 'margin:0 0 18px;color:var(--text-dim);font-size:12.5px;line-height:1.55;';
    text.textContent = rtl
      ? 'هذا الجهاز لديه تقدّم محفوظ محليًا، وحسابك السحابي لديه تقدّم محفوظ أيضًا. أيّهما تريد الاحتفاظ به؟ (الآخر سيُستبدل)'
      : 'This device has its own saved progress, and your account already has synced progress too. Which one do you want to keep? (The other will be replaced.)';
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    function btn(label, choice){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'home-btn';
      b.style.cssText = 'border-color:var(--accent);color:var(--text);width:100%;';
      b.textContent = label;
      b.addEventListener('click', function(){
        if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
        onChoice(choice);
      });
      return b;
    }
    actions.appendChild(btn(rtl ? '📱 إبقاء بيانات هذا الجهاز' : '📱 Keep this device’s data', 'local'));
    actions.appendChild(btn(rtl ? '☁️ استخدام البيانات المتزامنة' : '☁️ Use the synced data', 'remote'));
    var skip = btn(rtl ? 'قرّر لاحقًا' : 'Decide later', 'skip');
    skip.className = 'home-btn'; skip.style.cssText = 'width:100%;';
    actions.appendChild(skip);
    card.appendChild(title); card.appendChild(text); card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ---------- background upkeep ----------
  var autoTimer = null;
  function startAutoSync(){
    stopAutoSync();
    autoTimer = setInterval(function(){
      if(isSignedIn() && document.visibilityState === 'visible'){ push(getLastSyncedAt()); }
    }, AUTO_SYNC_MS);
  }
  function stopAutoSync(){ if(autoTimer){ clearInterval(autoTimer); autoTimer = null; } }
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden' && isSignedIn()){ push(getLastSyncedAt(), true); }
  });
  if(isSignedIn()){ startAutoSync(); }

  // ---------- Settings section (same sectionHtml/bindSection contract as
  // js/39-orphans.js, so 37-sidebar.js's Settings body wires it in the same
  // way it already wires that one) ----------
  function lastSyncLabel(r){
    var t = getLastSyncedAt();
    if(!t) return '';
    var mins = Math.round((Date.now() - t) / 60000);
    var when = mins < 1 ? (r ? 'الآن' : 'just now')
      : mins < 60 ? (r ? ('قبل ' + mins + ' د') : (mins + 'm ago'))
      : (r ? ('قبل ' + Math.round(mins / 60) + ' س') : (Math.round(mins / 60) + 'h ago'));
    return (r ? 'آخر مزامنة: ' : 'Last synced: ') + when;
  }

  function sectionHtml(r){
    if(!isConfigured()){
      return '<h3 style="margin-bottom:6px;">☁️ ' + (r ? 'المزامنة السحابية' : 'Cloud Sync') + '</h3>' +
        '<p class="form-note" style="margin-top:0;">' + (r
          ? 'المزامنة السحابية غير مُفعّلة لهذا التطبيق بعد. بياناتك تبقى على هذا الجهاز كما هي.'
          : 'Cloud Sync isn’t set up for this app yet. Your data stays on this device exactly as it always has.') + '</p>';
    }
    if(isSignedIn()){
      var email = window.__escapeHtml(getEmail());
      return '<h3 style="margin-bottom:6px;">☁️ ' + (r ? 'المزامنة السحابية' : 'Cloud Sync') + '</h3>' +
        '<p class="form-note" style="margin-top:0;">' + (r ? 'مسجّل الدخول باسم ' : 'Signed in as ') + '<b>' + email + '</b></p>' +
        '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
        '<button type="button" class="home-btn" id="cloudSyncNowBtn">🔄 ' + (r ? 'مزامنة الآن' : 'Sync now') + '</button>' +
        '<button type="button" class="home-btn" id="cloudChangePwBtn">🔑 ' + (r ? 'تغيير كلمة المرور' : 'Change password') + '</button>' +
        '<button type="button" class="home-btn" id="cloudSignOutBtn">🚪 ' + (r ? 'تسجيل الخروج' : 'Sign out') + '</button>' +
        '</div>' +
        '<p class="form-note" id="cloudSyncStatus" style="margin-top:4px;">' + lastSyncLabel(r) + '</p>' +
        '<div id="cloudChangePwForm" style="display:none;margin-top:8px;"></div>' +
        '<p class="form-note" style="margin-top:14px;"><button type="button" id="cloudDeleteAcctBtn" style="background:none;border:none;color:var(--danger, #ff6b6b);font-size:11.5px;cursor:pointer;padding:0;">' +
          (r ? '🗑 حذف الحساب السحابي نهائيًا' : '🗑 Permanently delete cloud account') + '</button></p>' +
        '<div id="cloudMsg"></div>';
    }
    return '<h3 style="margin-bottom:6px;">☁️ ' + (r ? 'المزامنة السحابية' : 'Cloud Sync') + '</h3>' +
      '<p class="form-note" style="margin-top:0;">' + (r
        ? 'سجّل بإيميل وكلمة مرور ليتبعك تقدّمك وعلاماتك وخططك إلى أي جهاز جديد.'
        : 'Sign in with an email and password, and your progress, grades, and plans follow you to a new device.') + '</p>' +
      '<div class="form-field-row" style="flex-wrap:wrap;">' +
      '<div class="form-field"><input type="email" id="cloudEmail" placeholder="' + (r ? 'الإيميل' : 'Email') + '" autocomplete="email"></div>' +
      '<div class="form-field"><input type="password" id="cloudPassword" placeholder="' + (r ? 'كلمة المرور' : 'Password') + '" autocomplete="current-password"></div>' +
      '</div>' +
      '<div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">' +
      '<button type="button" class="home-btn" id="cloudSignInBtn" style="border-color:var(--accent);color:var(--text);">🔓 ' + (r ? 'تسجيل الدخول' : 'Sign in') + '</button>' +
      '<button type="button" class="home-btn" id="cloudSignUpBtn">➕ ' + (r ? 'إنشاء حساب' : 'Sign up') + '</button>' +
      '</div>' +
      '<div id="cloudMsg"></div>';
  }

  function showMsg(root, text, isError){
    var el = root.querySelector('#cloudMsg');
    if(!el) return;
    el.innerHTML = '<p class="' + (isError ? 'dev-error-msg' : 'form-note') + '">' + window.__escapeHtml(text) + '</p>';
  }

  function bindSection(root, onChange){
    if(!root || !isConfigured()) return;
    var rtl = document.body.classList.contains('rtl-mode');

    var syncBtn = root.querySelector('#cloudSyncNowBtn');
    if(syncBtn){
      syncBtn.addEventListener('click', function(){
        syncBtn.disabled = true; syncBtn.textContent = '🔄 ' + (rtl ? 'جارٍ...' : 'Syncing…');
        push(getLastSyncedAt()).then(function(r){
          if(r.ok){ onChange(); return; }
          if(r.data && r.data.conflict){
            showConflictChoice(rtl, function(choice){
              if(choice === 'remote'){ applyRemoteData(r.data.serverData); setLastSyncedAt(r.data.serverUpdatedAt); location.reload(); }
              else if(choice === 'local'){ push(r.data.serverUpdatedAt).then(onChange); }
              else { onChange(); }
            });
            return;
          }
          showMsg(root, (r.data && r.data.error) || 'Sync failed.', true);
          syncBtn.disabled = false; syncBtn.textContent = '🔄 ' + (rtl ? 'مزامنة الآن' : 'Sync now');
        });
      });
    }
    var signOutBtn = root.querySelector('#cloudSignOutBtn');
    if(signOutBtn){
      signOutBtn.addEventListener('click', function(){ signOut(); onChange(); });
    }
    var deleteBtn = root.querySelector('#cloudDeleteAcctBtn');
    if(deleteBtn){
      deleteBtn.addEventListener('click', function(){
        var warn = rtl
          ? 'حذف حسابك السحابي نهائيًا؟ لن يمكن استرجاعه، لكنّ بيانات هذا الجهاز نفسها تبقى محفوظة عليه كما هي.'
          : 'Permanently delete your cloud account? This can’t be undone — but this device’s own copy of your data stays right here, untouched.';
        window.__showConfirmDialog(warn, function(){
          deleteCloudAccount().then(function(r){
            if(!r.ok){ showMsg(root, (r.data && r.data.error) || 'Could not delete account.', true); return; }
            onChange();
          });
        }, rtl);
      });
    }
    var changePwBtn = root.querySelector('#cloudChangePwBtn');
    if(changePwBtn){
      changePwBtn.addEventListener('click', function(){
        var box = root.querySelector('#cloudChangePwForm');
        if(!box) return;
        var showing = box.style.display !== 'none';
        if(showing){ box.style.display = 'none'; box.innerHTML = ''; return; }
        box.style.display = 'block';
        box.innerHTML =
          '<div class="form-field-row" style="flex-wrap:wrap;">' +
          '<div class="form-field"><input type="password" id="cloudPwCurrent" placeholder="' + (rtl ? 'كلمة المرور الحالية' : 'Current password') + '" autocomplete="current-password"></div>' +
          '<div class="form-field"><input type="password" id="cloudPwNew" placeholder="' + (rtl ? 'كلمة المرور الجديدة' : 'New password') + '" autocomplete="new-password"></div>' +
          '</div>' +
          '<div class="form-actions" style="justify-content:flex-start;">' +
          '<button type="button" class="home-btn" id="cloudPwSubmit" style="border-color:var(--accent);color:var(--text);">' + (rtl ? 'تحديث' : 'Update') + '</button>' +
          '</div>';
        box.querySelector('#cloudPwSubmit').addEventListener('click', function(){
          var cur = box.querySelector('#cloudPwCurrent').value;
          var next = box.querySelector('#cloudPwNew').value;
          changePassword(cur, next).then(function(r){
            if(!r.ok){ showMsg(root, (r.data && r.data.error) || 'Could not change password.', true); return; }
            box.style.display = 'none'; box.innerHTML = '';
            showMsg(root, rtl ? 'تم تحديث كلمة المرور.' : 'Password updated.', false);
          });
        });
      });
    }
    var signInBtn = root.querySelector('#cloudSignInBtn');
    var signUpBtn = root.querySelector('#cloudSignUpBtn');
    function readCreds(){
      var email = (root.querySelector('#cloudEmail') || {}).value || '';
      var password = (root.querySelector('#cloudPassword') || {}).value || '';
      return { email: email.trim(), password: password };
    }
    if(signInBtn){
      signInBtn.addEventListener('click', function(){
        var c = readCreds();
        signInBtn.disabled = true;
        signIn(c.email, c.password).then(function(r){
          signInBtn.disabled = false;
          if(!r.ok){ showMsg(root, r.data.error || 'Sign in failed.', true); return; }
          reconcileAfterSignIn(rtl, function(res){
            startAutoSync();
            if(res.reload){ location.reload(); return; }
            onChange();
            if(window.__showToast){ window.__showToast(rtl ? '☁️ تم تسجيل الدخول.' : '☁️ Signed in.'); }
          });
        });
      });
    }
    if(signUpBtn){
      signUpBtn.addEventListener('click', function(){
        var c = readCreds();
        signUpBtn.disabled = true;
        signUp(c.email, c.password).then(function(r){
          signUpBtn.disabled = false;
          if(!r.ok){ showMsg(root, r.data.error || 'Sign up failed.', true); return; }
          startAutoSync();
          onChange();
          if(window.__showToast){ window.__showToast(rtl ? '☁️ تم إنشاء الحساب.' : '☁️ Account created.'); }
        });
      });
    }
  }

  window.AAUP_CLOUD = {
    isConfigured: isConfigured, isSignedIn: isSignedIn, getEmail: getEmail,
    sectionHtml: sectionHtml, bindSection: bindSection
  };
})();
