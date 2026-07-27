import { api, ApiError } from './api.js';
import { store } from './store.js';
import { isAvailable, missingFor, summarise } from './prerequisites.js';
import { makeScale, computeGpa, earnedCredits, formatGpa } from './gpa.js';
import * as assess from './assessment.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;   // textContent, never innerHTML:
  return n;                                  // every string here is server data
};

const state = { universities: [], majors: [], courses: [], major: null, scale: null };

function setStatus(msg, kind = 'info') {
  const s = $('#status');
  s.className = `status ${kind}`;
  s.textContent = msg;
  s.hidden = !msg;
}

async function guard(fn) {
  try {
    setStatus('Loading…');
    await fn();
    setStatus('');
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Something went wrong.';
    setStatus(msg, 'error');
    console.error(e);
  }
}

// ---------- views ----------

async function showUniversities() {
  await guard(async () => {
    state.universities = await api.universities();
    const list = $('#list');
    list.replaceChildren();
    $('#crumb').textContent = 'Universities';
    $('#plan').hidden = true;
    list.hidden = false;

    for (const u of state.universities) {
      const card = el('button', 'card');
      card.appendChild(el('div', 'card-title', u.name));
      if (u.nameAr) card.appendChild(el('div', 'card-sub', u.nameAr));
      card.appendChild(el('div', 'card-meta',
        `${u._count.majors} major${u._count.majors === 1 ? '' : 's'}`));
      card.addEventListener('click', () => showMajors(u));
      list.appendChild(card);
    }
  });
}

async function showMajors(uni) {
  await guard(async () => {
    state.majors = await api.majors(uni.slug);
    const list = $('#list');
    list.replaceChildren();
    $('#crumb').textContent = `Universities / ${uni.name}`;

    if (!state.majors.length) {
      list.appendChild(el('p', 'empty', 'No majors published for this university yet.'));
      return;
    }
    for (const m of state.majors) {
      const card = el('button', 'card');
      card.appendChild(el('div', 'card-title', m.name));
      if (m.nameAr) card.appendChild(el('div', 'card-sub', m.nameAr));
      card.appendChild(el('div', 'card-meta', `${m._count.courses} courses`));
      card.addEventListener('click', () => showPlan(uni, m));
      list.appendChild(card);
    }
  });
}

async function showPlan(uni, major) {
  await guard(async () => {
    // The full major carries its grading scale; the list endpoint does not.
    const full = await api.major(major.id);
    state.major = full;
    state.scale = makeScale(full.gradingScale);
    state.courses = await api.courses(major.id);
    $('#crumb').textContent = `Universities / ${uni.name} / ${major.name}`;
    $('#list').hidden = true;
    $('#plan').hidden = false;
    renderPlan();
  });
}

function renderPlan() {
  const done = store.completedIds();
  const records = store.records();
  const s = summarise(state.courses, done);
  const { gpa } = computeGpa(state.courses, records, state.scale);
  // Credits that count toward graduation — a ticked box with an F is taken,
  // not passed, so it must not inflate this.
  const earned = earnedCredits(state.courses, records, state.scale);

  const head = $('#planHead');
  head.replaceChildren();
  head.appendChild(el('h2', null, state.major.name));
  head.appendChild(el('p', 'summary',
    `${s.done}/${s.total} courses · ${earned}/${s.totalCredits} credit hours earned · ` +
    `${s.percent}% · ${s.available} available now`));
  head.appendChild(el('p', 'summary gpa',
    `GPA ${formatGpa(gpa)}` + (state.scale ? `  ·  ${state.scale.name}` : '')));
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${s.percent}%`;
  bar.appendChild(fill);
  head.appendChild(bar);

  // Group by year/semester. Courses with neither belong to an elective pool,
  // which is a real part of the plan and gets its own section rather than
  // being dropped or given a fake position.
  const groups = new Map();
  const pool = [];
  for (const c of state.courses) {
    if (c.year == null || c.semester == null) { pool.push(c); continue; }
    const key = `${c.year}-${c.semester}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const grid = $('#grid');
  grid.replaceChildren();
  const keys = [...groups.keys()].sort((a, b) => {
    const [ay, as] = a.split('-').map(Number), [by, bs] = b.split('-').map(Number);
    return ay - by || as - bs;
  });
  const semName = { 1: 'First semester', 2: 'Second semester', 3: 'Summer' };
  for (const k of keys) {
    const [y, sem] = k.split('-').map(Number);
    grid.appendChild(sectionFor(`Year ${y} — ${semName[sem] || 'Semester ' + sem}`,
      groups.get(k), done));
  }
  if (pool.length) grid.appendChild(sectionFor('Elective pool', pool, done));
}

function sectionFor(title, courses, done) {
  const sec = el('section', 'sem');
  sec.appendChild(el('h3', null, title));
  const row = el('div', 'row');
  for (const c of courses) row.appendChild(courseCard(c, done));
  sec.appendChild(row);
  return sec;
}

function courseCard(c, done) {
  const isDone = done.has(c.id);
  const avail = isAvailable(c, done);
  const card = el('article',
    `course cat-${c.category.toLowerCase()}` +
    (isDone ? ' done' : '') + (!isDone && !avail ? ' locked' : ''));

  card.appendChild(el('div', 'course-name', c.name));
  const meta = el('div', 'course-meta');
  if (c.code) meta.appendChild(el('span', 'code', c.code));
  meta.appendChild(el('span', 'cr', `${c.credits}H`));
  card.appendChild(meta);

  if (!isDone && !avail) {
    const blocked = missingFor(c, done);
    const note = el('div', 'blocked');
    note.textContent = 'Needs: ' + blocked
      .map((g) => g.anyOf.map((o) => o.name).join(' or '))
      .join(' + ');
    card.appendChild(note);
  }

  const btn = el('button', 'tick', isDone ? '✓ Completed' : 'Mark complete');
  btn.addEventListener('click', () => {
    store.toggle(c.id);
    renderPlan();   // availability cascades, so the whole plan re-renders
  });
  card.appendChild(btn);

  // Grades only make sense once a course is done, and the options come from
  // the major's own scale rather than a fixed list in this file.
  if (isDone && state.scale) {
    const sel = el('select', 'grade');
    const blank = el('option', null, 'grade —');
    blank.value = '';
    sel.appendChild(blank);
    for (const letter of [...state.scale.letters, 'FA', 'W']) {
      const o = el('option', null, letter);
      o.value = letter;
      sel.appendChild(o);
    }
    sel.value = store.records().get(c.id)?.grade || '';
    sel.addEventListener('change', () => {
      store.setGrade(c.id, sel.value);
      renderPlan();
    });
    card.appendChild(sel);
    card.appendChild(breakdown(c, sel.value));
  }
  return card;
}

// ---------- assessment breakdown ----------
// Deliberately no "Final Exam" preset: AAUP never publishes that mark, so it
// is derived as the leftover share instead of asked for. A student who does
// know it (asked the instructor) can still add it as a custom row.
function breakdown(course, currentLetter) {
  const rows = store.rowsFor(course.id);
  const wrap = el('details', 'breakdown');
  const sum = el('summary', null,
    rows.length ? `Marks (${assess.totals(rows).score}/100)` : 'Marks');
  wrap.appendChild(sum);

  const list = el('div', 'rows');
  rows.forEach((r, i) => {
    const line = el('div', 'arow');
    const label = el('input', 'a-label');
    label.value = r.label || '';
    label.placeholder = 'Label';
    const score = el('input', 'a-num');
    score.type = 'number'; score.value = r.score ?? ''; score.placeholder = 'got';
    const max = el('input', 'a-num');
    max.type = 'number'; max.value = r.max ?? ''; max.placeholder = 'of';
    const del = el('button', 'a-del', '\u00d7');

    const save = () => {
      const next = store.rowsFor(course.id).slice();
      next[i] = { label: label.value, score: score.value, max: max.value };
      store.setRows(course.id, next);
      renderPlan();
    };
    label.addEventListener('change', save);
    score.addEventListener('change', save);
    max.addEventListener('change', save);
    del.addEventListener('click', () => {
      const next = store.rowsFor(course.id).slice();
      next.splice(i, 1);
      store.setRows(course.id, next);
      renderPlan();
    });

    line.append(label, score, el('span', 'a-sep', '/'), max, del);
    list.appendChild(line);
  });
  wrap.appendChild(list);

  const add = el('div', 'a-add');
  for (const preset of [...assess.PRESETS, '']) {
    const b = el('button', 'a-chip', '+ ' + (preset || 'Other'));
    b.addEventListener('click', () => {
      store.setRows(course.id, [...store.rowsFor(course.id), { label: preset, score: '', max: '' }]);
      renderPlan();
    });
    add.appendChild(b);
  }
  wrap.appendChild(add);

  const t = assess.totals(rows);
  if (t.any) {
    const done = assess.resolvedLetter(rows, state.scale);
    if (done) {
      wrap.appendChild(el('p', 'a-total', `Total ${t.score}/100 \u2192 ${done}`));
      const apply = el('button', 'a-apply', 'Use as my grade');
      apply.addEventListener('click', () => { store.setGrade(course.id, done); renderPlan(); });
      wrap.appendChild(apply);
    } else {
      wrap.appendChild(el('p', 'a-total',
        `So far ${t.score}/100 \u2014 ${t.remaining} left for the final`));
      const ul = el('ul', 'a-proj');
      for (const p of assess.projections(rows, state.scale)) {
        const text = p.status === 'needs' ? `need ${p.needed}/${p.outOf}`
          : p.status === 'secured' ? 'secured' : 'not reachable';
        ul.appendChild(el('li', null, `${p.letter}: ${text}`));
      }
      wrap.appendChild(ul);

      const rev = assess.finalExamRange(rows, state.scale, currentLetter);
      if (rev) {
        wrap.appendChild(el('p', 'a-rev',
          `With grade ${currentLetter}, your final was between ` +
          `${rev.low}/${rev.outOf} and ${rev.high}/${rev.outOf}.`));
      }
    }
  }
  return wrap;
}

$('#home').addEventListener('click', showUniversities);
showUniversities();
