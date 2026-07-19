# Collected plans (holding area — not live)

Auto-collected plans land here as `<plan-id>.json`, one file per plan, when
the app's auto-collect is turned on (see [`../../../COLLECTING.md`](../../../COLLECTING.md)).

**These are NOT shown to students.** They're a review queue for the maintainer.
To publish one to the live feed every app reads, copy its inner `plan` object
into [`../index.json`](../index.json) following
[`../../../MAINTAINING.md`](../../../MAINTAINING.md).

Each file contains plan **structure only** — college, courses, prerequisites —
never any student's progress, GPA, grades, name, or ID.

Delete files here freely: removing one just clears it from the review queue and
has no effect on the live app.
