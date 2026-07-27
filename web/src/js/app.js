import { api, ApiError } from './api.js';
import { store } from './store.js';
import { isAvailable, missingFor, summarise } from './prerequisites.js';
import { makeScale, computeGpa, earnedCredits, formatGpa } from './gpa.js';
import * as assess from './assessment.js';
import { i18n } from './i18n.js';

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
    setStatus(i18n.t.loading);
    await fn();
    setStatus('');
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : i18n.t.genericError;
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
    $('#crumb').textContent = i18n.t.universities;
    $('#plan').hidden = true;
    list.hidden = false;

    for (const u of state.universities) {
      const card = el('button', 'card');
      card.appendChild(el('div', 'card-title', i18n.name(u)));
      // The other language's name as a subtitle — useful when a student knows
      // the institution by only one of them.
      const alt = i18n.isRtl ? u.name : u.nameAr;
      if (alt && alt !== i18n.name(u)) card.appendChild(el('div', 'card-sub', alt));
      card.appendChild(el('div', 'card-meta', i18n.t.majorCount(u._count.majors)));
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
    $('#crumb').textContent = `${i18n.t.universities} / ${i18n.name(uni)}`;

    if (!state.majors.length) {
      list.appendChild(el('p', 'empty', i18n.t.noMajors));
      return;
    }
    for (const m of state.majors) {
      const card = el('button', 'card');
      card.appendChild(el('div', 'card-title', i18n.name(m)));
      const altM = i18n.isRtl ? m.name : m.nameAr;
      if (altM && altM !== i18n.name(m)) card.appendChild(el('div', 'card-sub', altM));
      card.appendChild(el('div', 'card-meta', i18n.t.courseCount(m._count.courses)));
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
    $('#crumb').textContent =
      `${i18n.t.universities} / ${i18n.name(uni)} / ${i18n.name(major)}`;
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
  head.appendChild(el('h2', null, i18n.name(state.major)));
  head.appendChild(el('p', 'summary', i18n.t.summary(
    s.done, s.total, earned, s.totalCredits, s.percent, s.available)));
  head.appendChild(el('p', 'summary gpa',
    i18n.t.gpa(formatGpa(gpa)) + (state.scale ? `  ·  ${state.scale.name}` : '')));
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
  for (const k of keys) {
    const [y, sem] = k.split('-').map(Number);
    grid.appendChild(sectionFor(
      `${i18n.t.year(y)} — ${i18n.t.sem[sem] || i18n.t.semN(sem)}`, groups.get(k), done));
  }
  if (pool.length) grid.appendChild(sectionFor(i18n.t.electivePool, pool, done));
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

  card.appendChild(el('div', 'course-name', i18n.name(c)));
  const meta = el('div', 'course-meta');
  if (c.code) meta.appendChild(el('span', 'code', c.code));
  meta.appendChild(el('span', 'cr', `${c.credits}H`));
  card.appendChild(meta);

  if (!isDone && !avail) {
    const blocked = missingFor(c, done);
    const note = el('div', 'blocked');
    note.textContent = i18n.t.needs + blocked
      .map((g) => g.anyOf.map((o) => i18n.name(o)).join(i18n.t.or))
      .join(i18n.t.and);
    card.appendChild(note);
  }

  const btn = el('button', 'tick', isDone ? i18n.t.completed : i18n.t.markComplete);
  btn.addEventListener('click', () => {
    store.toggle(c.id);
    renderPlan();   // availability cascades, so the whole plan re-renders
  });
  card.appendChild(btn);

  // Grades only make sense once a course is done, and the options come from
  // the major's own scale rather than a fixed list in this file.
  if (isDone && state.scale) {
    const sel = el('select', 'grade');
    const blank = el('option', null, i18n.t.gradeBlank);
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
    rows.length ? i18n.t.marksWith(assess.totals(rows).score) : i18n.t.marks);
  wrap.appendChild(sum);

  const list = el('div', 'rows');
  rows.forEach((r, i) => {
    const line = el('div', 'arow');
    const label = el('input', 'a-label');
    label.value = r.label || '';
    label.placeholder = i18n.t.label;
    const score = el('input', 'a-num');
    score.type = 'number'; score.value = r.score ?? ''; score.placeholder = i18n.t.got;
    const max = el('input', 'a-num');
    max.type = 'number'; max.value = r.max ?? ''; max.placeholder = i18n.t.outOf;
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
    const b = el('button', 'a-chip', '+ ' + (i18n.t.presets[preset] ?? preset));
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
      wrap.appendChild(el('p', 'a-total', i18n.t.totalIs(t.score, done)));
      const apply = el('button', 'a-apply', i18n.t.useAsGrade);
      apply.addEventListener('click', () => { store.setGrade(course.id, done); renderPlan(); });
      wrap.appendChild(apply);
    } else {
      wrap.appendChild(el('p', 'a-total', i18n.t.soFar(t.score, t.remaining)));
      const ul = el('ul', 'a-proj');
      for (const p of assess.projections(rows, state.scale)) {
        const text = p.status === 'needs' ? i18n.t.need(p.needed, p.outOf)
          : p.status === 'secured' ? i18n.t.secured : i18n.t.unreachable;
        ul.appendChild(el('li', null, `${p.letter}: ${text}`));
      }
      wrap.appendChild(ul);

      const rev = assess.finalExamRange(rows, state.scale, currentLetter);
      if (rev) {
        wrap.appendChild(el('p', 'a-rev',
          i18n.t.finalRange(currentLetter, rev.low, rev.high, rev.outOf)));
      }
    }
  }
  return wrap;
}

// Re-render in place on a language switch rather than reloading, so the
// student stays exactly where they were in the plan.
function applyLang() {
  $('#brandText').textContent = i18n.t.brand;
  $('#lang').textContent = i18n.t.langButton;
}

$('#home').addEventListener('click', showUniversities);
$('#lang').addEventListener('click', () => {
  i18n.toggle();
  applyLang();
  if (!$('#plan').hidden) renderPlan();
  else if (state.majors.length && $('#crumb').textContent.includes('/')) showUniversities();
  else showUniversities();
});

applyLang();
showUniversities();
