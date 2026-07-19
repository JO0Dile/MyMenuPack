# Publishing to Google Play

The app itself (`plan.html` + `manifest.json` + `sw.js`) is a complete,
installable PWA already — no build step. Getting it onto Google Play is a
packaging step on top of that, and it needs a few things only you can do
(a Google account, a one-time $25 Play Console registration fee, and your
own signing key). This doc is the checklist for that part.

## 1. Host the app somewhere with HTTPS

Google Play requires a real HTTPS URL to wrap (Trusted Web Activity — TWA).
`.github/workflows/pages.yml` in this repo deploys the `app/` folder to
GitHub Pages automatically — see that workflow's comments for the one manual
Settings toggle it needs. Once that's live you'll have a URL like
`https://<your-username>.github.io/<repo>/plan.html`.

## 2. Install Bubblewrap

[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) is Google's own
CLI for turning a PWA into a signed Android app (it wraps the TWA
boilerplate for you — no Android Studio required).

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://<your-pages-url>/manifest.json
```

It'll ask a few questions (package name like `com.yourname.studyplans`, app
name, etc.) and generate an Android project plus **create a signing
keystore for you** — back that keystore file up somewhere safe immediately;
losing it means you can never update the app again under the same listing.

## 3. Wire up Digital Asset Links

The TWA needs to prove it's allowed to open your site without browser
chrome. Bubblewrap prints the SHA-256 fingerprint of the keystore it just
made — copy it into `.well-known/assetlinks.json` in this folder (replacing
both placeholders), then push so it's live at
`https://<your-pages-url>/.well-known/assetlinks.json`.

```bash
keytool -list -v -keystore android.keystore -alias android | grep SHA256
```

## 4. Build and test the app

```bash
bubblewrap build
```

This produces an `.apk` (for testing on a device/emulator via
`adb install app-release-signed.apk`) and an `.aab` (the Android App
Bundle you actually upload to Play Console).

## 5. Play Console listing

1. Register at [play.google.com/console](https://play.google.com/console)
   (one-time $25 fee).
2. Create a new app, choose **Free**.
3. Upload the `.aab` from step 4 under Production (or Internal Testing
   first, which is recommended — lets you install it via a private link
   before it's public).
4. Fill in the store listing: icons are already generated in `icons/`
   (`icon-any-512.png` works as the 512×512 Play Store icon), you'll still
   need a feature graphic (1024×500) and a couple of screenshots — take
   those from the running app.
5. Fill in the required Data Safety form. This app stores everything in
   the browser's own `localStorage` (progress, GPA, custom plans) — nothing
   is transmitted anywhere except the anonymous `GET` requests for
   `plans/index.json` when checking for study-plan updates. No accounts,
   no personal data collection.
6. Submit for review.

## Updating the app later

Since it's a TWA, most updates (new study plans, UI changes, bug fixes)
don't need a new Play Store submission at all — they're just a normal push
to this repo, live on Pages within minutes, and every installed copy picks
them up next time it opens (same as any website). You only need to repeat
steps 4–5 above if you change `manifest.json` in a way that affects the
native shell (app name, icon, orientation) or want to bump the Android
`versionCode`.
