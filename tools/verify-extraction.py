#!/usr/bin/env python3
"""
Prove the extracted JSON lost nothing.

Counts matching is not proof — a swapped name or a dropped Arabic title keeps
the count identical. This re-reads the live app and compares every field of
every course, and the full prerequisite set, against what was written to disk.
Any mismatch is a hard failure.

Run:  python3 tools/verify-extraction.py
"""
import json
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parent.parent
APP = REPO / "app"
DATA = REPO / "data"
PORT = 8932
MAJORS = ["robotics", "cybersecurity", "medical", "cs"]

failures = []
checks = 0


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        failures.append(msg)


def norm_credit(v):
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "-"):
        return None
    f = float(s)
    return str(int(f)) if f == int(f) else str(f)


def main():
    srv = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=str(APP), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
            pg = b.new_page()
            pg.goto(f"http://localhost:{PORT}/plan.html", timeout=30000)
            pg.wait_for_timeout(1500)

            for prefix in MAJORS:
                pg.evaluate(f"()=>window.showPage('{prefix}')")
                pg.wait_for_timeout(250)
                live = pg.evaluate(
                    "(p)=>({info: window.__PLAN_DATA[p].courseInfo,"
                    " pre: window.__PLAN_DATA[p].basePrereqs})", prefix)

                path = DATA / "aaup" / "majors" / f"{prefix}.json"
                doc = json.loads(path.read_text(encoding="utf-8"))
                by_slug = {c["slug"]: c for c in doc["courses"]}

                # --- every source course survived, with identical fields ---
                check(len(by_slug) == len(live["info"]),
                      f"{prefix}: course count {len(by_slug)} != source {len(live['info'])}")

                for slug, meta in live["info"].items():
                    c = by_slug.get(slug)
                    if c is None:
                        failures.append(f"{prefix}: course '{slug}' MISSING from JSON")
                        continue
                    src_name = (meta.get("name") or slug).strip()
                    check(c["name"] == src_name,
                          f"{prefix}/{slug}: name '{c['name']}' != source '{src_name}'")

                    src_ar = (meta.get("ar") or "").strip() or None
                    check(c["nameAr"] == src_ar,
                          f"{prefix}/{slug}: nameAr differs (json={c['nameAr']!r} src={src_ar!r})")

                    src_cr = norm_credit(meta.get("cr"))
                    check(c["credits"] == src_cr,
                          f"{prefix}/{slug}: credits {c['credits']!r} != source {src_cr!r}")

                    src_num = (meta.get("num") or "").strip()
                    expect_code = None if src_num in ("", "-") else src_num
                    check(c["code"] == expect_code,
                          f"{prefix}/{slug}: code {c['code']!r} != source {expect_code!r}")

                    # Nothing invented: a code must have come from the source.
                    check(c["code"] is None or c["code"] == src_num,
                          f"{prefix}/{slug}: fabricated code {c['code']!r}")

                # --- prerequisites: exact set equality, both directions ---
                src_pairs = {(a, b) for a, b in live["pre"]}
                json_pairs = {(p["requires"], p["forCourse"]) for p in doc["prerequisites"]}
                missing = src_pairs - json_pairs
                extra = json_pairs - src_pairs
                check(not missing, f"{prefix}: {len(missing)} prerequisites LOST: {sorted(missing)[:5]}")
                check(not extra, f"{prefix}: {len(extra)} prerequisites INVENTED: {sorted(extra)[:5]}")

                # --- every prerequisite references a course that exists ---
                for a, bb in src_pairs:
                    check(a in by_slug, f"{prefix}: prereq references unknown course '{a}'")
                    check(bb in by_slug, f"{prefix}: prereq references unknown course '{bb}'")

                # --- credit hours total is preserved ---
                src_total = sum(float(norm_credit(m.get("cr")) or 0)
                                for m in live["info"].values())
                json_total = sum(float(c["credits"] or 0) for c in doc["courses"])
                check(abs(src_total - json_total) < 0.001,
                      f"{prefix}: credit total {json_total} != source {src_total}")

                print(f"{prefix:15s} {len(by_slug):3d} courses  "
                      f"{len(json_pairs):3d} prereqs  {json_total:6.1f}H")
            b.close()
    finally:
        srv.terminate()

    print(f"\n{checks} assertions run")
    if failures:
        print(f"\n{len(failures)} FAILURES:")
        for f in failures[:40]:
            print("  -", f)
        sys.exit(1)
    print("PASS — extraction is lossless and nothing was invented")


if __name__ == "__main__":
    main()
