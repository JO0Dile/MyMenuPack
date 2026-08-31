#!/usr/bin/env python3
"""Fill in the Arabic side of course names in web/plans.json.

Two sources, in this order of authority:

1. Other plans in this same file. The catalogue gives an Arabic name for
   some occurrences of a course and not others — "Community Service" is
   named in Arabic in thirteen plans and left blank in fifty-two — so the
   Arabic that is already here is copied across every other row with the
   same English name. This invents nothing: it is the university's own
   wording, already in the data.

2. data/aaup/course-names-ar.json, a hand-written map for names that
   appear nowhere in the file with an Arabic side. These are TRANSLATIONS
   of the English titles transcribed from the catalogue, not copies of the
   university's Arabic course titles, which are not in this repository.
   Treat them as the app's wording, not as authoritative.

Anything still without an Arabic name is left blank and reported, so the
gap stays visible rather than being papered over.
"""
import json
import os
import sys
import collections

PLANS = 'web/plans.json'
MAP = 'data/aaup/course-names-ar.json'


def main():
    doc = json.load(open(PLANS, encoding='utf-8'))

    from_file = {}
    for plan in doc['plans']:
        for c in plan.get('courses') or []:
            name = (c.get('name') or '').strip()
            ar = (c.get('ar') or '').strip()
            if name and ar:
                from_file.setdefault(name, ar)

    hand = {}
    if os.path.exists(MAP):
        hand = json.load(open(MAP, encoding='utf-8'))

    filled_file = filled_map = 0
    missing = collections.Counter()
    for plan in doc['plans']:
        for c in plan.get('courses') or []:
            name = (c.get('name') or '').strip()
            if not name or (c.get('ar') or '').strip():
                continue
            if name in from_file:
                c['ar'] = from_file[name]
                filled_file += 1
            elif hand.get(name):
                c['ar'] = hand[name]
                filled_map += 1
            else:
                missing[name] += 1

    with open(PLANS, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))

    print('filled %d from the catalogue data already in the file' % filled_file)
    print('filled %d from %s' % (filled_map, MAP))
    print('still without an Arabic name: %d rows, %d distinct'
          % (sum(missing.values()), len(missing)))
    if missing and '--list' in sys.argv:
        for name, n in missing.most_common():
            print('  %4d  %s' % (n, name))
    return 0


if __name__ == '__main__':
    sys.exit(main())
