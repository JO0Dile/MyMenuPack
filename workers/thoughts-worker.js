// ---------------------------------------------------------------------------
// Student Thoughts — a small Cloudflare Worker holding the shared wall.
//
// WHY THIS IS ITS OWN WORKER
//
// The admin Worker holds a GitHub token that can write to the repository.
// This endpoint accepts writes from ANYONE running the app — that is the
// whole point of a wall — so the two must never share a process, a secret or
// a blast radius. If this one is ever abused, the worst case is a wall full
// of rubbish that can be cleared with one KV delete. Nothing here can touch
// the repo, the plans, or a student's progress.
//
// WHAT IT STORES
//
// One line of text, a display name if the student set one, a timestamp, and
// an opaque device id used only so a student can delete their own post. No
// account, no email, no IP kept after rate limiting, no progress data. A
// thought is public by definition, so nothing private is accepted in the
// first place.
//
// SETUP
//   1. Create a KV namespace and bind it as THOUGHTS.
//   2. Paste this file into a new Worker and deploy it.
//   3. Put the Worker's URL in APP_THOUGHTS_URL (web/js/01-catalogue.js).
//   4. Optional: set ALLOWED_ORIGIN to your site so no other page can post.
//
// The app filters language before it ever calls this (web/js/58-wordfilter.js),
// but a Worker must never trust its client — anyone can curl this URL — so
// the same list runs again here, server-side, and that copy is the one that
// actually decides.
// ---------------------------------------------------------------------------

const MAX_LEN = 280;
const MAX_PER_PLAN = 200;        // the wall keeps the most recent N
const RATE_WINDOW_MS = 20 * 1000;
const RATE_MAX = 1;              // posts per device per window

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.THOUGHTS) return json({ error: 'KV namespace THOUGHTS is not bound' }, 500, cors);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    try {
      if (request.method === 'GET' && path.endsWith('/thoughts')) {
        const plan = safeId(url.searchParams.get('plan') || '');
        if (!plan) return json({ error: 'plan is required' }, 400, cors);
        const list = await readWall(env, plan);
        return json({ thoughts: list }, 200, cors);
      }

      if (request.method === 'POST' && path.endsWith('/thoughts')) {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: 'invalid json' }, 400, cors);
        return await addThought(env, body, cors, request);
      }

      if (request.method === 'DELETE' && path.includes('/thoughts/')) {
        const id = decodeURIComponent(path.split('/thoughts/')[1] || '');
        const body = await request.json().catch(() => ({}));
        return await deleteThought(env, id, String(body.by || ''), cors);
      }
    } catch (err) {
      return json({ error: 'server error' }, 500, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },
};

// ---- storage ---------------------------------------------------------------

const key = (plan) => `wall:${plan}`;

async function readWall(env, plan) {
  const raw = await env.THOUGHTS.get(key(plan));
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeWall(env, plan, list) {
  await env.THOUGHTS.put(key(plan), JSON.stringify(list.slice(0, MAX_PER_PLAN)));
}

async function addThought(env, body, cors, request) {
  const plan = safeId(body.plan || '');
  const by = safeId(body.by || '');
  const text = clean(String(body.text || '')).slice(0, MAX_LEN).trim();
  const name = clean(String(body.name || '')).slice(0, 40).trim();

  if (!plan) return json({ error: 'plan is required' }, 400, cors);
  if (!by) return json({ error: 'by is required' }, 400, cors);
  if (!text) return json({ error: 'empty' }, 400, cors);

  // The client already checked; check again, because the client is whatever
  // is on the other end of the wire and may not be the app at all.
  const bad = firstBadWord(text);
  if (bad) return json({ error: 'blocked', word: bad }, 422, cors);

  // One post per device per window. Keyed on the device id, not the IP: a
  // whole campus can share one address, and blocking a campus to slow one
  // person down is the wrong trade.
  const rateKey = `rate:${by}`;
  const last = await env.THOUGHTS.get(rateKey);
  if (last && Date.now() - Number(last) < RATE_WINDOW_MS) {
    return json({ error: 'slow down' }, 429, cors);
  }
  await env.THOUGHTS.put(rateKey, String(Date.now()), { expirationTtl: 60 });

  const item = {
    id: safeId(body.id || '') || `${by}-${Date.now().toString(36)}`,
    text,
    name,
    at: Date.now(),
    by,
  };

  const list = await readWall(env, plan);
  // Same id twice = a queued post being retried after it actually landed.
  if (!list.some((t) => t.id === item.id)) list.unshift(item);
  await writeWall(env, plan, list);

  return json({ ok: true, thought: item }, 200, cors);
}

async function deleteThought(env, id, by, cors) {
  if (!id || !by) return json({ error: 'id and by are required' }, 400, cors);
  // The device id is the only claim of ownership there is. It is not a
  // password and is not treated as one — it lets a student remove their own
  // post from their own phone, and nothing more.
  const planKeys = await env.THOUGHTS.list({ prefix: 'wall:' });
  for (const k of planKeys.keys) {
    const plan = k.name.slice('wall:'.length);
    const list = await readWall(env, plan);
    const next = list.filter((t) => !(t.id === id && t.by === by));
    if (next.length !== list.length) {
      await writeWall(env, plan, next);
      return json({ ok: true }, 200, cors);
    }
  }
  return json({ ok: true, note: 'nothing matched' }, 200, cors);
}

// ---- helpers ---------------------------------------------------------------

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function safeId(s) {
  return String(s).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
}

// Angle brackets never survive: the app escapes on render too, but a stored
// value that cannot contain markup is one less thing to get right later.
function clean(s) {
  return s.replace(/[<>]/g, '').replace(/\s+/g, ' ');
}

// ---- the same filter as the client, kept deliberately simple ---------------
//
// This is the copy that decides. It is a shortened version of
// web/js/58-wordfilter.js: same normalization, same whole-word rule. When you
// add a word to one, add it to the other — a word blocked only on the client
// is not blocked at all.

const AR_PREFIX = '(?:[\\u0648\\u0641\\u0628\\u0643\\u0644]|\\u0627\\u0644|\\u064a\\u0627|\\u0647\\u0627|\\u0647\\u0627\\u0644)*';
const AR_SUFFIX = '(?:\\u0643|\\u0643\\u0645|\\u0647|\\u0647\\u0627|\\u0647\\u0645|\\u064a|\\u0646\\u0627|\\u064a\\u0646|\\u0627\\u062a)*';

const WORDS_EN = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'tranny', 'kike', 'spic', 'chink',
  'coon', 'wetback', 'paki', 'gook', 'fuck', 'shit', 'bitch', 'bastard', 'asshole',
  'ass', 'arse', 'dick', 'cock', 'prick', 'pussy', 'cunt', 'whore', 'slut',
  'wanker', 'twat', 'douche', 'piss', 'crap', 'donkey', 'pig', 'dog', 'monkey',
  'swine', 'kelev', 'kelef', 'zona', 'sharmuta', 'manyak', 'kus',
];

const WORDS_AR = [
  'حمار', 'جحش', 'كلب', 'خنزير',
  'قرد', 'وسخ', 'قذر', 'شرموط',
  'قحبه', 'عاهره', 'منيوك',
  'خول', 'لوطي', 'كس', 'طيز',
  'خرا', 'غبي', 'تافه', 'حقير',
  'كيليف', 'زونا', 'مانياك',
];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', $: 's', '!': 'i' };

function normalize(text) {
  let s = String(text);
  try { s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch {}
  s = s.toLowerCase()
    .replace(/[ً-ٟـ​-‏]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[013457|@$!]/g, (ch) => LEET[ch] || ch);
  return s.replace(/(.)\1{1,}/g, '$1');
}

function squeeze(s) { return s.replace(/[\s._\-*'"`~^()[\]{}/\\]+/g, ''); }
function collapse(w) { return w.replace(/(.)\1{1,}/g, '$1'); }

const PATTERNS = [...WORDS_EN, ...WORDS_AR].map((raw) => {
  const w = collapse(normalize(raw));
  const isArabic = /[؀-ۿ]/.test(w);
  const open = '(?:^|[^\\p{L}\\p{N}])';
  const close = '(?:$|[^\\p{L}\\p{N}])';
  const src = isArabic
    ? open + AR_PREFIX + w + AR_SUFFIX + close
    : open + w + '(?:s|es|ed|ing)?' + close;
  return { raw, re: new RegExp(src, 'u') };
});

function firstBadWord(text) {
  const hay = normalize(text);
  const squeezed = collapse(squeeze(hay));
  for (const p of PATTERNS) {
    if (p.re.test(hay) || (squeezed !== hay && p.re.test(squeezed))) return p.raw;
  }
  return '';
}
