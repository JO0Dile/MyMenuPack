# Plans feed

`index.json` is what every installed copy of the app checks (Settings → "🔄 Check
for updates", plus a quiet check on startup) to pick up new or updated official
study plans without needing an app update. It's served as a plain static file —
no backend, no database, just this JSON file living next to `plan.html`.

## How a submission becomes part of the feed

1. A student uses **📨 Contribute** inside the app. That downloads their plan as
   a `.json` file and (if `APP_GITHUB_REPO` is set in `plan.html`) opens a
   pre-filled GitHub issue to attach it to.
2. Someone with write access to this repo reviews the submission, drops the
   plan JSON into this folder (e.g. `plans/hearing-speech.json`) as a reference
   copy, and adds an entry for it to `plans/index.json` (see shape below).
3. Push to the branch GitHub Pages deploys from. Every app instance picks up
   the change automatically next time it checks the feed — nothing to
   re-publish or resubmit on the student's end.

## `index.json` shape

```json
{
  "updatedAt": "2026-07-19T00:00:00Z",
  "plans": [
    {
      "id": "hearing-speech",
      "version": 1,
      "majorName": {
        "en": { "big": "Hearing and Speech", "small": "Speech-Language Disorders" },
        "ar": { "big": "السمع والنطق", "small": "اضطرابات النطق واللغة" }
      },
      "icon": "🦻",
      "bio": { "en": "...", "ar": "..." },
      "university": "aaup",
      "college": { "en": "Faculty of ...", "ar": "كلية ..." },
      "structure": { "years": [{ "id": "y1", "hasSummer": false }] },
      "courses": [
        {
          "id": "course-slug",
          "name": "Course Name",
          "ar": "اسم المساق",
          "creditHours": 3,
          "category": "core",
          "yearId": "y1",
          "semester": "s1"
        }
      ],
      "prerequisites": [["prereq-course-slug", "course-slug"]]
    }
  ]
}
```

- `id` must be unique across the whole feed — it's the plan's permanent slug.
- Bump `version` (a plain increasing integer) whenever you update a plan
  already in the feed; the app only overwrites its local copy when the
  feed's version is higher, and only if the *user themselves* never edited
  that plan (their own edits always win — a feed update never clobbers them).
- `category` must be one of: `skills`, `core`, `math`, `dept`, `eng`, `uni`, `free`.
- `semester` must be one of: `s1`, `s2`, `summer`.
- Every text field is HTML-escaped and every id is re-slugified by the app on
  ingest, so malformed or hostile input in a submission can't do anything
  worse than fail to import cleanly — still worth reviewing submissions
  before merging them, same as any other user-submitted content.
