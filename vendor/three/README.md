# Vendored three.js 0.185.1

MIT, © the three.js authors. Source only — none of this is served.

`tools/build-scene.mjs` tree-shakes and minifies exactly the parts
`web/scene/` imports into `web/bundles/landing-scene.js`, which is the only
thing that reaches a browser. It is vendored rather than fetched so the build
needs no network, like everything else here.

Upgrading: replace `build/` and the `examples/jsm/` files listed in
`tools/build-scene.mjs`, then rerun it and check the reported bundle size.
