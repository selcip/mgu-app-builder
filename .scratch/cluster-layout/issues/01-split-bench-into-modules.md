# 01: Split the bench into reusable modules (apps repo)

**What to build:** In the apps repo, separate the bench's stand-in for cluster-render from its HTTP server and page: one module for the protocol and limits (layers per connection, total layers, pixel memory, assets), one for the WebGL stage that draws layers with the app's real shaders. Neither needs a socket, a server or Node. The bench itself uses them, so behaviour there does not change. This is the stand-in the Designer will run in the browser (ADR 0005).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The two modules run without `net`, `http` or a server, and take their transport from the caller
- [x] The bench uses them and still works for both apps (HUD Widgets and Cluster Themes)
- [x] A recording of GT3 on the cluster before and after the split is identical
- [x] Layer cap, 32-layer total, pixel memory and asset limits behave as before
- [x] The bench README describes the new modules

## Resolution

Done in the apps repo on branch cluster-layout-bench (render_protocol.js, stage.js; bench golden recordings identical before and after). Not pushed.
