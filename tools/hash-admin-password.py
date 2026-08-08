#!/usr/bin/env python3
"""Turn an admin password into the hash the admin Worker stores.

The Worker never sees or stores a password — only this hash. Run this on your
own machine, paste the one line it prints into the Worker's ADMIN_PASSWORD_HASH
secret, and the password itself is never written down anywhere.

    python3 tools/hash-admin-password.py

The password is read from a hidden prompt rather than an argument, because a
command-line argument ends up in your shell history and in the process list.

Output format, matched exactly by verifyPassword() in
admin/cloudflare-worker.js:

    pbkdf2$<iterations>$<salt-base64url>$<hash-base64url>

Changing ITERATIONS here is safe: the value travels inside the hash string, so
the Worker uses whatever number was used to generate it. Raise it, re-run this,
paste the new value — old hashes keep verifying until you replace them.
"""

import base64
import getpass
import hashlib
import os
import secrets
import sys

# OWASP's floor for PBKDF2-HMAC-SHA256 is 600,000. A Cloudflare Worker gets
# 10ms of CPU on the free plan for a normal request but is allowed far more on
# a cold path like login; this lands around 200-400ms there, which is also a
# useful brake on guessing.
ITERATIONS = 600_000


def b64url(raw: bytes) -> str:
    """URL-safe base64, unpadded — the shape the Worker's unb64url() expects."""
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def main() -> int:
    if not sys.stdin.isatty():
        print('Refusing to read a password from a pipe — run this in a terminal.',
              file=sys.stderr)
        return 2

    pw = getpass.getpass('New admin password: ')
    if len(pw) < 12:
        print('\nToo short. Use at least 12 characters — this is the only thing\n'
              'standing between the internet and every study plan you publish.',
              file=sys.stderr)
        return 1
    if pw != getpass.getpass('Repeat it: '):
        print('\nThose did not match.', file=sys.stderr)
        return 1

    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, ITERATIONS, dklen=32)
    stored = f'pbkdf2${ITERATIONS}${b64url(salt)}${b64url(digest)}'

    print('\nADMIN_PASSWORD_HASH  (paste as a Secret, not a Variable)\n')
    print(stored)
    print('\nSESSION_SECRET  (paste as a Secret — a fresh random one, use it once)\n')
    print(secrets.token_urlsafe(48))
    print('\nBoth go in the Worker under Settings -> Variables and Secrets.')
    print('Changing SESSION_SECRET later logs every admin session out immediately,')
    print('which is how you revoke access if a laptop goes missing.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
