// ==========================
// LOADING
//
// The wait is part of the product. Not a spinner: the identity, a line that
// says what is happening in the student's own language, and a progress rule
// that fills as the real stages complete — sky, materials, ground,
// architecture, lighting — so the bar is telling the truth rather than
// animating on a timer.
//
// It is DOM, deliberately: it has to be on screen before a single line of
// WebGL has run, and it has to survive the case where WebGL never runs at
// all.
// ==========================
const TX = {
  en: {
    line: 'Preparing your academic environment',
    stages: ['Sky', 'Materials', 'Ground', 'Architecture', 'Lighting'],
    ready: 'Ready'
  },
  ar: {
    line: 'جارٍ تحضير بيئتك الأكاديمية',
    stages: ['السماء', 'المواد', 'الأرض', 'المباني', 'الإضاءة'],
    ready: 'جاهز'
  }
};

export class LoadingManager {
  constructor(host, lang = 'en') {
    this.lang = TX[lang] ? lang : 'en';
    this.total = 5;
    this.done = 0;
    this.host = host;
    this._build();
  }

  _build() {
    const t = TX[this.lang];
    const el = document.createElement('div');
    el.className = 'scene-loading';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    el.innerHTML =
      '<div class="scene-loading-inner">' +
        '<div class="scene-loading-mark" aria-hidden="true">' +
          '<span></span><span></span><span></span>' +
        '</div>' +
        '<div class="scene-loading-name">AAUPATH</div>' +
        '<div class="scene-loading-ar" lang="ar" dir="rtl">طريقك</div>' +
        '<div class="scene-loading-line"></div>' +
        '<div class="scene-loading-bar"><i></i></div>' +
        '<div class="scene-loading-stage"></div>' +
      '</div>';
    el.querySelector('.scene-loading-line').textContent = t.line;
    this.el = el;
    this.bar = el.querySelector('.scene-loading-bar i');
    this.stageEl = el.querySelector('.scene-loading-stage');
    this.host.appendChild(el);
  }

  // Called as each real stage finishes. Yields to the browser between them
  // so the bar actually paints — a progress bar that jumps from 0 to 100 in
  // one frame is worse than none.
  step(name) {
    this.done = Math.min(this.total, this.done + 1);
    const t = TX[this.lang];
    const pct = Math.round(this.done / this.total * 100);
    if (this.bar) this.bar.style.width = pct + '%';
    if (this.stageEl) this.stageEl.textContent = name || t.stages[this.done - 1] || '';
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // The scene is up. The loading screen does not vanish — it lifts and
  // dissolves, and the first thing under it is already moving.
  finish() {
    const t = TX[this.lang];
    if (this.bar) this.bar.style.width = '100%';
    if (this.stageEl) this.stageEl.textContent = t.ready;
    if (!this.el) return;
    this.el.classList.add('is-done');
    const el = this.el;
    this.el = null;
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }

  fail() {
    if (this.el) { this.el.classList.add('is-done'); }
    this.finish();
  }
}
