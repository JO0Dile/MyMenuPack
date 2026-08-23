#!/usr/bin/env python3
"""Write the university's own requirement buckets into data/aaup/majors/*.json.

The app has always guessed which requirement a course belongs to. It derives
the bucket from a course's VISUAL category (core / math / dept / uni / free),
which is a display choice, not the university's taxonomy - so "University
Requirements" on the My Path screen showed 11 hours where the student portal
says 14, and College vs Specialization could not be told apart at all because
nothing in the data distinguished them.

tools/catalogue-import/catalogue.json now carries the real answer, straight
from the university's published plans: every course's section (univReq,
univElec, colgReq, specReq, specElec, freeElec, supportCourses) and how many
hours each section requires.

    python3 tools/merge-catalogue-requirements.py [--check]

--check reports what would change and writes nothing.

Only majors in PAIRS below are touched, and only after this script has proved
that EVERY course in the app's plan appears in that catalogue program. A
partial match is refused: half a taxonomy is worse than none, because the
missing half looks like a zero rather than an absence.
"""
import argparse
import collections
import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
MAJORS = REPO / 'data' / 'aaup' / 'majors'
CATALOGUE = REPO / 'tools' / 'catalogue-import' / 'catalogue.json'
# The AI & Data Science faculty is name-only in the main document, so its
# course data comes from the separate faculty PDF instead.
AI_CATALOGUE = REPO / 'tools' / 'catalogue-import' / 'ai-data-science.json'

# Hand-checked, never fuzzy-matched. A wrong pairing would write a whole
# program's requirements onto the wrong degree, and every course code would
# still resolve, so nothing downstream would notice.
PAIRS = {
    'aaup-cyber-security': 'Bachelor in Cyber Security',
    'aaup-gis': 'Bachelor in Geographic Information Systems (GIS)',
    'aaup-multimedia': 'Bachelor in Multimedia Technology',
    'cs': 'Bachelor in Computer Science',
    # Faculty of Artificial Intelligence and Data Science, from its own PDF.
    'robotics': 'Bachelor in Artificial Intelligence - Specialization in '
                'Artificial Intelligence and Robotics',
    'aaup-ai-innovation': 'Bachelor in Artificial Intelligence - Specialization in '
                          'Artificial Intelligence and Innovation',
    'aaup-ai-fintech': 'Bachelor in Artificial Intelligence - Specialization in '
                       'Artificial Intelligence and Financial Technology',
    'aaup-finance-data-science': 'Bachelor in Data Science - Specialization in '
                                 'Finance and Data Science',
    'aaup-financial-engineering': 'Bachelor in Financial Engineering',
    # Deliberately NOT here. Their PDF program does not cover every course the
    # app's plan draws, so writing a taxonomy would leave part of it blank:
    #   medical      - the PDF prints no Spec. Req. section at all (32 hours
    #                  short of its own stated 129), leaving 15 courses unplaced
    #   statistics   - its Colg. Req. table stops after three courses (75 hours
    #                  short of 125), leaving 22 unplaced
    #   cybersecurity - reconciles to 127, but the app's plan carries Computer
    #                  Architecture and Differential Equations, which that
    #                  program's tables do not list
}

# The plans carry elective SLOTS with synthetic ids ("uni-elective-1") rather
# than course codes, because the student has not chosen the course yet. Their
# visual category is the only thing that says which bucket the slot belongs to.
SLOT_BUCKET = {
    'UNIVERSITY_ELECTIVE': 'univElec',
    'FREE_ELECTIVE': 'freeElec',
    'DEPARTMENT_ELECTIVE': 'specElec',
}

ORDER = ['univReq', 'univElec', 'colgReq', 'specReq', 'specElec', 'freeElec', 'supportCourses']


def normalize(name):
    return re.sub(r'[^a-z0-9]+', ' ', (name or '').lower()).strip()


def section_hours(s):
    return s.get('requiredHours', sum(c.get('credits', 0) or 0 for c in s.get('courses', [])))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='report only, write nothing')
    args = ap.parse_args()

    facs = json.loads(CATALOGUE.read_text(encoding='utf-8'))
    catalogue = {p['name']: p for f in facs for p in f['programs'] if p['requirements']}
    if AI_CATALOGUE.exists():
        ai = json.loads(AI_CATALOGUE.read_text(encoding='utf-8'))
        for p in ai['programs']:
            if p['requirements']:
                catalogue[p['name']] = p

    ai_names = set()
    if AI_CATALOGUE.exists():
        ai_names = {p['name'] for p in
                    json.loads(AI_CATALOGUE.read_text(encoding='utf-8'))['programs']}

    failed = False
    for slug, program_name in PAIRS.items():
        path = MAJORS / f'{slug}.json'
        major = json.loads(path.read_text(encoding='utf-8'))
        program = catalogue.get(program_name)
        if program is None:
            print(f'{slug}: "{program_name}" is not a catalogue program with course data')
            failed = True
            continue

        role = {c['code']: key
                for key, s in program['requirements'].items()
                for c in s['courses']}
        # The same course can be registered under different codes in different
        # faculties - the AI faculty's PDF calls Computer Skills 240111000
        # where these plans call it 110411000. Fall back to the name, which is
        # unambiguous WITHIN one program, and record every time it is used.
        by_name = {normalize(c['name']): key
                   for key, s in program['requirements'].items()
                   for c in s['courses']}

        def bucket_of(course):
            if course.get('code') in role:
                return role[course['code']], None
            name_key = normalize(course.get('name'))
            if name_key in by_name:
                return by_name[name_key], course.get('code')
            return None, None

        # Refuse to write a partial taxonomy.
        unplaced = [c for c in major.get('courses', [])
                    if bucket_of(c)[0] is None and c.get('category') not in SLOT_BUCKET]
        if unplaced:
            print(f'{slug}: {len(unplaced)} course(s) are in the plan but not in '
                  f'"{program_name}" and are not elective slots — refusing to write a '
                  f'partial taxonomy:')
            for c in unplaced[:10]:
                print(f'    {c.get("code") or c["slug"]}  {c.get("name")}')
            failed = True
            continue

        required = {k: section_hours(s) for k, s in program['requirements'].items()}
        got = collections.defaultdict(float)
        matched_by_name = []
        for c in major['courses']:
            bucket, renamed = bucket_of(c)
            if bucket is None:
                bucket = SLOT_BUCKET[c['category']]
            elif renamed is not None:
                matched_by_name.append((renamed, c.get('name')))
            c['requirement'] = bucket
            got[bucket] += float(c.get('credits') or 0)

        major['requirementHours'] = {k: required[k] for k in ORDER if k in required}
        major['degreeHours'] = program.get('degreeHours')
        # The source can state a total its own sections do not reach. Financial
        # Engineering's PDF says 133 and prints 131. Record it on the plan so
        # the discrepancy travels with the data instead of failing a check no
        # code change can satisfy - the same treatment the importer gives the
        # two programs in the main document that contradict themselves.
        total = sum(required.values())
        stated = program.get('degreeHours')
        if stated is not None and abs(total - stated) > 0.001:
            major['degreeHoursDiscrepancy'] = {
                'statedDegreeHours': stated,
                'sumOfRequirementHours': total,
                'difference': round(total - stated, 2),
                'reason': program.get('degreeHoursDiscrepancy', {}).get(
                    'reason',
                    'The source states this total but its requirement sections add '
                    'to another. Neither figure is altered here.'),
            }
        else:
            major.pop('degreeHoursDiscrepancy', None)
        major['requirementSource'] = {
            'document': ('AAUP AI & Data Science catalogue PDF'
                         if program_name in ai_names
                         else 'AAUP catalogue docx (data_600.docx)'),
            'program': program_name,
            'via': 'tools/merge-catalogue-requirements.py',
        }
        if matched_by_name:
            major['requirementSource']['matchedByNameNotCode'] = [
                {'planCode': code, 'course': name} for code, name in matched_by_name]

        # The bucket sums the plan's own courses produce, next to what the
        # university requires. Where they differ the plan is wrong, not the
        # document - recorded so the app can show the required figure and a
        # human can see which plans still need courses added.
        drift = {k: round(got.get(k, 0) - required.get(k, 0), 2)
                 for k in set(required) | set(got)
                 if abs(got.get(k, 0) - required.get(k, 0)) >= 0.01}
        if drift:
            major['requirementHoursDrift'] = {k: drift[k] for k in ORDER if k in drift}
        else:
            major.pop('requirementHoursDrift', None)

        print(f'{slug}: {program_name}')
        print(f'    degreeHours {program.get("degreeHours")}, sections sum to {total}')
        for k in ORDER:
            if k not in required:
                continue
            mark = '' if k not in drift else f'   plan has {round(got.get(k,0),1)}'
            print(f'    {k:<15} required {required[k]}{mark}')
        if not args.check:
            path.write_text(json.dumps(major, ensure_ascii=False, indent=2) + '\n',
                            encoding='utf-8')

    if failed:
        return 1
    if args.check:
        print('\n--check: nothing written')
    else:
        print('\nwritten. Now run: python3 tools/build-catalogue.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
