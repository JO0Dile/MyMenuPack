#!/usr/bin/env python3
"""Merge a downloaded word list into web/js/58-wordlist-data.js.

Lists of banned words are published all over the place, usually as a plain
text file with one word per line. This puts one into the app without anyone
hand-editing a JavaScript array.

    python3 tools/import-wordlist.py badwords.txt --tier always
    python3 tools/import-wordlist.py animals.txt  --tier contextual
    python3 tools/import-wordlist.py badwords.txt --tier always --dry-run

WHICH TIER

    always      an insult in every sentence anyone will write here. No
                context can save it, so the filter looks for none.
    contextual  only an insult when aimed at a person. "حمار" is abuse in
                "يا حمار" and a farm animal in "درسنا عن الحمير". Put animal
                names, mild insults and anything with an ordinary meaning
                here, or the app will start rejecting biology homework.

Choosing wrongly is the one way to make this worse rather than better, so
--tier is required and there is no default.

The script splits words by script (Arabic vs Latin) automatically, skips
anything already present, refuses entries shorter than three characters
(they match far too much), and reports exactly what it added.
"""
import argparse
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / 'web' / 'js' / '58-wordlist-data.js'

ARABIC = re.compile(r'[؀-ۿ]')
MIN_LEN = 3


def read_words(path):
    """One word per line; blank lines and # comments ignored. A CSV-ish line
    ("word,severity") keeps only the first field."""
    words = []
    for line in pathlib.Path(path).read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        word = line.split(',')[0].split('\t')[0].strip().strip('"\'')
        if word:
            words.append(word)
    return words


def existing(src, tier, lang):
    """The words already listed for one tier and language."""
    block = re.search(
        rf'{tier}:\s*\{{(.*?)\n    \}}', src, re.S)
    if not block:
        return set(), None
    arr = re.search(rf'\b{lang}:\s*\[(.*?)\]', block.group(1), re.S)
    if not arr:
        return set(), None
    return set(re.findall(r"'([^']+)'", arr.group(1))), arr


def insert(src, tier, lang, new_words):
    """Append words to one array, keeping the file's formatting."""
    if not new_words:
        return src
    pattern = re.compile(
        rf'({tier}:\s*\{{.*?\b{lang}:\s*\[)(.*?)(\])', re.S)
    match = pattern.search(src)
    if not match:
        print(f'  ! could not find {tier}.{lang} in {DATA.name} — skipped')
        return src
    body = match.group(2).rstrip()
    if body and not body.endswith(','):
        body += ','
    added = ',\n        '.join(f"'{w}'" for w in new_words)
    return src[:match.start(2)] + body + '\n        ' + added + '\n      ' + src[match.end(2):]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file', help='text file, one word per line')
    ap.add_argument('--tier', required=True, choices=['always', 'contextual'],
                    help='see the note above — choosing wrongly is the one way '
                         'to make the filter worse')
    ap.add_argument('--dry-run', action='store_true',
                    help='show what would be added, write nothing')
    args = ap.parse_args()

    words = read_words(args.file)
    if not words:
        print('no words found in that file')
        return 1

    src = DATA.read_text(encoding='utf-8')
    report = {}
    for lang in ('ar', 'en'):
        have, _ = existing(src, args.tier, lang)
        wanted = [w for w in words if (lang == 'ar') == bool(ARABIC.search(w))]
        fresh, skipped_short, seen = [], 0, set(have)
        for w in wanted:
            if len(w) < MIN_LEN:
                skipped_short += 1
                continue
            if w in seen:
                continue
            seen.add(w)
            fresh.append(w)
        report[lang] = (fresh, len(wanted) - len(fresh) - skipped_short, skipped_short)
        if not args.dry_run:
            src = insert(src, args.tier, lang, fresh)

    total = 0
    for lang, (fresh, dupes, short) in report.items():
        total += len(fresh)
        print(f'  {lang}: +{len(fresh)} new, {dupes} already listed, '
              f'{short} too short to be safe (<{MIN_LEN} chars)')
        for w in fresh[:12]:
            print(f'      {w}')
        if len(fresh) > 12:
            print(f'      … and {len(fresh) - 12} more')

    if args.dry_run:
        print(f'\ndry run — nothing written. {total} word(s) would be added to "{args.tier}".')
        return 0

    if total:
        DATA.write_text(src, encoding='utf-8')
        print(f'\nwrote {DATA.relative_to(REPO)} — {total} word(s) added to "{args.tier}".')
        print('Now run the filter tests, and mirror any ALWAYS words into')
        print('workers/thoughts-worker.js: a word blocked only on the client is')
        print('not blocked at all.')
    else:
        print('\nnothing to add — every word was already listed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
