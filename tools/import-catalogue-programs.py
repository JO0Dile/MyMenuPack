#!/usr/bin/env python3
"""Turn the imported AAUP catalogue into study plans the app can ship.

    python3 tools/import-catalogue-programs.py            # report only
    python3 tools/import-catalogue-programs.py --write     # write data/aaup/majors/

Reads tools/catalogue-import/catalogue.json (the document's 68 programs) and
tools/catalogue-import/from-images/*.json (the seven Junior College diplomas
that exist only as screenshots), and writes one major per program that the app
does not already ship. Programs the app already has are listed in ALREADY and
are never regenerated over - those were authored and reviewed by hand.

Everything a plan asserts comes from the document: the course list, the credit
hours, the prerequisites, the requirement buckets and how many hours each
bucket needs. The one thing generated is WHEN to take a course, and only where
the university published no Advisory Plan - see schedule.py's docstring, and
the note that goes into every such plan's bio.
"""
import argparse
import collections
import glob
import json
import os
import re
import sys
import unicodedata

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAJORS = os.path.join(REPO, 'data/aaup/majors')
CAT = os.path.join(REPO, 'tools/catalogue-import/catalogue.json')
IMGS = os.path.join(REPO, 'tools/catalogue-import/from-images/*.json')


def slugify(s):
    s = unicodedata.normalize('NFKD', s)
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return re.sub(r'-+', '-', s)


def load():
    """Every program that has course data, from both sources."""
    out = []
    for f in json.load(open(CAT, encoding='utf-8')):
        for p in f['programs']:
            if not p['requirements']:
                continue
            out.append({'faculty': f['faculty'], 'name': p['name'],
                        'degreeHours': p.get('degreeHours'),
                        'requirements': p['requirements'],
                        'advisoryPlan': p.get('advisoryPlan'),
                        'overview': p.get('overview'),
                        'sourceIssues': p.get('sourceIssues'),
                        'origin': 'text'})
    for path in sorted(glob.glob(IMGS)):
        d = json.load(open(path, encoding='utf-8'))
        if 'requirements' not in d:
            continue
        out.append({'faculty': d['faculty'], 'name': d['name'],
                    'degreeHours': d.get('degreeHours'),
                    'requirements': d['requirements'],
                    'advisoryPlan': d.get('advisoryPlan'),
                    'overview': d.get('overview'),
                    'meta': d, 'origin': 'images'})
    return out


# --------------------------------------------------------------------------
# Placing courses in terms
# --------------------------------------------------------------------------
MIN_TERM = 15        # a term should not be left emptier than this while work remains
SLACK   = 0          # how far above the even split a term may go


def terms_for(years, has_summer=False):
    out = []
    for y in range(1, years + 1):
        out.append((y, 1))
        out.append((y, 2))
        if has_summer:
            out.append((y, 3))
    return out


def sequence(courses, years):
    """courses: [{id, credits, prerequisites:[ids]}] -> {id: (year, semester)}

    Longest-path layering first (a course sits no earlier than one term after
    everything it needs), then terms are filled in that order up to a credit
    target. A course whose prerequisites are not in this plan is treated as
    having none - the document names prerequisites by code, and a code it does
    not also list is simply not something this plan can schedule around.
    """
    by_id = {c['id']: c for c in courses}
    needs = {c['id']: [p for p in c.get('prerequisites', []) if p in by_id] for c in courses}

    # depth = longest prerequisite chain ending at this course
    depth = {}
    def depth_of(cid, stack=()):
        if cid in depth:
            return depth[cid]
        if cid in stack:            # a cycle in the source; break it rather than hang
            return 0
        d = 0
        for p in needs[cid]:
            d = max(d, depth_of(p, stack + (cid,)) + 1)
        depth[cid] = d
        return d
    for c in courses:
        depth_of(c['id'])

    # A course at depth N cannot start before term N, so a prerequisite chain
    # longer than the degree has semesters forces everything deep into the last
    # term. Bachelor in English Language chains nine levels deep across eight
    # semesters, and thirty-nine credit hours landed in the final one. Open the
    # summer terms (which AAUP runs) when the chain needs them, rather than
    # producing a sequence that is prerequisite-valid on paper and unusable.
    deepest = max(depth.values()) if depth else 0
    slots = terms_for(years, has_summer=False)
    if deepest >= len(slots):
        slots = terms_for(years, has_summer=True)
    # The cap is derived from the plan, not fixed. A 142-hour degree over eight
    # terms needs 17.75 hours a term; a fixed 17 closes every term one course
    # early and the overflow all lands in the final term, which is how forty
    # courses ended up in Year 4 Semester 2. Spread the real load evenly and
    # allow a few hours of slack on top.
    total = sum(float(c.get('credits') or 0) for c in courses)
    cap = max(MIN_TERM, total / max(1, len(slots)) + SLACK)

    # Order: by prerequisite depth, then heavier courses first so a term fills
    # evenly instead of trailing a 1-hour lab into the next one.
    order = sorted(courses, key=lambda c: (depth[c['id']], -float(c.get('credits') or 0), c['id']))

    placed = {}
    load = collections.defaultdict(float)
    term_index = {}
    for c in order:
        cid = c['id']
        cr = float(c.get('credits') or 0)
        earliest = 0
        for p in needs[cid]:
            if p in term_index:
                earliest = max(earliest, term_index[p] + 1)
        i = earliest
        while i < len(slots) and load[i] + cr > cap:
            i += 1
        if i >= len(slots):
            # Every term from `earliest` on is at cap. Use the emptiest one
            # that still respects prerequisites rather than dropping the course
            # or piling it all onto the last term.
            candidates = list(range(min(earliest, len(slots) - 1), len(slots)))
            i = min(candidates, key=lambda j: load[j])
        load[i] += cr
        term_index[cid] = i
        placed[cid] = slots[i]
    return placed


# --------------------------------------------------------------------------
# Building the majors
# --------------------------------------------------------------------------
# Faculties the app already has, plus the ones this adds. Arabic names and
# icons are authored here because the document carries neither.
FACULTIES = {
 'Junior College':                                     ('aaup-junior-college', 'كلية المجتمع', '🎓'),
 'Faculty of Allied Medical Sciences':                 ('aaup-allied-medical', 'كلية العلوم الطبية المساندة', '🩻'),
 'Faculty of Architecture and Art':                    ('aaup-architecture-art', 'كلية العمارة والفنون', '🏛'),
 'Faculty of Artificial Intelligence and Data Science':('aaup-ai-ds', 'كلية الذكاء الاصطناعي وعلوم البيانات', '🤖'),
 'Faculty of Digital Sciences':                        ('aaup-digital-sciences', 'كلية العلوم الرقمية', '🌐'),
 'Faculty of Arts and Education':                      ('aaup-arts-education', 'كلية الآداب والعلوم التربوية', '📖'),
 'Faculty of Business':                                ('aaup-business', 'كلية الأعمال والاقتصاد', '📊'),
 'Faculty of Dentistry':                               ('aaup-dentistry', 'كلية طب الأسنان', '🦷'),
 'Faculty of Engineering':                             ('aaup-engineering', 'كلية الهندسة', '⚙️'),
 'Faculty of Information Technology':                  ('aaup-it', 'كلية تكنولوجيا المعلومات', '💻'),
 'Faculty of Law':                                     ('aaup-law', 'كلية الحقوق', '⚖️'),
 'Faculty of Medicine':                                ('aaup-medicine', 'كلية الطب', '🩺'),
 'Faculty of Modern Media':                            ('aaup-modern-media', 'كلية الإعلام الحديث', '🎙'),
}

# Programs the app already ships, hand-checked. Never regenerated over.
ALREADY = {
 'Bachelor in Computer Science': 'cs',
 'Bachelor in Cyber Security': 'aaup-cyber-security',
 'Bachelor in Geographic Information Systems (GIS)': 'aaup-gis',
 'Bachelor in Multimedia Technology': 'aaup-multimedia',
 'Bachelor in Computer Networks - Minor Information Security': 'aaup-networks-infosec',
 'Bachelor in Computer Science - Minor Computer Information Technology': 'aaup-cs-cit',
 'Bachelor in Computer Science - Specialization in Game Design and Development': 'aaup-cs-gamedev',
}

# requirement bucket -> the app's display category (the card's colour).
DISPLAY = {
 'univReq': 'UNIVERSITY_REQUIREMENT', 'univElec': 'UNIVERSITY_ELECTIVE',
 'colgReq': 'MATH', 'specReq': 'CORE', 'specElec': 'DEPARTMENT_ELECTIVE',
 'freeElec': 'FREE_ELECTIVE', 'supportCourses': 'MATH',
}
ORDER = ['univReq', 'univElec', 'colgReq', 'specReq', 'specElec', 'freeElec', 'supportCourses']
SLOT_LABEL = {
 'specReq': ('Specialization Requirement', 'متطلب تخصص'),
 'univElec': ('University Elective', 'متطلب جامعي اختياري'),
 'freeElec': ('Free Elective', 'اختياري حر'),
 'specElec': ('Specialization Elective', 'اختياري تخصص'),
}


# Words that stay lowercase inside a title, and strings that must stay upper.
SMALL = {'a','an','and','the','of','for','in','on','to','with','from','at','by',
         'or','its','into','as','vs'}
UPPER = {'AI','IT','GIS','ISO','BLS','CPR','ICT','CAD','GPS','HTML','CSS','SQL',
         'PHP','TV','PR','HR','MIS','UI','UX','GPA','DNA','RNA','ECG','MRI','CT',
         'HVAC','PLC','CNC','RF','AC','DC','3D','2D','I','II','III','IV','V','VI',
         'VII','VIII','IX','X','XI','XII','USA','UN','EU','ISO45001'}


def title_case(name):
    """The document prints course names in CAPITALS; the app's own plans use
    title case.

    The first version tested `[A-Z]{2,5}` and kept anything matching as an
    acronym, which - on input that is entirely capitals - meant OF, AND, LAB,
    FOOD and WATER all survived: "FOOD AND WATER Microbiology". Acronyms have
    to be an explicit list, because on all-caps input nothing else can tell one
    from an ordinary word.
    """
    words = name.split()
    out = []
    for i, w in enumerate(words):
        lead = ''
        trail = ''
        core = w
        while core and not (core[0].isalnum()):
            lead += core[0]; core = core[1:]
        while core and not (core[-1].isalnum()):
            trail = core[-1] + trail; core = core[:-1]
        if not core:
            out.append(w); continue
        if core.upper() in UPPER:
            core = core.upper()
        elif any(ch.isdigit() for ch in core):
            core = core.upper()
        elif core.lower() in SMALL and i != 0 and i != len(words) - 1:
            core = core.lower()
        else:
            core = core[0].upper() + core[1:].lower()
        out.append(lead + core + trail)
    s = ' '.join(out)
    return s[:1].upper() + s[1:]


def section_hours(s):
    return s.get('requiredHours', sum(c.get('credits', 0) or 0 for c in s.get('courses', [])))


def build_courses(prog):
    """Every course the document's requirement tables name, and nothing else.

    Elective SLOTS - the blank rows a student fills in themselves - are added
    later by make_major, because only there is it known which of them the
    university's own advisory plan has already scheduled. Creating them here
    produced both: a 4-hour Free Elective slot from the requirement table AND
    the two 2-hour Free Electives the advisory plan places, so Doctor of
    Medicine's first term read 20 credit hours against a printed 18.
    """
    out, prereqs = [], []
    seen = set()
    for key in ORDER:
        s = prog['requirements'].get(key)
        if not s:
            continue
        for c in s.get('courses', []):
            cid = c['code']
            if cid in seen:
                continue
            seen.add(cid)
            out.append({
                'slug': cid, 'code': cid,
                'name': title_case(c['name']), 'nameAr': None,
                'credits': str(c.get('credits', 0) or 0),
                'theoretical': c.get('theoretical'), 'practical': c.get('practical'),
                'year': None, 'semester': None,
                'category': DISPLAY[key], 'requirement': key,
                'isElective': key in ('univElec', 'specElec', 'freeElec'),
                'isPlaceholder': False, 'pairGroup': False,
                'independentGrades': False, 'prerequisiteText': None,
                '_prereqs': [p for p in c.get('prerequisites', [])],
            })
    ids = {c['slug'] for c in out}
    for c in out:
        for p in c.pop('_prereqs'):
            if p in ids and p != c['slug']:
                prereqs.append({'requires': p, 'forCourse': c['slug']})

    # Circular prerequisites. The document prints, for a handful of courses,
    # that A requires B while B requires A - almost always a lecture and its
    # own lab, which are taken together. Left in, the app gates each on the
    # other and BOTH are permanently unavailable: a student can never make
    # either one takeable, and nothing says why.
    #
    # The document does not say which of the two comes first, so neither does
    # this: both edges are dropped and the pair is treated as what it plainly
    # is, two halves of one course taken in the same term. The drop is recorded
    # on the plan rather than done silently.
    edges = {(p['requires'], p['forCourse']) for p in prereqs}
    mutual = {(a, b) for (a, b) in edges if (b, a) in edges}
    dropped = []
    if mutual:
        names = {c['slug']: c['name'] for c in out}
        prereqs = [p for p in prereqs
                   if (p['requires'], p['forCourse']) not in mutual]
        for a, b in sorted({tuple(sorted(x)) for x in mutual}):
            dropped.append({'courses': [a, b],
                            'names': [names.get(a, a), names.get(b, b)],
                            'reason': 'each is printed as the other\u2019s prerequisite; '
                                      'kept as co-requisites so neither is locked forever'})
    return out, prereqs, dropped


def place(prog, courses, prereqs):
    """(placement source, {slug: (year, semester)})"""
    ap = prog.get('advisoryPlan')
    if ap and ap.get('terms'):
        YEARS = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'forth': 4,
                 'fifth': 5, 'sixth': 6, 'seventh': 7}
        SEMS = {'fall': 1, 'spring': 2, 'summer': 3, 'winter': 2}
        # An advisory term also schedules the electives a student has not
        # chosen yet, as rows like ("-", "Univ. Elec.", 2). Reading only rows
        # with a course code threw those away, and the generated slots fell
        # into the year-less pool instead of the term the university put them
        # in: 63 of 152 advisory terms came up short of their own printed
        # total, one plan by 7 credit hours in a single semester.
        PLACEHOLDER_BUCKET = {'univ. elec.': 'univElec', 'univ elec': 'univElec',
                              'spec. elec.': 'specElec', 'spec elec': 'specElec',
                              'free elective': 'freeElec', 'free elec.': 'freeElec',
                              # Fiqh And Law's advisory plan prints three
                              # unnamed "Spec. Req." rows - the only program
                              # that leaves a MANDATORY bucket's rows blank.
                              'spec. req.': 'specReq', 'spec req': 'specReq'}
        extra = []
        known = {c['slug'] for c in courses}
        out = {}
        for t in ap['terms']:
            y = YEARS.get((t.get('year') or '').split()[0].lower(), 1)
            s = SEMS.get((t.get('semester') or '').split()[0].lower(), 1)
            for c in t.get('courses', []):
                code = c.get('code')
                if code:
                    out[code] = (y, s)
                    if code not in known:
                        # The advisory plan schedules a course that appears in
                        # none of the requirement tables - Bachelor in Law's
                        # ADMINISTRATIVE LAW (1), for one. Dropping it lost a
                        # real course and left its term three hours short of
                        # its own printed total. It is kept, from what the
                        # advisory plan itself prints, with its bucket left
                        # unset because nothing in the document assigns one.
                        known.add(code)
                        extra.append({
                            'slug': code, 'code': code,
                            'name': title_case(c.get('name') or code), 'nameAr': None,
                            'credits': str(c.get('credits') or 0),
                            'theoretical': None, 'practical': None,
                            'year': y, 'semester': s,
                            'category': 'CORE', 'requirement': '',
                            'isElective': False, 'isPlaceholder': False,
                            'pairGroup': False, 'independentGrades': False,
                            'prerequisiteText': None,
                            'notInAnyRequirementTable': True,
                        })
                    continue
                label = (c.get('placeholder') or '').strip().lower()
                bucket = PLACEHOLDER_BUCKET.get(label)
                if not bucket:
                    continue
                # The advisory plan is the authority on WHERE elective hours
                # go. Each blank row it prints becomes one slot in that term;
                # make_major then tops up only the hours it did not place.
                extra.append({
                    'slug': '%s-slot-y%ds%d-%d' % (bucket.lower(), y, s, len(extra) + 1),
                    'code': None, 'name': SLOT_LABEL[bucket][0], 'nameAr': SLOT_LABEL[bucket][1],
                    'credits': str(c.get('credits') or 3),
                    'theoretical': None, 'practical': None, 'year': y, 'semester': s,
                    'category': DISPLAY[bucket], 'requirement': bucket,
                    'isElective': True, 'isPlaceholder': True, 'pairGroup': False,
                    'independentGrades': False, 'prerequisiteText': None,
                })
                out[extra[-1]['slug']] = (y, s)
        if out:
            # Slots and any course the advisory plan skips go to the same term
            # as their bucket's other courses, or last term if it has none.
            # Anything the advisory plan does not name stays year-less. It is
            # almost always an elective the student chooses, and the renderer
            # gives those their own section; forcing them into the last term
            # would put an elective pool in the graduating semester.
            return 'advisory', out, extra
    needs = {}
    for p in prereqs:
        needs.setdefault(p['forCourse'], []).append(p['requires'])
    # Only the courses a student MUST take get a term. An elective bucket is a
    # pool to choose from, not a schedule: packing all twenty specialization
    # electives into the grid pushed terms to 23 credit hours and buried the
    # required courses among options. The app already renders year-less
    # courses in their own section, which is exactly what a pool is.
    timetabled = [c for c in courses if not c['isElective']]
    seq = sequence([{'id': c['slug'], 'credits': c['credits'],
                     'prerequisites': needs.get(c['slug'], [])} for c in timetabled],
                   prog.get('_years') or 4)
    return 'suggested', seq, []


def years_of(prog):
    m = (prog.get('meta') or {}).get('durationYears')
    if m:
        return int(m)
    dh = prog.get('degreeHours') or 0
    if 'Diploma' in prog['name'] or 'Residency' in prog['name']:
        return 2 if dh <= 90 else 3
    if dh >= 230:
        return 6
    if dh >= 190:
        return 6
    if dh >= 160:
        return 5
    return 4


SUGGESTED_NOTE = (
    'No official semester order was published for this program, so the semester '
    'placement shown here is a suggested prerequisite-valid sequence — confirm '
    'the official order with your academic advisor. The course list, credit '
    'hours, prerequisites and requirement categories are exactly as published.'
)
ADVISORY_NOTE = (
    'The year-by-year layout is the university’s own published Advisory Plan.'
)


def make_major(prog, slug, college):
    prog['_years'] = years_of(prog)
    courses, prereqs, dropped_cycles = build_courses(prog)
    src, placement, extra_courses = place(prog, courses, prereqs)
    courses.extend(extra_courses)
    for c in courses:
        y, s = placement.get(c['slug'], (None, None))
        c['year'], c['semester'] = y, s

    # Elective hours the document requires that nothing above accounts for -
    # neither a named option nor a slot the advisory plan placed. The student
    # picks these and the source does not say when, so they sit in the plan's
    # year-less section, which is exactly what that section is for.
    for key in ORDER:
        section = prog['requirements'].get(key)
        if not section or key not in SLOT_LABEL:
            continue
        need = section_hours(section)
        have = sum(float(c['credits'] or 0) for c in courses if c['requirement'] == key)
        gap = need - have
        if gap <= 0.001:
            continue
        en, ar = SLOT_LABEL[key]
        unit = 2 if key == 'univElec' else 3
        n = max(1, int(round(gap / unit)))
        unit = gap / n
        for i in range(n):
            courses.append({
                'slug': '%s-slot-%d' % (key.lower(), i + 1), 'code': None,
                'name': en, 'nameAr': ar,
                'credits': str(int(unit) if float(unit).is_integer() else round(unit, 2)),
                'theoretical': None, 'practical': None,
                'year': None, 'semester': None,
                'category': DISPLAY[key], 'requirement': key,
                'isElective': True, 'isPlaceholder': True, 'pairGroup': False,
                'independentGrades': False, 'prerequisiteText': None,
            })

    # Where the university's OWN advisory plan schedules a course before
    # something it lists as that course's prerequisite. Recorded, never
    # reordered: the published plan is the published plan.
    advisory_conflicts = []
    if src == 'advisory':
        pos = {c['slug']: (c['year'], c['semester']) for c in courses}
        names = {c['slug']: c['name'] for c in courses}
        for p in prereqs:
            a, b = pos.get(p['requires']), pos.get(p['forCourse'])
            if a and b and a[0] and b[0] and a > b:
                advisory_conflicts.append({
                    'course': names.get(p['forCourse']), 'courseTerm': list(b),
                    'prerequisite': names.get(p['requires']), 'prerequisiteTerm': list(a)})

    req = {k: section_hours(prog['requirements'][k])
           for k in ORDER if k in prog['requirements']}
    total = sum(req.values())
    parts = ', '.join('%s %g' % (k, v) for k, v in req.items())
    bio = []
    if prog.get('overview'):
        bio.append(prog['overview'].strip())
    bio.append('%g credit hours: %s.' % (total, parts))
    bio.append(ADVISORY_NOTE if src == 'advisory' else SUGGESTED_NOTE)
    meta = prog.get('meta') or {}
    if prog.get('sourceIssues'):
        bio.append('Note: the published document does not agree with itself about this '
                   'program — see tools/catalogue-import for the recorded discrepancy.')
    if dropped_cycles:
        bio.append('Note: %d prerequisite pair%s in the published tables point at each '
                   'other (each listed as the other’s prerequisite). They are treated as '
                   'co-requisites — taken in the same term — because gating either on the '
                   'other would make both impossible to take.'
                   % (len(dropped_cycles), '' if len(dropped_cycles) == 1 else 's'))
    if advisory_conflicts:
        bio.append('Note: the university’s published Advisory Plan schedules %d course%s '
                   'before something its own tables list as a prerequisite. The plan is '
                   'shown exactly as published.'
                   % (len(advisory_conflicts), '' if len(advisory_conflicts) == 1 else 's'))
    if meta.get('incompleteInSource'):
        bio.append('Note: this program’s published plan is cut off in the source '
                   'document; the courses below are every one it lists.')

    degree = 'Diploma' if prog['name'].startswith('Diploma') else (
             'Residency' if 'Residency' in prog['name'] else 'B.Sc.')
    short = re.sub(r'^(Bachelor|Diploma|Master|Advanced Residency|Residency Program)\s+in\s+',
                   '', prog['name']).strip()
    subtitle = '%s · %g CH' % (degree, total)
    if meta.get('programCode'):
        subtitle += ' · Program %s' % meta['programCode']

    return {
        'schemaVersion': 1,
        'slug': slug,
        'name': short,
        'nameAr': None,
        'subtitle': subtitle,
        'subtitleAr': None,
        'icon': '🎓',
        'iconKey': '',
        'imageUrl': None,
        'bio': ' '.join(bio),
        'bioAr': None,
        'university': 'aaup',
        'college': college,
        'degreeHours': prog.get('degreeHours'),
        'requirementHours': req,
        # Set only when the document contradicts itself: its own requirement
        # tables do not add up to the degree total it states. Two programs do
        # this. Recorded on the plan so the discrepancy is a documented fact
        # travelling with the data, not a silent wrong number and not a red CI
        # run for something no code change can fix.
        **({'degreeHoursDiscrepancy': {
                'statedDegreeHours': prog['degreeHours'],
                'sumOfRequirementHours': total,
                'difference': round(total - prog['degreeHours'], 2),
                'reason': (meta.get('incompleteInSource', {}) or {}).get('arithmetic')
                          or 'The published document states one degree total and lists '
                             'requirement sections adding to another. Neither figure is '
                             'altered here.'}}
           if prog.get('degreeHours') and abs(total - prog['degreeHours']) > 0.001 else {}),
        'requirementSource': {
            'document': 'AAUP catalogue docx (data_600.docx)',
            'program': prog['name'],
            'placement': src,
            'via': 'tools/import-catalogue-programs.py',
        },
        'sourceVersion': 1,
        'courses': courses,
        'prerequisites': prereqs,
        **({'circularPrerequisitesDropped': dropped_cycles} if dropped_cycles else {}),
        **({'advisoryPlanPrerequisiteConflicts': advisory_conflicts} if advisory_conflicts else {}),
    }


def main(write=False):
    progs = load()
    best = {}
    for p in progs:                       # a Junior College diploma appears
        k = (p['faculty'], p['name'])     # in both sources; the images are the
        if k not in best or p['origin'] == 'images':   # complete one
            best[k] = p
    progs = list(best.values())

    used, made, skipped = set(ALREADY.values()), [], []
    for p in sorted(progs, key=lambda x: (x['faculty'], x['name'])):
        if p['name'] in ALREADY:
            skipped.append((p['name'], ALREADY[p['name']]))
            continue
        college = FACULTIES[p['faculty']][0]
        # The degree level goes in the slug, not a numeric suffix. "Dental
        # Technology" is both a Junior College diploma and a Faculty of
        # Dentistry bachelor's; aaup-dental-technology and
        # aaup-dental-technology-2 would be indistinguishable to anyone
        # reading the data, and the -2 would move if the input order changed.
        head = re.match(r'^(Bachelor|Diploma|Master|Advanced Residency|Residency Program)\s+in\s+',
                        p['name'])
        kind = (head.group(1) if head else '')
        prefix = {'Diploma': 'aaup-dip-', 'Master': 'aaup-msc-',
                  'Advanced Residency': 'aaup-res-', 'Residency Program': 'aaup-res-'}.get(kind, 'aaup-')
        rest = re.sub(r'^(Bachelor|Diploma|Master|Advanced Residency|Residency Program)\s+in\s+',
                      '', p['name'])
        rest = re.sub(r'\s*[-–]?\s*(Specialization in|Concentration on|Minor)\s+', ' ', rest)
        base = slugify(rest)[:48]
        slug = prefix + base
        n = 2
        while slug in used:
            slug = '%s%s-%d' % (prefix, base, n); n += 1
        used.add(slug)
        m = make_major(p, slug, college)
        made.append(m)
        if write:
            with open(os.path.join(MAJORS, slug + '.json'), 'w', encoding='utf-8') as f:
                json.dump(m, f, ensure_ascii=False, indent=2)
                f.write('\n')
    return made, skipped, progs


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true', help='write data/aaup/majors/')
    args = ap.parse_args()
    made, skipped, progs = main(write=args.write)
    print('already in the app, untouched:', len(skipped))
    for n, s in skipped:
        print('   %-64s -> %s' % (n[:64], s))
    print('\ngenerated:', len(made))
    bad = 0
    for m in made:
        total = sum(m['requirementHours'].values())
        dh = m['degreeHours']
        flag = '' if (dh is None or abs(total - dh) < 0.01) else '  <-- differs from stated %s' % dh
        if flag:
            bad += 1
        terms = collections.Counter((c['year'], c['semester']) for c in m['courses'])
        span = max(t[0] for t in terms if t[0]) if terms else 0
        print('  %-46s %-3d courses  %-6g CH  %-9s %dy%s' % (
            m['slug'][:46], len(m['courses']), total,
            m['requirementSource']['placement'], span, flag))
    print('\nprograms whose buckets differ from the stated degree total:', bad)

    # Every plan built from a published Advisory Plan is checked back against
    # that plan, term by term, using the totals the university printed under
    # each one. This is the check that caught the elective slots landing in the
    # year-less pool instead of the term they belong to (63 terms short), the
    # double-counted Free Electives in Doctor of Medicine (one term 2 hours
    # over), and Bachelor in Law's ADMINISTRATIVE LAW (1) - a course scheduled
    # in the advisory plan that appears in no requirement table at all.
    YEARS = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'forth': 4,
             'fifth': 5, 'sixth': 6, 'seventh': 7}
    SEMS = {'fall': 1, 'spring': 2, 'summer': 3, 'winter': 2}
    by_name = {p['name']: p for p in progs}
    terms = matched = 0
    off = []
    for mj in made:
        rs = mj['requirementSource']
        if rs['placement'] != 'advisory':
            continue
        prog = by_name.get(rs['program'])
        if not prog:
            continue
        drawn = collections.defaultdict(float)
        for c in mj['courses']:
            if c['year']:
                drawn[(c['year'], c['semester'])] += float(c['credits'] or 0)
        for t in prog['advisoryPlan']['terms']:
            if t.get('statedTotal') is None:
                continue
            y = YEARS.get((t.get('year') or '').split()[0].lower(), 1)
            sm = SEMS.get((t.get('semester') or '').split()[0].lower(), 1)
            terms += 1
            if abs(drawn[(y, sm)] - t['statedTotal']) < 0.001:
                matched += 1
            else:
                off.append((mj['slug'], y, sm, t['statedTotal'], drawn[(y, sm)]))
    print('advisory terms reproduced exactly (against the total the source prints '
          'under each): %d/%d' % (matched, terms))
    for slug, y, sm, want, got in off:
        print('   %-46s year %d semester %d: source says %gH, plan draws %gH'
              % (slug[:46], y, sm, want, got))
    recovered = sum(1 for mj in made for c in mj['courses']
                    if c.get('notInAnyRequirementTable'))
    if recovered:
        print('courses recovered from an advisory plan that no requirement table lists:',
              recovered)
