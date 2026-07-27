// Language and direction.
//
// Arabic is not a translation layer bolted onto an English app here — most of
// this app's students read Arabic first, and the curriculum data itself is
// bilingual (every course carries nameAr from the database). So the language
// choice drives BOTH the interface strings and which name each course shows.
//
// Strings live here rather than in markup so a third language is one object,
// not a hunt through the rendering code.
const KEY = 'studyplan.lang.v1';

function arCount(n, one, two, few, many) {
  if (n === 0) return `لا ${few}`;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

const STRINGS = {
  en: {
    brand: 'StudyPlan',
    universities: 'Universities',
    loading: 'Loading…',
    noMajors: 'No majors published for this university yet.',
    majorCount: (n) => `${n} major${n === 1 ? '' : 's'}`,
    courseCount: (n) => `${n} course${n === 1 ? '' : 's'}`,
    summary: (d, t, e, tc, p, a) =>
      `${d}/${t} courses · ${e}/${tc} credit hours earned · ${p}% · ${a} available now`,
    gpa: (v) => `GPA ${v}`,
    year: (n) => `Year ${n}`,
    sem: { 1: 'First semester', 2: 'Second semester', 3: 'Summer' },
    semN: (n) => `Semester ${n}`,
    electivePool: 'Elective pool',
    markComplete: 'Mark complete',
    completed: '✓ Completed',
    needs: 'Needs: ',
    or: ' or ',
    and: ' + ',
    gradeBlank: 'grade —',
    marks: 'Marks',
    marksWith: (score) => `Marks (${score}/100)`,
    soFar: (score, left) => `So far ${score}/100 — ${left} left for the final`,
    totalIs: (score, letter) => `Total ${score}/100 → ${letter}`,
    useAsGrade: 'Use as my grade',
    need: (n, of) => `need ${n}/${of}`,
    secured: 'secured',
    unreachable: 'not reachable',
    finalRange: (letter, lo, hi, of) =>
      `With grade ${letter}, your final was between ${lo}/${of} and ${hi}/${of}.`,
    presets: { 'Mid Term': 'Mid Term', Lab: 'Lab', Quiz: 'Quiz', Assignment: 'Assignment', '': 'Other' },
    label: 'Label', got: 'got', outOf: 'of',
    langButton: 'العربية',
    netError: 'Could not reach the server. Check your connection.',
    genericError: 'Something went wrong.',
    achievements: 'Achievements',
    achCount: (u, t) => `${u} of ${t} unlocked`,
    categories: {
      CORE: 'Core', MATH: 'Math', DEPARTMENT_ELECTIVE: 'Department electives',
      UNIVERSITY_ELECTIVE: 'University electives', FREE_ELECTIVE: 'Free electives',
      UNIVERSITY_REQUIREMENT: 'University requirements', ENGLISH: 'English',
    },
    ach: {
      firstCourse: 'First course passed',
      creditShare: (p) => `${p}% of credit hours`,
      allSemesters: 'Every semester complete',
      allYears: 'Every year complete',
      category: (name) => `All ${name} complete`,
      gpaAtLeast: (v) => `GPA ${v} or above`,
      topGrades: (letter, n) => `${n} courses at ${letter}`,
    },
  },
  ar: {
    brand: 'خطتي الدراسية',
    universities: 'الجامعات',
    loading: 'جارٍ التحميل…',
    noMajors: 'لا توجد تخصصات منشورة لهذه الجامعة بعد.',
    // Arabic counts inflect by number: 1, 2, 3-10, and 11+ each differ, so a
    // bare `${n} تخصص` is wrong for most values a student will actually see.
    majorCount: (n) => arCount(n, 'تخصص', 'تخصصان', 'تخصصات', 'تخصصًا'),
    courseCount: (n) => arCount(n, 'مساق', 'مساقان', 'مساقات', 'مساقًا'),
    summary: (d, t, e, tc, p, a) =>
      `${d}/${t} مساق · ${e}/${tc} ساعة معتمدة · ${p}٪ · ${a} متاح الآن`,
    gpa: (v) => `المعدل ${v}`,
    year: (n) => `السنة ${n}`,
    sem: { 1: 'الفصل الأول', 2: 'الفصل الثاني', 3: 'الفصل الصيفي' },
    semN: (n) => `الفصل ${n}`,
    electivePool: 'المواد الاختيارية',
    markComplete: 'تحديد كمكتمل',
    completed: '✓ مكتمل',
    needs: 'يحتاج: ',
    or: ' أو ',
    and: ' + ',
    gradeBlank: 'العلامة —',
    marks: 'العلامات',
    marksWith: (score) => `العلامات (${score}/100)`,
    soFar: (score, left) => `حتى الآن ${score}/100 — تبقّى ${left} للنهائي`,
    totalIs: (score, letter) => `المجموع ${score}/100 ← ${letter}`,
    useAsGrade: 'استخدمها كعلامتي',
    need: (n, of) => `تحتاج ${n}/${of}`,
    secured: 'مضمونة',
    unreachable: 'غير ممكنة',
    finalRange: (letter, lo, hi, of) =>
      `بعلامة ${letter}، كان امتحانك النهائي بين ${lo}/${of} و ${hi}/${of}.`,
    presets: { 'Mid Term': 'نصفي', Lab: 'مختبر', Quiz: 'كويز', Assignment: 'واجب', '': 'أخرى' },
    label: 'الاسم', got: 'علامتك', outOf: 'من',
    langButton: 'English',
    netError: 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك.',
    genericError: 'حدث خطأ ما.',
    achievements: 'الإنجازات',
    achCount: (u, t) => `${u} من ${t}`,
    categories: {
      CORE: 'متطلبات التخصص', MATH: 'الرياضيات',
      DEPARTMENT_ELECTIVE: 'اختياري التخصص', UNIVERSITY_ELECTIVE: 'اختياري جامعي',
      FREE_ELECTIVE: 'اختياري حر', UNIVERSITY_REQUIREMENT: 'متطلبات الجامعة',
      ENGLISH: 'اللغة الإنجليزية',
    },
    ach: {
      firstCourse: 'أول مساق ناجح',
      creditShare: (p) => `${p}٪ من الساعات المعتمدة`,
      allSemesters: 'إتمام كل الفصول',
      allYears: 'إتمام كل السنوات',
      category: (name) => `إتمام ${name}`,
      gpaAtLeast: (v) => `معدل ${v} فأعلى`,
      topGrades: (letter, n) => `${n} مساقات بعلامة ${letter}`,
    },
  },
};

let current = (() => {
  try { return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; }
  catch { return 'en'; }
})();

export const i18n = {
  get lang() { return current; },
  get isRtl() { return current === 'ar'; },
  get t() { return STRINGS[current]; },

  set(lang) {
    current = lang === 'ar' ? 'ar' : 'en';
    try { localStorage.setItem(KEY, current); } catch { /* private mode */ }
    this.applyDocument();
  },
  toggle() { this.set(current === 'ar' ? 'en' : 'ar'); },

  // dir on <html> is what makes the browser mirror the whole layout, so the
  // CSS only needs logical properties rather than a parallel RTL stylesheet.
  applyDocument() {
    document.documentElement.lang = current;
    document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
  },

  // Course and major names are bilingual in the database. Falling back to the
  // English name when no Arabic one exists is deliberate: showing a slug or an
  // empty card would be worse than showing the name that does exist.
  name(entity) {
    if (current === 'ar' && entity?.nameAr) return entity.nameAr;
    return entity?.name ?? '';
  },
};

i18n.applyDocument();
