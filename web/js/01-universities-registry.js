// ============================================================================
// UNIVERSITIES REGISTRY — deliberately open for extension.
// This app started at AAUP but is built to host ANY university's plans.
// TO ADD A NEW UNIVERSITY:
//   1. Add an entry below (id must be short, lowercase, no spaces).
//   2. That's it. It appears in the New Plan dialog's university picker,
//      plan headers use its name automatically, and its plans get its own
//      badge on the Choose Plan screen.
// Gathered a whole university's plans? Export each plan (📤 Export Plan)
// and bundle the JSONs — anyone can import them on their own device.
// ============================================================================
window.APP_UNIVERSITIES = {};
// ============================================================================
// COLLEGES REGISTRY — the University → College → Plan layer shown on Home.
// Every plan (built-in or imported) belongs to exactly one college here via
// its `college` id. TO ADD A NEW COLLEGE: add an entry below (id must be
// unique, prefixed with the university id it belongs to) — it immediately
// gets its own tile on that university's Home screen, and shows up as a
// choice in the New Plan dialog. A college with zero plans yet still shows,
// just with an empty state ("no plans here yet — be the first to add one"),
// so the full shape of a university can exist before every plan does.
// ============================================================================
window.APP_COLLEGES = {};
// The real, official pool of "University Elective" courses, keyed by
// university id. When a plan's generic "uni-elective-N" placeholder is
// tapped, the course popup offers this exact list to choose from instead of
// a free-text box — same course catalog every major at that university
// draws its University Elective requirement from. No Arabic name is given
// here because none was provided as source material (see RULE ONE — not
// guessing a translation); the picker shows the English title regardless of
// UI language rather than invent one. A university with no entry here (or a
// plan whose "uni-elective" slot doesn't apply, e.g. AASU) falls back to the
// original free-text field.
window.APP_UNIV_ELECTIVES = {
  aaup: [
    { code: '040511052', en: 'Israeli & Zionism Studies I' },
    { code: '040511053', en: 'Jerusalem: Civilization and History' },
    { code: '040511061', en: 'Israeli & Zionism Studies II' },
    { code: '040511071', en: 'Development Management' },
    { code: '040511081', en: 'Home Gardening' },
    { code: '040511091', en: 'Fine Arts' },
    { code: '040511101', en: 'Current World Issues' },
    { code: '040511121', en: 'Physical Education' },
    { code: '040511132', en: 'Election and Political Participation' },
    { code: '040511133', en: 'The Palestinian Prisoners Movement' },
    { code: '040511140', en: 'Law in Our Life' },
    { code: '040511150', en: 'Islamic Culture' },
    { code: '040511160', en: 'Democracy and Human Rights' },
    { code: '040511170', en: 'Technology in Our Life' },
    { code: '040511180', en: 'Introduction to Astronomy Science' },
    { code: '040511200', en: 'Introduction to Economics' },
    { code: '040511211', en: 'Anthropology' },
    { code: '040511220', en: 'Anti-Corruption Challenges and Solution' },
    { code: '040511230', en: 'French Language' },
    { code: '040511240', en: 'German Language' },
    { code: '040511260', en: 'Introduction to Psychology' },
    { code: '040511270', en: 'Introduction to Sociology' },
    { code: '040511280', en: 'Human & Environment' },
    { code: '040511290', en: 'History of Science' },
    { code: '040511311', en: 'International Relations' },
    { code: '040511321', en: 'Science, Technology and Society' },
    { code: '040511400', en: 'Turkish Language' },
    { code: '040511411', en: 'Political Sciences' },
    { code: '040511421', en: 'Critical Thinking' },
    { code: '040511470', en: 'Medical Terminology in Hebrew' },
    { code: '040511490', en: 'Human Rights and Gender' },
    { code: '040511500', en: 'The Palestinian Cinema: An Alternative Narrative' },
    { code: '040511511', en: 'Modern Arab Thought' },
    { code: '040511521', en: 'Archeology' },
    { code: '040511611', en: 'Hebrew Language' },
    { code: '040511621', en: 'Civil Society Organizations' },
    { code: '040511990', en: 'Effective Communication' },
    { code: '060411001', en: 'Nutrition & Food Security' },
    { code: '280311100', en: 'Financial Literacy' },
    { code: '280311110', en: 'Introduction to Sign Language' }
  ]
  // next: xxx: [ { code: '...', en: '...' }, ... ]
};
// Free electives (unlike University Electives above) aren't drawn from one
// fixed university-wide catalog — they can be almost any course from any
// department, so there's no real "full list" to offer. This only holds
// specific electives a student has actually reported taking, keyed by plan
// prefix, purely as autocomplete SUGGESTIONS on top of the existing
// free-text field (which always stays — see isGenericElectiveSlot's field
// in the course modal). No course code is given here because none was
// provided as source material (see RULE ONE — not guessing one).
window.APP_FREE_ELECTIVE_SUGGESTIONS = {
  robotics: ['Basic Physics']
  // next: prefix: ['Course Name', ...]
};
// Where "Share this plan with the app maintainer" sends people. Leave ''
// to fall back to opening a pre-filled GitHub issue on the app's repo (see
// AAUP_IMPORTED.submitPlan) — no account setup needed. Once you have a
// Google Form (or any URL) for collecting community plans, paste it here.
window.APP_SUBMIT_URL = '';
// AUTO-COLLECT endpoint. When set, every plan a user builds or edits in the
// app — its college, courses, prerequisites: plan STRUCTURE only, never any
// personal progress, GPA, grades, name, or ID — is sent here quietly in the
// background so you can gather community plans without anyone pressing a
// "submit" button. This MUST be a small serverless endpoint that holds a
// GitHub token PRIVATELY and commits on the app's behalf (see COLLECTING.md
// for a ready-to-deploy Cloudflare Worker + setup). A static GitHub Pages
// site can't write to the repo by itself, and a token pasted into this file
// would be public — anyone could wipe the repo, and GitHub auto-revokes
// leaked tokens — so it never goes here, only in the collector's secrets.
// Leave '' to disable auto-collection entirely (nothing is sent anywhere).
window.APP_COLLECT_URL = 'https://plan-collector.pmhtrfalab999.workers.dev';
// Optional shared secret sent with each auto-collect POST, so your collector
// can ignore random traffic. Match it to the collector's COLLECT_SECRET. It's
// not a login and grants no repo access on its own — worst case someone reads
// it and can POST plan JSON to your collector, same as using the app — so a
// simple value is fine. Leave '' to send none.
window.APP_COLLECT_SECRET = 'Winston';
// Which collector you're pointing at, so the app sends in the shape that host
// accepts. Only two values:
//   'cloudflare'  (default) — sends JSON with the secret in a header, and
//                 reads the response to confirm delivery. Use with
//                 collector/cloudflare-worker.js. This is the tested path.
//   'appsscript'  — for a Google Apps Script web app (collector/
//                 google-apps-script.gs). Apps Script can't do the same CORS,
//                 so the app sends a "simple" text POST with the secret inside
//                 the body and can't read the reply back — delivery is
//                 best-effort (the collector overwrites by id, so a rare
//                 retry just re-saves the same plan, never a duplicate).
// Leave it 'cloudflare' unless/until you deploy the Apps Script version.
window.APP_COLLECT_MODE = 'cloudflare';
// Hosted JSON manifest of official/community plans the app can pull updates
// from when online (see "Check for updates" in Settings). A relative path
// works once this file is served (GitHub Pages, any static host) alongside
// plans/index.json — same-origin, no CORS setup needed. Opened as a local
// file:// this fetch just fails silently and the app stays fully offline,
// same as always. Leave '' to disable online sync entirely.
window.APP_PLANS_FEED_URL = 'plans/index.json';
// Repo the "📨 Contribute" button offers to open a pre-filled GitHub issue
// against when APP_SUBMIT_URL is empty — no account/server needed, just a
// place for submitted plan JSON to land for review. Leave '' to skip that
// option and fall back to "download + send it to the maintainer yourself".
window.APP_GITHUB_REPO = 'jo0dile/mymenupack';
// Shown next to "Developer" on Home and in Settings — the one unambiguous
// way to tell whether an update actually reached a given device, since the
// hosted version can otherwise look identical before and after a real
// change until the caching layers above catch up. Bump on every commit
// that reaches main:
//   fix / small tweak         -> +0.01  (2.00 -> 2.01)
//   small feature             -> +0.1   (2.0  -> 2.1)
//   big feature / redesign    -> next .5, or next whole number if already
//                                 past x.5 (2.0 -> 2.5, 2.5 -> 3.0)
window.APP_VERSION = '4.4';
