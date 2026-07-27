#!/usr/bin/env python3
"""
Extract university metadata and grading scales from app/plan.html.

Pulled from the running app for the same reason as the majors: these values
were verified against official AAUP tables during development and must not be
re-typed by hand.  Emits data/universities.json and data/<uni>/{university,rules}.json
"""
import json, pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "data"; PORT = 8933

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
    cwd=str(REPO / "app"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        pg = b.new_page()
        pg.goto(f"http://localhost:{PORT}/plan.html", timeout=30000)
        pg.wait_for_timeout(1200)
        unis = pg.evaluate("()=>window.APP_UNIVERSITIES||{}")
        colleges_reg = pg.evaluate("()=>window.APP_COLLEGES||{}")
        electives = pg.evaluate("()=>window.APP_UNIV_ELECTIVES||{}")
        scales = pg.evaluate("""()=>({
          engineering: window.AAUP_GPA.ENGINEERING_NUMERIC_GRADE_RANGES,
          ai: window.AAUP_GPA.AI_NUMERIC_GRADE_RANGES,
          points: window.AAUP_GPA.GRADE_POINTS
        })""")
        b.close()
finally:
    srv.terminate()

def bands(ranges, points):
    return [{"letter": r["grade"], "min": r["min"], "max": r["max"],
             "points": points.get(r["grade"])} for r in ranges]

index = []
for uid, u in unis.items():
    name = u.get("name") if isinstance(u.get("name"), str) else (u.get("name") or {}).get("en")
    nameAr = None if isinstance(u.get("name"), str) else (u.get("name") or {}).get("ar")
    # Colleges live in their own registry keyed by college id, each carrying
    # the university it belongs to — not nested under the university.
    colleges = {cid: c for cid, c in colleges_reg.items()
                if c.get("university") == uid}
    index.append({"slug": uid, "name": name or uid, "nameAr": nameAr,
                  "shortName": u.get("shortName"), "icon": u.get("icon"),
                  "collegeCount": len(colleges)})
    d = DATA / uid; d.mkdir(parents=True, exist_ok=True)
    (d / "university.json").write_text(json.dumps({
        "schemaVersion": 1, "slug": uid, "name": name or uid, "nameAr": nameAr,
        # Not present in the source data. Left null rather than guessed —
        # a wrong country or website is worse than an absent one.
        "shortName": u.get("shortName"),
        "icon": u.get("icon"),
        "website": u.get("website"),
        # Not present in the source data. Left null rather than guessed — a
        # wrong country or logo is worse than an absent one.
        "country": None, "logoUrl": None, "description": None,
        "colleges": [{"slug": cid,
                      "name": (c.get("name") or {}).get("en"),
                      "nameAr": (c.get("name") or {}).get("ar"),
                      "icon": c.get("icon")}
                     for cid, c in colleges.items()],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rules = {"schemaVersion": 1, "gradingScales": [], "universityElectives": []}
    if uid == "aaup":
        rules["gradingScales"] = [
            {"slug": "engineering", "name": "Engineering (D at 60)",
             "passMark": 60, "bands": bands(scales["engineering"], scales["points"])},
            {"slug": "ai", "name": "Faculty of AI & Data Science (D at 50)",
             "passMark": 50, "bands": bands(scales["ai"], scales["points"])},
        ]
    rules["universityElectives"] = electives.get(uid, [])
    (d / "rules.json").write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n",
                                  encoding="utf-8")
    print(f"{uid:10s} {len(colleges)} colleges, {len(rules['gradingScales'])} scales, "
          f"{len(rules['universityElectives'])} university electives")

(DATA / "universities.json").write_text(
    json.dumps({"schemaVersion": 1, "universities": index}, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8")
print(f"\nindex -> data/universities.json ({len(index)} universities)")
