// ---------------------------------------------------------------------------
// Plan collector — Google Apps Script version (an alternative to the
// Cloudflare Worker). Deploy this as a Web App and it commits each plan the
// app sends into app/plans/collected/<id>.json in your GitHub repo, holding
// the GitHub token privately in Script Properties.
//
// This is the "stay inside Google" option. The Cloudflare Worker
// (collector/cloudflare-worker.js) is the tested default; use this only if you
// prefer it. Set window.APP_COLLECT_MODE = 'appsscript' in plan.html when you
// point the app here.
//
// Full walkthrough: COLLECTING.md. In short:
//   1. script.google.com -> New project -> paste this in.
//   2. Project Settings -> Script Properties, add:
//        GITHUB_TOKEN    fine-grained token, Contents: Read+Write, this repo only
//        REPO_OWNER      e.g. JO0Dile
//        REPO_NAME       e.g. MyMenuPack
//        REPO_BRANCH     e.g. main
//        COLLECT_SECRET  a word you make up; match APP_COLLECT_SECRET in plan.html
//   3. Deploy -> New deployment -> type "Web app", execute as "Me",
//      who has access "Anyone". Copy the /exec URL into APP_COLLECT_URL.
//
// Note on how the app talks to this: Apps Script web apps can't return the
// CORS headers a browser needs to READ the reply, so the app sends a "simple"
// text POST (secret in the body) and can't confirm the response. That's fine:
// this handler overwrites by id, so an occasional unconfirmed retry just
// re-saves the same plan — never a duplicate.
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Optional shared secret (arrives in the body, not a header).
    var wantSecret = props.getProperty('COLLECT_SECRET');
    if (wantSecret && String(body.secret || '') !== wantSecret) {
      return out({ error: 'forbidden' });
    }

    // Re-slugify the id server-side — never trust client input in a file path.
    var id = String(body.id || '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
    if (!id) return out({ error: 'missing or invalid id' });
    if (!body.plan || typeof body.plan !== 'object') return out({ error: 'missing plan' });

    var rawPlan = JSON.stringify(body.plan);
    if (rawPlan.length > 200000) return out({ error: 'plan too large' });

    var record = {
      id: id,
      plan: body.plan,
      appVersion: typeof body.appVersion === 'string' ? body.appVersion.slice(0, 20) : '',
      submittedAt: typeof body.submittedAt === 'string' ? body.submittedAt.slice(0, 40) : '',
      collectedAt: new Date().toISOString()
    };

    var owner = props.getProperty('REPO_OWNER');
    var repo = props.getProperty('REPO_NAME');
    var branch = props.getProperty('REPO_BRANCH') || 'main';
    var token = props.getProperty('GITHUB_TOKEN');
    if (!owner || !repo || !token) return out({ error: 'collector not configured' });

    var path = 'app/plans/collected/' + id + '.json';
    var api = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path;
    var ghHeaders = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'plan-collector-gas'
    };

    // Look up the existing file's sha so we update it in place (overwrite),
    // rather than failing when the same plan is sent again.
    var sha = null;
    var cur = UrlFetchApp.fetch(api + '?ref=' + encodeURIComponent(branch), {
      method: 'get', headers: ghHeaders, muteHttpExceptions: true
    });
    if (cur.getResponseCode() === 200) {
      sha = JSON.parse(cur.getContentText()).sha;
    }

    var content = Utilities.base64Encode(
      JSON.stringify(record, null, 2) + '\n', Utilities.Charset.UTF_8
    );
    var putPayload = { message: 'collect: ' + id, content: content, branch: branch };
    if (sha) putPayload.sha = sha;

    var put = UrlFetchApp.fetch(api, {
      method: 'put',
      headers: ghHeaders,
      contentType: 'application/json',
      payload: JSON.stringify(putPayload),
      muteHttpExceptions: true
    });

    if (put.getResponseCode() >= 200 && put.getResponseCode() < 300) {
      return out({ ok: true, id: id });
    }
    return out({ error: 'github write failed', status: put.getResponseCode() });
  } catch (err) {
    return out({ error: 'exception', detail: String(err).slice(0, 300) });
  }
}

// The app sends with mode:'no-cors' and never reads this, but returning JSON
// makes the endpoint easy to test by hand (e.g. from a curl or the Apps Script
// editor). GET just says it's alive.
function doGet() {
  return out({ ok: true, service: 'plan-collector', method: 'POST plans here' });
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
