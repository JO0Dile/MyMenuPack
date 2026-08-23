"""catalogue.json -> courses-index.json (one entry per distinct course code)

The catalogue is organised by program, so the same course appears once per
program that requires it. This flattens it to a single list keyed by code, which
is what the app needs to look a course up by number.

Where two programs print different values for the same code, the difference is
kept on the entry rather than resolved - the document says both things.
"""
import json, collections

facs = json.load(open('catalogue.json', encoding='utf-8'))

occurrences = collections.defaultdict(list)
entries = 0
for f in facs:
    for p in f['programs']:
        for key, s in p['requirements'].items():
            for c in s['courses']:
                entries += 1
                occurrences[c['code']].append((f['faculty'], p['name'], key, c))

FIELDS = ('name', 'credits', 'theoretical', 'practical')
courses = []
conflicts = 0
for code in sorted(occurrences):
    occs = occurrences[code]
    merged = {'code': code}
    disagree = {}
    for fld in FIELDS:
        vals = []
        for _, _, _, c in occs:
            if fld in c and c[fld] not in vals: vals.append(c[fld])
        if not vals: continue
        merged[fld] = vals[0]
        if len(vals) > 1: disagree[fld] = vals
    prereqs = sorted({q for _, _, _, c in occs for q in c.get('prerequisites', [])})
    if prereqs: merged['prerequisites'] = prereqs
    merged['requirementRoles'] = sorted({k for _, _, k, _ in occs})
    merged['programs'] = sorted({p for _, p, _, _ in occs})
    if disagree:
        merged['sourceDisagrees'] = disagree
        conflicts += 1
    courses.append(merged)

out = {
    'source': 'AAUP catalogue docx (data_600.docx)',
    'faculties': len(facs),
    'programs': sum(len(f['programs']) for f in facs),
    'courseEntries': entries,
    'distinctCourses': len(courses),
    'coursesWhereSourceDisagrees': conflicts,
    'courses': courses,
}
json.dump(out, open('courses-index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'course entries   : {entries}')
print(f'distinct courses : {len(courses)}')
print(f'  source disagrees on a field: {conflicts}')
