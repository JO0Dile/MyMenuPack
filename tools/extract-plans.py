#!/usr/bin/env python3
"""
Extract the four hard-coded built-in majors out of app/plan.html into
structured JSON that matches the StudyPlan database schema.

This reads the data through the running app rather than regex-parsing the
HTML. The app already contains a correct parser for its own format
(__registerPlanData builds courseInfo/basePrereqs, and the DOM carries the
year/semester placement and category), so reading its own structures removes
a whole class of transcription bugs that a bespoke regex pass would
introduce. This data was hand-transcribed from university PDFs and cannot be
re-derived, so fidelity matters more than speed here.

Output: data/<university>/majors/<major>.json

Run:  python3 tools/extract-plans.py
"""
import json
import os
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parent.parent
APP = REPO / "app"
OUT = REPO / "data"
PORT = 8931

# Built-in majors and the metadata the HTML carries about them. university /
# college come from the plan cards' data-university / data-college attributes.
MAJORS = ["robotics", "cybersecurity", "medical", "cs"]

# The DOM's CSS category classes -> the CourseCategory enum in the Prisma schema.
CATEGORY_MAP = {
    "core": "CORE",
    "math": "MATH",
    "dept": "DEPARTMENT_ELECTIVE",
    "uni": "UNIVERSITY_ELECTIVE",
    "free": "FREE_ELECTIVE",
    "skills": "UNIVERSITY_REQUIREMENT",
    "eng": "ENGLISH",
}

# Runs inside the page. Returns everything needed to rebuild a major without
# consulting the HTML again.
EXTRACT_JS = r"""
(prefix) => {
  const data = window.__PLAN_DATA[prefix] || {};
  const info = data.courseInfo || {};
  const page = document.getElementById('page-' + prefix);

  // Placement + category live in the DOM, not in courseInfo.
  const placement = {};
  page.querySelectorAll('.course[id]').forEach(el => {
    const parts = window.__splitCourseId(el.id);
    if (!parts) return;
    const row = el.closest('.course-row[id]');
    let year = null, semester = null;
    if (row) {
      const m = /-y(\d+)-s(\d)$/.exec(row.id);
      if (m) { year = parseInt(m[1], 10); semester = parseInt(m[2], 10); }
    }
    const cat = [...el.classList].find(c =>
      ['core','math','dept','uni','free','skills','eng'].includes(c)) || 'core';
    // A pair-group is a lecture + its lab; independent-grades means the two
    // halves are graded separately despite sharing a catalog number.
    const group = el.closest('.pair-group');
    placement[parts.slug] = {
      year, semester, category: cat,
      inPairGroup: !!group,
      independentGrades: !!(group && group.classList.contains('independent-grades')),
      // Electives sitting in a pool row have no year/semester by design.
      inElectivePool: !!el.closest('.electives-row'),
    };
  });

  // The second line of a title is an <em> that CSS renders as display:block
  // ("Artificial Intelligence and<em>Robotics</em>"), so it is a visual line
  // break with no whitespace in the markup. textContent would concatenate it
  // into "...andRobotics". Every tag becomes a space before stripping.
  const readTitle = (el) => el
    ? el.innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : null;
  const titleEl = page.querySelector('.title-block .en');
  const card = document.querySelector('.plan-card[data-page="' + prefix + '"]');

  return {
    prefix,
    name: readTitle(titleEl) || prefix,
    // The plan page renders only the English title; the Arabic one lives on
    // the Home plan card, which is the sole place it exists in the source.
    nameAr: card ? card.getAttribute('data-search-ar') : null,
    university: card ? card.getAttribute('data-university') : null,
    college: card ? card.getAttribute('data-college') : null,
    courseInfo: info,
    // basePrereqs is the shipped list, before any student correction overlay.
    prereqs: data.basePrereqs || data.prereqs || [],
    placement,
  };
}
"""


def serve(directory, port):
    p = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=directory, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)
    return p


def to_decimal_str(v):
    """Credit hours as a clean string; '-' and '' mean 'not applicable'."""
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "-"):
        return None
    try:
        f = float(s)
    except ValueError:
        return None
    return str(int(f)) if f == int(f) else str(f)


def build_major(raw):
    info = raw["courseInfo"]
    placement = raw["placement"]

    courses = []
    for slug, meta in info.items():
        pl = placement.get(slug, {})
        code = (meta.get("num") or "").strip()
        # '-' is the app's placeholder for a generic elective slot that has no
        # real catalog number. Emitted as null rather than a fake code, and
        # flagged so the importer knows it's a pool placeholder, not a course.
        is_placeholder = code in ("", "-")
        courses.append({
            "slug": slug,
            "code": None if is_placeholder else code,
            "name": (meta.get("name") or slug).strip(),
            "nameAr": (meta.get("ar") or "").strip() or None,
            "credits": to_decimal_str(meta.get("cr")),
            "theoretical": to_decimal_str(meta.get("th")),
            "practical": to_decimal_str(meta.get("pr")),
            "year": pl.get("year"),
            "semester": pl.get("semester"),
            "category": CATEGORY_MAP.get(pl.get("category", "core"), "CORE"),
            "isElective": pl.get("inElectivePool", False) or is_placeholder,
            "isPlaceholder": is_placeholder,
            "pairGroup": pl.get("inPairGroup", False),
            "independentGrades": pl.get("independentGrades", False),
            # The catalog's own prerequisite sentence, kept verbatim. The
            # structured pairs below are authoritative; this is the source text
            # they were read from and is worth preserving for auditing.
            "prerequisiteText": (meta.get("prereq") or "").strip() or None,
        })

    courses.sort(key=lambda c: (c["year"] or 99, c["semester"] or 99, c["name"]))

    prereqs = [{"requires": a, "forCourse": b} for a, b in raw["prereqs"]]

    return {
        "schemaVersion": 1,
        "slug": raw["prefix"],
        "name": raw["name"],
        "nameAr": raw["nameAr"],
        "university": raw["university"],
        "college": raw["college"],
        "degreeHours": None,  # set from the audit totals, not guessed here
        "courses": courses,
        "prerequisites": prereqs,
    }


def main():
    srv = serve(str(APP), PORT)
    results = {}
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
            pg = b.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(f"http://localhost:{PORT}/plan.html", timeout=30000)
            pg.wait_for_timeout(1500)
            for prefix in MAJORS:
                pg.evaluate(f"()=>window.showPage('{prefix}')")
                pg.wait_for_timeout(300)
                results[prefix] = pg.evaluate(EXTRACT_JS, prefix)
            if errs:
                print("PAGE ERRORS during extraction:", errs, file=sys.stderr)
                sys.exit(1)
            b.close()
    finally:
        srv.terminate()

    for prefix, raw in results.items():
        major = build_major(raw)
        uni = major["university"] or "aaup"
        dest = OUT / uni / "majors"
        dest.mkdir(parents=True, exist_ok=True)
        path = dest / f"{prefix}.json"
        path.write_text(json.dumps(major, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
        placeholders = sum(1 for c in major["courses"] if c["isPlaceholder"])
        print(f"{prefix:15s} -> {os.path.relpath(path, REPO)}  "
              f"{len(major['courses']):3d} courses "
              f"({placeholders} pool placeholders), "
              f"{len(major['prerequisites']):3d} prerequisites")


if __name__ == "__main__":
    main()
