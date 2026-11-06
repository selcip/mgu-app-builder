# 01: Split the bench into reusable modules (apps repo)

**What to build:** In the apps repo, separate the bench's stand-in for cluster-render from its HTTP server and page: one module for the protocol and limits (layers per connection, total layers, pixel memory, assets), one for the WebGL stage that draws layers with the app's real shaders. Neither needs a socket, a server or Node. The bench itself uses them, so behaviour there does not change. This is the stand-in the Designer will run in the browser (ADR 0005).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The two modules run without `net`, `http` or a server, and take their transport from the caller
- [ ] The bench uses them and still works for both apps (HUD Widgets and Cluster Themes)
- [ ] A recording of GT3 on the cluster before and after the split is identical
- [ ] Layer cap, 32-layer total, pixel memory and asset limits behave as before
- [ ] The bench README describes the new modules
