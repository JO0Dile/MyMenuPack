#!/usr/bin/env python3
"""Check that the service worker saves every file the page actually loads.

The app has no build step, so nothing keeps web/index.html and the CORE list
in web/sw.js in sync automatically. Forgetting to add a new module to CORE is
silent: the app works perfectly in every test, and then fails for the one
student who opens it on a bus with no signal, because the file it needs was
never stored.

    python3 tools/check-precache.py

Exits non-zero and prints the missing entries if the two disagree. Run by CI
on every push; the Fix panel performs the same comparison at runtime, from
inside the browser.
"""
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
WEB = REPO / 'web'


def loaded_by_page():
    html = (WEB / 'index.html').read_text(encoding='utf-8')
    urls = re.findall(r'<script[^>]+src="([^"]+)"', html)
    urls += re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', html)
    # Not referenced by a tag, but fetched at runtime and required offline.
    urls += ['plans.json', 'contacts.json', 'manifest.json']
    return [u for u in urls if '//' not in u]


def precached():
    sw = (WEB / 'sw.js').read_text(encoding='utf-8')
    block = re.search(r'var\s+CORE\s*=\s*\[(.*?)\]', sw, re.S)
    if not block:
        print('could not find the CORE array in web/sw.js', file=sys.stderr)
        sys.exit(2)
    return [u.lstrip('./') for u in re.findall(r"'([^']+)'", block.group(1))]


def main():
    listed = set(precached())
    needed = loaded_by_page()

    missing = [u for u in needed if u not in listed]
    # An entry in CORE with no file behind it fails the service worker's
    # install outright (addAll is atomic), taking offline support down with it
    # — worth catching here rather than in a student's browser.
    absent = [u for u in listed if not (WEB / u).exists()]

    for u in missing:
        print(f'not precached: {u}  (loaded by index.html, missing from CORE in sw.js)')
    for u in absent:
        print(f'precached but missing on disk: {u}  (this fails the whole install)')

    if missing or absent:
        print(f'\n{len(missing) + len(absent)} problem(s). '
              f'Update the CORE array in web/sw.js.')
        return 1

    print(f'ok — all {len(needed)} files the page loads are precached, '
          f'and all {len(listed)} precached files exist')
    return 0


if __name__ == '__main__':
    sys.exit(main())
