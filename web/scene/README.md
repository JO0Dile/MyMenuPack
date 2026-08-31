# The landing scene

`web/scene/` is the source. `web/bundles/landing-scene.js` is the build, and
the only thing a browser fetches. Build it with:

    npm i --no-save esbuild        # once
    node tools/build-scene.mjs

three.js is vendored under `vendor/three` so the build needs no network.

## Why it is a separate module

Everything else in this app is concatenated into `web/bundles/*.bundle.js`
and precached by the service worker, because the app's whole promise is that
it opens instantly and works with no signal. This scene is far too large to
sit in that shell — it is roughly as big as the rest of the app's JavaScript
put together.

So it is loaded on demand, by `web/js/55-onboarding.js`, only when the
landing screen is actually shown, and it is *not* in the service worker's
precache list. The worker's ordinary cache-first handler stores it on the
first fetch, so it is offline from the second visit like everything else, and
a returning student who never sees the landing screen never pays for it.

## Layout

    core/        Quality, Timeline, Easing, PerformanceGovernor,
                 LoadingManager
    camera/      CameraController  — LOCKED, see the header in that file
    env/         CosmicSky (the deep field, the stars, the planets),
                 LightingRig
    materials/   TextureFactory (every map is drawn, none is downloaded),
                 MaterialLibrary
    build/       Architecture (the shared detail primitives), Plaza,
                 Landmark
    water/       FountainSystem
    ui/          GlassPanel — the sign-in surface, as an object in the world
    post/        AestheticPostProcessing
    main.js      assembly, choreography, and the AAUP_CAMPUS3D contract

## What is in the scene

النافورة وطريق — the fountain and a road, on a paved disc, and around it
the universe. Nothing else: no buildings, no hill, no city. Everything that
is there is there to be looked at closely, because there is nothing else to
look at.

## The contract

`main.js` sets `window.AAUP_CAMPUS3D = { mount, stop }` — the same two
methods the previous line renderer exposed, so nothing outside had to
change, and every failure path lands in the same place: the canvas never
gets `.is-live`, the drawing already in the DOM stays visible, and the
student signs in exactly as before.
