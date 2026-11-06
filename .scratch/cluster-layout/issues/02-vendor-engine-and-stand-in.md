# 02: Vendor the engine and the stand-in

**What to build:** This repo holds a pinned, unmodified copy of the apps repo's engine (shared drawing code), the stand-in modules from ticket 01 and the baked fonts, with a record of the source commit and each file's blob id, a sync script, and a test that checks the copy against a local apps-repo clone (skipped without one). A Node test runs the GT3 layout through the engine against the in-memory stand-in (no socket) and gets a frame. This settles the spec's open assumption that the engine bundles with shims alone; if it does not, record what the apps repo must make injectable.

**Blocked by:** 01

**Status:** resolved

- [x] Vendored folder with a pin record, never edited here
- [x] A sync command updates it from the apps repo at a given commit; the sync test fails when the copy has drifted
- [x] The engine's Node-only pieces (socket, file access, kit context) are shimmed for the browser, with an in-memory pipe in place of the socket
- [x] A Node test draws GT3 and checks the layers it registers
- [x] AGENTS.md names the vendored folder and its rules

## Resolution

Vendored from apps branch `cluster-layout-bench` at ac96ae57fb6fee78a307d8602fde3791374a5ec2 into `engine/` (`npm run sync-engine`, `test/sync-engine.test.js`). The assumption holds: shims alone are enough, nothing in the apps repo needs to become injectable for this. What the engine needs from Node, and how it is met (`cluster/`):

- `net`: `cluster_render_client.js` calls `net.connect(path)`; `cluster/shims/net.js` returns an in-memory pipe into `createRenderer().connect()`.
- `fs`: `hud.js` (`existsSync` of the socket path, status row only), `layouts.js` (`existsSync`, `readFileSync`, `mkdirSync`, `watch` of `<data>/layouts`), `kit/pack.js` (the plain `hud/` folder: fonts, since there is no `.pack`). A memory `fs` holds the layout as `<data>/layouts/<name>.json` (a same-name file overrides the built-in, so no built-in layouts are vendored) and the fonts; `fs.watch` callbacks fire when `setLayout` writes.
- `events`, `path`, `zlib` (pack.js, never reached without a `.pack`), `Buffer`, `process.env`, `__dirname` (hud_data.js): small shim, browser package or bundler define.
- The kit's ctx: `settings` (schema from the vendored app.json, our layout added to the `hudLayout` choice; `byMode` off, `demo` off by default), `signals.watch` (records the watchers; `feed` calls them with raw SOME/IP values), `log`, `spec`, `dataDir`.
- `./kit/diag` and `./kit/dids` (engine-unit boost, only when `config.dme` is set): not vendored; resolved to a stub that throws, and the host drops `dme` from the config.
- Timers: `kit/car.js` starts a 50 ms interval it never clears, so the host records timers it starts and `stop()` ends them. The engine reads `Date.now()` freely; a golden comparison of frames will need a fixed clock (the apps bench uses `bench/test/fixed-clock.js`).

Tests: `test/cluster-engine.test.js` (GT3 registers the 8 layers the apps golden lists, pixels, status row, refusal reason, layer cap, a setting, a fed signal), `test/cluster-bundle.test.js` (the `virtual:cluster-engine` bundle, built by the Vite plugin, runs GT3 in Node with no Node requires left). Not proved here: the WebGL stage in a browser (ticket 04), frame equality with the apps recording (the golden ticket).
