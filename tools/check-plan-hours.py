#!/usr/bin/env python3
"""Check that every plan's credit hours add up to the degree it claims.

A study plan is only useful if its total is right, and a wrong total is
completely silent: the app happily shows "54 / 123H (44%)" for a 129-hour
degree and nothing anywhere looks broken.

Two things went wrong at once in the AI & Medical Sciences plan, and this
script exists so neither can come back unnoticed:

1. AAUP registers a lecture and its lab as ONE course — both halves carry the
   same catalogue number and the same credit value. The plan grid draws two
   cards on purpose, but anything SUMMING them has to count the pair once.
   Four such pairs added 14 phantom hours; the Degree Audit deduped, the
   roadmap did not, and the two screens disagreed out loud (123 vs 137).

2. The specialization elective pool lists more courses than the degree
   requires. How many are actually required lives in DEPT_REQUIRED in
   web/js/11-module11.js, and it read "3 of the 10 offered" for a pool of 13
   where 5 are taken.

    python3 tools/check-plan-hours.py

For every plan that declares degreeHours, this recomputes the total the way
the app does — pairs counted once, the elective pool capped at what is
required — and fails if the two disagree. Plans without a declared
degreeHours are reported but not failed: there is nothing to check them
against yet, and inventing a number would be worse than admitting that.
"""
import json
import pathlib
import re
import sys
from collections import defaultdict

REPO = pathlib.Path(__file__).resolve().parent.parent
PLANS = REPO / 'web' / 'plans.json'
PROGRESS_MODULE = REPO / 'web' / 'js' / '11-module11.js'


def dept_required():
    """The per-plan 'how many of this elective pool are actually required'
    map, read straight out of the module that owns it so the two cannot
    drift apart."""
    src = PROGRESS_MODULE.read_text(encoding='utf-8')
    block = re.search(r'var DEPT_REQUIRED = \{(.*?)\n  \};', src, re.S)
    if not block:
        return {}
    out = {}
    for key, value in re.findall(r"'?([A-Za-z0-9_-]+)'?\s*:\s*(\d+)", block.group(1)):
        out[key] = int(value)
    return out


def plan_total(plan, required_map):
    """Credit hours for one plan, counted the way the app counts them.

    A plan built from a published university plan carries requirementHours -
    how many hours each requirement bucket needs. That is what the app now
    totals, because a bucket is worth what the university requires and not the
    sum of the cards drawn in it: an elective pool lists every option a student
    may choose from, and a plan can be short a slot. Use the same figures here,
    or this check disagrees with the screen it is meant to protect.

    Without requirementHours, fall back to what this has always done: sum every
    course, capping the dept-tagged elective pool at DEPT_REQUIRED.
    """
    seen = set()
    by_bucket = defaultdict(float)
    mandatory = 0.0
    pool = defaultdict(list)          # category -> [credits, ...]

    for course in plan.get('courses', []):
        # One registered course = one entry. Fall back to the id when a
        # course carries the "-" placeholder every generic elective slot
        # shares, which must never collapse a pool into a single row.
        number = (course.get('courseNumber') or '').strip()
        key = number if number and number != '-' else course.get('id')
        if key in seen:
            continue
        seen.add(key)

        credits = float(course.get('creditHours') or 0)
        bucket = course.get('requirement') or ''
        if bucket:
            by_bucket[bucket] += credits
        if course.get('category') == 'dept':
            pool['dept'].append(credits)
        else:
            mandatory += credits

    required = plan.get('requirementHours') or {}
    if required:
        total = 0.0
        notes = []
        for bucket, need in required.items():
            need = float(need)
            total += need
            drawn = by_bucket.get(bucket, 0.0)
            if abs(drawn - need) > 0.001:
                notes.append(f'{bucket} requires {need:g}H, plan draws {drawn:g}H')
        # A bucket the plan draws courses for but the document never mentions
        # would otherwise vanish from the total without a word.
        for bucket, drawn in by_bucket.items():
            if bucket not in required:
                notes.append(f'{bucket} not in requirementHours ({drawn:g}H drawn)')
        return total, '; '.join(notes)

    elective = 0.0
    detail = ''
    if pool['dept']:
        offered = len(pool['dept'])
        need = required_map.get(plan['id'], offered)
        unit = max(set(pool['dept']), key=pool['dept'].count)
        elective = unit * min(need, offered)
        detail = f'{need} of {offered} x {unit:g}H'
    return mandatory + elective, detail


def main():
    catalogue = json.loads(PLANS.read_text(encoding='utf-8'))
    required_map = dept_required()
    failures, undeclared, verified, known = [], [], [], []

    for plan in catalogue.get('plans', []):
        if not plan.get('courses'):
            continue
        # test-major is a fixture for the plan editor, not a curriculum; its
        # "999H" is a deliberately silly number and means nothing here.
        if plan['id'].startswith('test-'):
            continue
        declared = plan.get('degreeHours')
        computed, detail = plan_total(plan, required_map)
        if not declared:
            undeclared.append((plan['id'], computed))
            continue
        if abs(computed - float(declared)) > 0.001:
            if plan.get('degreeHoursDiscrepancy'):
                # The document itself does not add up, and the plan says so.
                # Reporting it is the point; failing on it would ask someone to
                # fix a fact about a PDF.
                known.append((plan['id'], float(declared), computed,
                              plan['degreeHoursDiscrepancy'].get('reason', '')))
            else:
                failures.append((plan['id'], float(declared), computed, detail))
        else:
            verified.append((plan['id'], float(declared)))

    for plan_id, computed in undeclared:
        print(f'  no official total declared: {plan_id} (courses add up to {computed:g}H)')

    if known:
        print('\nplans where the SOURCE DOCUMENT does not add up (recorded, not a failure):')
        for plan_id, declared, computed, reason in known:
            print(f'  {plan_id}: the document states {declared:g}H and lists {computed:g}H')
            if reason:
                print(f'      {reason[:150]}')

    if failures:
        print('\nplans whose courses do not add up to the degree they claim:')
        for plan_id, declared, computed, detail in failures:
            gap = computed - declared
            print(f'  {plan_id}: declares {declared:g}H, courses total {computed:g}H '
                  f'({gap:+g}H){"  [electives: " + detail + "]" if detail else ""}')
        print('\nFix the course list, the declared degreeHours, the plan\'s requirementHours,')
        print('or its entry in DEPT_REQUIRED (web/js/11-module11.js) — whichever is wrong.')
        return 1

    for plan_id, declared in verified:
        print(f'  ok: {plan_id} adds up to its published {declared:g}H')
    print(f'ok — {len(verified)} plan(s) checked against an official total, '
          f'{len(known)} where the document contradicts itself, '
          f'{len(undeclared)} still without one')
    return 0


if __name__ == '__main__':
    sys.exit(main())
