#!/usr/bin/env python3
"""Convert the legacy plans feed into data/<university>/majors/<slug>.json.

The first migration extracted only the four majors hardcoded inside
app/plan.html and never looked at app/plans/index.json, where the other 30
plans lived. This recovers them.

Source of truth is git, not a working copy, so this is reproducible after
app/ was deleted:

    git show 5635067:app/plans/index.json

Rules:
  * Nothing is invented. Fields the feed does not carry (theoretical/practical
    split, pair grouping, elective flags) are written as null/false, never
    guessed.
  * Anything that cannot be mapped is reported and the plan is skipped, rather
    than being written with a wrong value.
  * Plans that already exist in data/ are left alone unless --overwrite.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / 'data'
LEGACY_COMMIT = '5635067'

# Straight from the old app's own CATEGORY_FALLBACK table (plan.html:8475)
# and its Add Course dialog labels — not a guess:
#   skills → "University Req."      core → "Specialization Req."
#   math   → "College Req."         dept → "Specialization Elec."
#   uni    → "University Elec."     free → "Free Elec."
# `eng` also labels as "University Req." there, but the database has kept a
# distinct ENGLISH category since the four built-in majors were seeded, so it
# maps to that rather than being collapsed.
CATEGORY = {
    'core': 'CORE',
    'math': 'MATH',
    'dept': 'DEPARTMENT_ELECTIVE',
    'uni': 'UNIVERSITY_ELECTIVE',
    'free': 'FREE_ELECTIVE',
    'skills': 'UNIVERSITY_REQUIREMENT',
    'eng': 'ENGLISH',
}

SEMESTER = {'s1': 1, 's2': 2, 's3': 3, 'summer': 3}

# Plans that were demos in the feed, not real curricula.
SKIP_IDS = {'example-demo-plan'}


def git_show(path):
    out = subprocess.run(
        ['git', 'show', f'{LEGACY_COMMIT}:{path}'],
        cwd=REPO, capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit(f'could not read {path} from {LEGACY_COMMIT}: {out.stderr.strip()}')
    return out.stdout


def slugify(text):
    s = re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')
    return s or None


def college_index():
    """college name (English) -> college slug, from each university.json."""
    index = {}
    for uni_dir in sorted(DATA.iterdir()):
        f = uni_dir / 'university.json'
        if not uni_dir.is_dir() or not f.exists():
            continue
        doc = json.loads(f.read_text(encoding='utf-8'))
        for c in doc.get('colleges', []):
            index[(doc['slug'], c['name'].strip().lower())] = c['slug']
    return index


def convert(plan, colleges, problems):
    pid = plan.get('id')
    uni = plan.get('university')
    if not uni or not (DATA / uni).is_dir():
        problems.append(f'{pid}: unknown university {uni!r}')
        return None

    # The feed stores the college as a {en, ar} label, while the registry keys
    # colleges by slug — match on the English name.
    college_label = (plan.get('college') or {}).get('en', '').strip().lower()
    college_slug = colleges.get((uni, college_label))
    if college_label and not college_slug:
        problems.append(f'{pid}: college {college_label!r} not in {uni}/university.json')
        return None

    names = plan.get('majorName', {})
    name = (names.get('en') or {}).get('big') or pid
    name_ar = (names.get('ar') or {}).get('big') or None
    sub_en = (names.get('en') or {}).get('small') or None
    sub_ar = (names.get('ar') or {}).get('small') or None

    summers = {y['id'] for y in plan.get('structure', {}).get('years', []) if y.get('hasSummer')}

    courses, seen = [], set()
    for c in plan.get('courses', []):
        slug = slugify(c.get('id'))
        if not slug:
            problems.append(f'{pid}: course with no usable id: {c!r}')
            return None
        if slug in seen:
            problems.append(f'{pid}: duplicate course slug {slug!r}')
            return None
        seen.add(slug)

        cat = CATEGORY.get(c.get('category'))
        if cat is None:
            problems.append(f'{pid}: unmapped category {c.get("category")!r} on {slug}')
            return None

        year_id = c.get('yearId')
        m = re.fullmatch(r'y(\d+)', str(year_id or ''))
        year = int(m.group(1)) if m else None
        sem = SEMESTER.get(c.get('semester'))
        if year_id and year is None:
            problems.append(f'{pid}: unparseable yearId {year_id!r} on {slug}')
            return None
        if c.get('semester') and sem is None:
            problems.append(f'{pid}: unmapped semester {c.get("semester")!r} on {slug}')
            return None
        # A summer course in a year the structure never marked as having one
        # would render into a semester that does not exist.
        if sem == 3 and year_id not in summers:
            problems.append(f'{pid}: {slug} is in summer of {year_id}, which has no summer')
            return None

        credits = c.get('creditHours')
        courses.append({
            'slug': slug,
            'code': (str(c['courseNumber']).strip() or None) if c.get('courseNumber') else None,
            'name': (c.get('name') or '').strip() or slug,
            'nameAr': (c.get('ar') or '').strip() or None,
            'credits': str(credits) if credits is not None else '0',
            # The feed never carried a lecture/lab hour split, pair grouping,
            # or elective flags. Left empty rather than fabricated.
            'theoretical': None,
            'practical': None,
            'year': year,
            'semester': sem,
            'category': cat,
            'isElective': False,
            'isPlaceholder': False,
            'pairGroup': False,
            'independentGrades': False,
            'prerequisiteText': None,
        })

    prereqs = []
    for pair in plan.get('prerequisites', []):
        if not (isinstance(pair, list) and len(pair) == 2):
            problems.append(f'{pid}: malformed prerequisite {pair!r}')
            return None
        req, dep = slugify(pair[0]), slugify(pair[1])
        # A prerequisite pointing at a course this plan doesn't contain would
        # silently become an unsatisfiable requirement.
        if req not in seen or dep not in seen:
            problems.append(f'{pid}: prerequisite {req} -> {dep} references a missing course')
            return None
        prereqs.append({'requires': req, 'forCourse': dep})

    return {
        'schemaVersion': 1,
        'slug': pid,
        'name': name,
        'nameAr': name_ar,
        'subtitle': sub_en,
        'subtitleAr': sub_ar,
        'icon': plan.get('icon') or None,
        'bio': (plan.get('bio') or {}).get('en') or None,
        'bioAr': (plan.get('bio') or {}).get('ar') or None,
        'university': uni,
        'college': college_slug,
        # Never invented — the real totals come from the official PDFs.
        'degreeHours': None,
        'sourceVersion': plan.get('version'),
        'courses': courses,
        'prerequisites': prereqs,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--overwrite', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    feed = json.loads(git_show('app/plans/index.json'))
    colleges = college_index()
    problems, written, skipped = [], [], []

    for plan in feed.get('plans', []):
        pid = plan.get('id')
        if pid in SKIP_IDS:
            skipped.append(f'{pid} (demo)')
            continue
        doc = convert(plan, colleges, problems)
        if doc is None:
            continue
        out = DATA / doc['university'] / 'majors' / f'{doc["slug"]}.json'
        if out.exists() and not args.overwrite:
            skipped.append(f'{pid} (already in data/)')
            continue
        if not args.dry_run:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        written.append((doc['university'], doc['slug'], len(doc['courses']), len(doc['prerequisites'])))

    print(f'feed plans: {len(feed.get("plans", []))}')
    print(f'written:    {len(written)}')
    for uni, slug, nc, np in written:
        kind = 'listing' if nc == 0 else f'{nc} courses, {np} prereqs'
        print(f'   {uni}/{slug}: {kind}')
    if skipped:
        print(f'skipped:    {len(skipped)}')
        for s in skipped:
            print(f'   {s}')
    if problems:
        print(f'\nPROBLEMS ({len(problems)}) — these plans were NOT written:')
        for p in problems:
            print(f'   {p}')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
