import { api, ApiError } from './api.js';
import { store } from './store.js';
import { isAvailable, missingFor, summarise } from './prerequisites.js';
import { makeScale, computeGpa, earnedCredits, formatGpa } from './gpa.js';
import * as assess from './assessment.js';
import { i18n } from './i18n.js';
import * as ach from './achievements.js';
import * as edit from './editmode.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;   // textContent, never innerHTML:
  return n;                                  // every string here is server data
};

const state = { universities: [], majors: [], courses: [], rawCourses: [], major: null, scale: null, editing: false, linksOpen: false };

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
    state.rawCourses = await api.courses(major.id);
    state.editing = false;
    $('#crumb').textContent =
      `${i18n.t.universities} / ${i18n.name(uni)} / ${i18n.name(major)}`;
    $('#list').hidden = true;
    $('#plan').hidden = false;
    renderPlan();
  });
}

function renderPlan() {
  const majorId = state.major.id;
  // Recomputed on every render (not cached in showPlan) so a move, a
  // prerequisite-line edit, or a reset made a moment ago is always reflected —
  // this overlay is applied on top of the API data, never sent back to it.
  state.courses = edit.applyEdits(state.rawCourses, majorId);

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

  const editRow = el('div', 'edit-toggle-row');
  const editBtn = el('button', 'edit-toggle',
    state.editing ? i18n.t.edit.toggleOff : i18n.t.edit.toggleOn);
  editBtn.addEventListener('click', () => { state.editing = !state.editing; renderPlan(); });
  editRow.appendChild(editBtn);
  if (state.editing && edit.hasAny(majorId)) {
    const resetBtn = el('button', 'edit-toggle', i18n.t.edit.resetAll);
    resetBtn.addEventListener('click', () => {
      if (confirm(i18n.t.edit.resetAllConfirm)) { edit.resetAll(majorId); renderPlan(); }
    });
    editRow.appendChild(resetBtn);
  }
  head.appendChild(editRow);

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

  // A student-added year/summer is a real part of the plan once added — shown
  // whether editing or not — so it needs an (initially empty) section to
  // render into, exactly like a section that happens to have no courses yet.
  const base = Math.max(0, ...state.rawCourses.map((c) => c.year || 0));
  const struct = edit.structureFor(majorId);
  for (let i = 1; i <= struct.extraYears; i++) {
    const y = base + i;
    if (!groups.has(`${y}-1`)) groups.set(`${y}-1`, []);
    if (!groups.has(`${y}-2`)) groups.set(`${y}-2`, []);
  }
  for (const y of struct.summers) {
    if (!groups.has(`${y}-3`)) groups.set(`${y}-3`, []);
  }

  renderAchievements(records);

  const grid = $('#grid');
  grid.replaceChildren();
  const keys = [...groups.keys()].sort((a, b) => {
    const [ay, as] = a.split('-').map(Number), [by, bs] = b.split('-').map(Number);
    return ay - by || as - bs;
  });
  const slots = keys.map((k) => {
    const [y, sem] = k.split('-').map(Number);
    return { key: k, year: y, semester: sem, label: `${i18n.t.year(y)} — ${i18n.t.sem[sem] || i18n.t.semN(sem)}` };
  });
  const cardOpts = { editing: state.editing, majorId, slots };
  for (const k of keys) {
    const [y, sem] = k.split('-').map(Number);
    grid.appendChild(sectionFor(
      `${i18n.t.year(y)} — ${i18n.t.sem[sem] || i18n.t.semN(sem)}`, groups.get(k), done, cardOpts));
  }
  if (pool.length) grid.appendChild(sectionFor(i18n.t.electivePool, pool, done, cardOpts));

  if (state.editing) {
    grid.appendChild(renderStructureControls(majorId, base, struct));
    grid.appendChild(renderLinesPanel(majorId, state.courses));
  }
}

function sectionFor(title, courses, done, opts) {
  const sec = el('section', 'sem');
  sec.appendChild(el('h3', null, title));
  const row = el('div', 'row');
  for (const c of courses) row.appendChild(courseCard(c, done, opts));
  sec.appendChild(row);
  return sec;
}

function courseCard(c, done, opts) {
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

  // Moving is only meaningful for a course that actually has a position —
  // an elective-pool placeholder has nowhere to move from.
  if (opts?.editing && c.year != null && c.semester != null) {
    const label = el('label', 'move-label', i18n.t.edit.moveTo);
    const sel = el('select', 'move-select');
    for (const s of opts.slots) {
      const o = el('option', null, s.label);
      o.value = s.key;
      sel.appendChild(o);
    }
    sel.value = `${c.year}-${c.semester}`;
    sel.addEventListener('change', () => {
      const [y, sem] = sel.value.split('-').map(Number);
      handleMove(c, y, sem, opts.majorId);
    });
    label.appendChild(sel);
    card.appendChild(label);
  }
  return card;
}

// ---------- edit mode ----------
// A student-owned overlay of corrections, applied on top of the fetched plan
// and never sent back to the API — the same "your device, reversible, never
// touches the shared plan" idea app/plan.html's edit mode used, just against
// live database courses instead of static HTML.
function handleMove(course, year, semester, majorId) {
  const check = edit.validateMove(state.courses, course.id, year, semester, majorId);
  const rtl = i18n.isRtl;
  if (check.ok) {
    edit.moveCourse(majorId, course.id, year, semester);
    renderPlan();
    return;
  }
  const msg = rtl ? check.reason.ar : check.reason.en;
  if (check.hard) {
    alert('🚫 ' + msg);
    renderPlan();   // snaps the select back to the course's real position
    return;
  }
  // Soft conflict: only ever the "retaking a prerequisite alongside its
  // dependent" case. Confirming records the pair as an intentional exception
  // so the same move doesn't ask again next time.
  if (confirm('⚠️ ' + msg + '\n\n' + i18n.t.edit.syncQuestion)) {
    edit.markSynced(majorId, check.syncReq, check.syncDep);
    edit.moveCourse(majorId, course.id, year, semester);
  }
  renderPlan();
}

function renderStructureControls(majorId, base, struct) {
  const box = el('div', 'edit-panel');
  const totalYears = base + struct.extraYears;
  for (let y = 1; y <= totalYears; y++) {
    const hasSummer = state.courses.some((c) => c.year === y && c.semester === 3)
      || struct.summers.includes(y);
    const isUserYear = y > base;
    const row = el('div', 'edit-panel-row');
    row.appendChild(el('span', 'edit-panel-label', i18n.t.year(y)));
    if (hasSummer) {
      // An official summer semester (already in the fetched plan) isn't the
      // student's to remove — only one they themselves added.
      if (struct.summers.includes(y)) {
        const btn = el('button', 'edit-btn', i18n.t.edit.removeSummer);
        btn.addEventListener('click', () => handleRemoveSummer(majorId, y));
        row.appendChild(btn);
      }
    } else {
      const btn = el('button', 'edit-btn', i18n.t.edit.addSummer);
      btn.addEventListener('click', () => { edit.addSummer(majorId, y); renderPlan(); });
      row.appendChild(btn);
    }
    if (isUserYear) {
      const btn = el('button', 'edit-btn', i18n.t.edit.removeYear);
      btn.addEventListener('click', () => handleRemoveYear(majorId, y, base, struct));
      row.appendChild(btn);
    }
    box.appendChild(row);
  }
  const addBtn = el('button', 'edit-btn', i18n.t.edit.addYear);
  addBtn.addEventListener('click', () => { edit.addYear(majorId); renderPlan(); });
  box.appendChild(addBtn);
  if (struct.extraYears || struct.summers.length) {
    box.appendChild(el('p', 'edit-panel-note', i18n.t.edit.structureNote));
  }
  return box;
}

function handleRemoveSummer(majorId, year) {
  if (state.courses.some((c) => c.year === year && c.semester === 3)) {
    alert('🚫 ' + i18n.t.edit.summerHasCourses);
    return;
  }
  edit.removeSummer(majorId, year);
  renderPlan();
}

function handleRemoveYear(majorId, year, base, struct) {
  if (state.courses.some((c) => c.year === year)) {
    alert('🚫 ' + i18n.t.edit.yearHasCourses);
    return;
  }
  // Only the LAST added year can go, so remaining year numbers stay
  // contiguous with the official ones.
  if (year !== base + struct.extraYears) {
    alert('🚫 ' + i18n.t.edit.onlyLastYear);
    return;
  }
  edit.removeYear(majorId);
  renderPlan();
}

// The plans are transcribed by hand from official PDFs, so a line can be
// missed or read wrong. This lets a student correct that themselves, without
// waiting for the shared database to be fixed for everyone.
function renderLinesPanel(majorId, courses) {
  const box = el('details', 'links-box');
  // A full re-render follows every add/remove here, same as the assessment
  // breakdown; without this it would visibly snap shut after each edit.
  box.open = state.linksOpen;
  box.addEventListener('toggle', () => { state.linksOpen = box.open; });
  box.appendChild(el('summary', null, i18n.t.edit.lines));
  box.appendChild(el('p', 'edit-panel-note', i18n.t.edit.linesNote));

  const byId = new Map(courses.map((c) => [c.id, c]));
  const sorted = [...courses].sort((a, b) => i18n.name(a).localeCompare(i18n.name(b)));
  const optionLabel = (c) => i18n.name(c) + (c.code ? ` (${c.code})` : '');

  const addRow = el('div', 'links-add-row');
  const fromSel = el('select');
  const toSel = el('select');
  for (const sel of [fromSel, toSel]) {
    const blank = el('option', null, i18n.t.edit.pick);
    blank.value = '';
    sel.appendChild(blank);
    for (const c of sorted) {
      const o = el('option', null, optionLabel(c));
      o.value = c.id;
      sel.appendChild(o);
    }
  }
  const addBtn = el('button', 'edit-btn', i18n.t.edit.addLine);
  addBtn.addEventListener('click', () => handleAddLine(majorId, fromSel.value, toSel.value, courses));
  addRow.append(fromSel, el('span', 'links-arrow', '→'), toSel, addBtn);
  box.appendChild(addRow);

  const lines = [];
  for (const c of courses) {
    for (const g of c.prerequisites || []) {
      for (const o of g.anyOf) lines.push([o.id, c.id]);
    }
  }
  lines.sort((p, q) => {
    const pc = byId.get(p[1]), qc = byId.get(q[1]);
    return (pc ? i18n.name(pc) : '').localeCompare(qc ? i18n.name(qc) : '');
  });

  const listHead = el('div', 'links-list-head');
  listHead.appendChild(el('span', null, i18n.t.edit.currentLines(lines.length)));
  const added = edit.addedPrereqs(majorId), removed = edit.removedPrereqs(majorId);
  if (added.length || removed.length) {
    const resetBtn = el('button', 'edit-btn', i18n.t.edit.resetLines);
    resetBtn.addEventListener('click', () => { edit.resetLines(majorId); renderPlan(); });
    listHead.appendChild(resetBtn);
  }
  box.appendChild(listHead);

  const list = el('div', 'links-list');
  if (!lines.length) list.appendChild(el('p', 'empty', i18n.t.edit.noLines));
  const addedKeys = new Set(added.map(([f, t]) => `${f}__${t}`));
  for (const [f, t] of lines) {
    const fromC = byId.get(f), toC = byId.get(t);
    if (!fromC || !toC) continue;
    const item = el('div', 'line-item');
    item.appendChild(el('span', 'line-text', `${i18n.name(fromC)} → ${i18n.name(toC)}`));
    if (addedKeys.has(`${f}__${t}`)) item.appendChild(el('span', 'line-badge', i18n.t.edit.addedByYou));
    const del = el('button', 'a-del', '×');
    del.addEventListener('click', () => { edit.removeLine(majorId, f, t); renderPlan(); });
    item.appendChild(del);
    list.appendChild(item);
  }
  box.appendChild(list);
  return box;
}

function handleAddLine(majorId, fromId, toId, courses) {
  if (!fromId || !toId) { alert('🚫 ' + i18n.t.edit.pickBothFirst); return; }
  if (fromId === toId) { alert('🚫 ' + i18n.t.edit.selfPrereq); return; }
  const byId = new Map(courses.map((c) => [c.id, c]));
  const to = byId.get(toId);
  if (to && to.prerequisites.some((g) => g.anyOf.some((o) => o.id === fromId))) {
    alert('🚫 ' + i18n.t.edit.lineExists);
    return;
  }
  if (edit.wouldCycle(courses, fromId, toId)) { alert('🚫 ' + i18n.t.edit.wouldCycle); return; }
  edit.addLine(majorId, fromId, toId);
  renderPlan();
}

// ---------- achievements ----------
// Collapsed by default: a student opening their plan wants the plan, not a
// trophy cabinet. The header count is enough to draw them in.
function renderAchievements(records) {
  const list = ach.compute(state.courses, records, state.scale, i18n.t);
  const { unlocked, total } = ach.summary(list);

  const host = $('#achievements');
  host.replaceChildren();
  const box = el('details', 'ach-box');
  const sum = el('summary', null,
    `${i18n.t.achievements} — ${i18n.t.achCount(unlocked, total)}`);
  box.appendChild(sum);

  const wrap = el('div', 'ach-grid');
  // Unlocked first, then the closest to completion — so the next realistic
  // goal is visible rather than buried among ones barely started.
  const ordered = [...list].sort((a, b) =>
    (b.done - a.done) || (b.progress - a.progress));
  for (const a of ordered) {
    const card = el('div', 'ach' + (a.done ? ' unlocked' : ''));
    card.appendChild(el('span', 'ach-icon', a.icon));
    const body = el('div', 'ach-body');
    body.appendChild(el('div', 'ach-title', a.title));
    const barTrack = el('div', 'ach-bar');
    const barFill = el('div', 'ach-bar-fill');
    barFill.style.width = `${Math.round(a.progress * 100)}%`;
    barTrack.appendChild(barFill);
    body.appendChild(barTrack);
    body.appendChild(el('div', 'ach-detail', a.detail));
    card.appendChild(body);
    wrap.appendChild(card);
  }
  box.appendChild(wrap);
  host.appendChild(box);
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
