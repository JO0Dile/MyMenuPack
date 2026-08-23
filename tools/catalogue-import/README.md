# AAUP catalogue import

Turns the university catalogue document into structured data.

    python3 extract.py   # docx  -> blocks.jsonl    (lossless, document order)
    python3 parse.py     # blocks -> catalogue.json (faculties>programs>sections>courses)
    python3 index.py     # catalogue -> courses-index.json (one entry per course code)

`blocks.jsonl` is committed, so the last two steps run without the 4.6 MB source
document.

## What is in catalogue.json
13 faculties, 67 programs, 3,076 course entries, 1,797 distinct courses.

Requirement sections per program: `univReq`, `univElec`, `colgReq`, `specReq`,
`specElec`, `freeElec`, `supportCourses` — each with `mustPassAll` or
`requiredHours`, and its course list.

20 programs also carry an `advisoryPlan`: the term-by-term schedule the
university recommends, as `terms[]` of `{year, semester, statedTotal, courses}`.
This is the only place the document says *when* a course is meant to be taken.
Terms include the elective slots the student fills themselves, kept as
`{placeholder: "Univ. Elec.", credits: 2}` because the source names the bucket
and not a course.

## from-images/
Six Junior College diplomas exist in the document only as screenshots. They were
read image by image and are stored here in the same shape, with `advisoryPlan`
where the source has one. Every one reconciles to its stated degree total
exactly:

| program | stated | computed |
|---|---|---|
| Dental Assistance | 64 | 64 |
| Mobile Application Development | 69 | 69 |
| Property Valuation | 74 | 74 |
| Cosmetics and Skincare | 72 | 72 |
| Dental Technology | 78 | 78 |
| Occupational Health and Safety | 72 | 72 |

`program-metadata.json` holds the eight further programs whose only image is a
metadata card — no course table exists for them anywhere in the document, in
text or image. They are marked `coursesInSource: false`.

## Verification
- 0 tables containing courses left unattached to a program/section.
- 0 rows with an impossible credit value; 0 rows flagged uncertain.
- Every one of the 3,076 course codes is 9 digits, as the source prints them.
- Every course code resolves to exactly one name, and to one set of hours:
  `index.py` reports 0 courses where two programs disagree on any field.
- **49 of the 50** programs that state a degree total reconcile to it exactly.
- **182 of 182** advisory-plan terms that print a total match the courses listed
  under them. (15 further terms print no total; that is a source omission.)

## Recorded source discrepancies
Seven programs carry a `sourceIssues` array. Nothing in it is corrected — the
discrepancy is recorded so it travels with the data:

- **Bachelor in Fiqh And Law** states 133 credit hours; its sections list 223.
  The Spec. Req. table holds 55 distinct courses at 3 hours each (28 Law,
  27 Fiqh) with no duplicates and nothing bleeding in from a neighbouring
  program. The document states one total and lists another.
- Six programs whose advisory plan schedules fewer hours than the degree states
  (by 2 to 16). Every printed term total in them matches, so nothing was lost in
  parsing; the university's own recommended schedule simply does not place every
  required hour.

Two of the six image-read programs — Property Valuation and Dental Technology —
carry **two complete academic plans each**, with different course-code families
and different totals. That is deliberate: the document says so in the author's
own words ("this one have 2 academic plans 👍 first one : … now the second
plan:"). Both are stored; the one its advisory plan corroborates is primary and
the other sits under `alternatePlanA`. Dental Technology's prose states a third
figure again (69 hours), recorded in its `sourceConflict`.

## Known gaps (in the SOURCE, not the parser)
- Faculty of AI & Data Science and Faculty of Digital Sciences contain only
  program NAME lists. The document says so itself: "and already added all of
  them". Their course data must come from another source.
- Three programs print no degree total at all: Telecommunications Engineering,
  Computer Networks – Minor Information Security, and Modern Media – Digital
  Media and Communication. Their sections are captured; the total is absent, so
  it stays absent.
- Dental Technology's plan A lists a 2-hour Univ. Elec. requirement whose course
  table was never screenshotted. The required hours survive in the text; the
  eligible course list does not exist in the source.

## Nothing is inferred
A value absent from the document is absent here. Names are only ever completed
from a fuller occurrence of the SAME course code elsewhere in the document
(recorded as `nameAsPrinted` when that happens). Where the source prints
something impossible — Dental Technology's DENTAL MATERIALS shows 100 weekly
theoretical hours — the value is kept verbatim and flagged, not corrected.
