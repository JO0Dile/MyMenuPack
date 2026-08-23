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
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
MAJORS = REPO / 'data' / 'aaup' / 'majors'
CATALOGUE = REPO / 'tools' / 'catalogue-import' / 'catalogue.json'

# Hand-checked, never fuzzy-matched. A wrong pairing would write a whole
# program's requirements onto the wrong degree, and every course code would
# still resolve, so nothing downstream would notice.
PAIRS = {
    'aaup-cyber-security': 'Bachelor in Cyber Security',
    'aaup-gis': 'Bachelor in Geographic Information Systems (GIS)',
    'aaup-multimedia': 'Bachelor in Multimedia Technology',
    'cs': 'Bachelor in Computer Science',
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


def section_hours(s):
    return s.get('requiredHours', sum(c.get('credits', 0) or 0 for c in s.get('courses', [])))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='report only, write nothing')
    args = ap.parse_args()

    facs = json.loads(CATALOGUE.read_text(encoding='utf-8'))
    catalogue = {p['name']: p for f in facs for p in f['programs'] if p['requirements']}

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

        # Refuse to write a partial taxonomy.
        unplaced = [c for c in major.get('courses', [])
                    if c.get('code') not in role and c.get('category') not in SLOT_BUCKET]
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
        for c in major['courses']:
            bucket = role.get(c.get('code')) or SLOT_BUCKET[c['category']]
            c['requirement'] = bucket
            got[bucket] += float(c.get('credits') or 0)

        major['requirementHours'] = {k: required[k] for k in ORDER if k in required}
        major['degreeHours'] = program.get('degreeHours')
        major['requirementSource'] = {
            'document': 'AAUP catalogue docx (data_600.docx)',
            'program': program_name,
            'via': 'tools/merge-catalogue-requirements.py',
        }

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

        total = sum(required.values())
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
