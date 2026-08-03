# Collected plans — student submissions land here

When a student uses **📨 Contribute** in the app, the collector (the
Cloudflare Worker in `collector/cloudflare-worker.js`) commits their plan into
this folder as `<id>.json`. Plan structure only — courses, years,
prerequisites — never a name, student ID, GPA, or grade.

Nothing here is published automatically. To promote a submission:

1. Review the file (names sensible? prerequisites plausible? no junk?).
2. Convert/copy it into `data/<university>/majors/<slug>.json`
   (same shape as the existing files there).
3. Rebuild the catalogue and commit both:

   ```bash
   python3 tools/build-catalogue.py    # writes web/plans.json
   ```

4. Delete the file from this folder once promoted (or leave it as a record).

> ⚠️ If you update the deployed Worker on Cloudflare, paste in the current
> `collector/cloudflare-worker.js` — older copies of the Worker committed to
> `app/plans/collected/`, a path that no longer exists.
