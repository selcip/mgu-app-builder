# 04: Draw a cluster layout on the canvas with the real engine

**What to build:** An open cluster layout is drawn on the canvas at 1920x720 by the vendored engine running in the browser, with the canvas's zoom, pan and fit-to-view. A layout the engine refuses opens with the engine's own reason shown. A golden test requires the Designer's frames to equal the apps repo's recording of the same layout.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] GT3, Sport, M and the grid draw on the canvas, image layers as pixels and effect layers with their real shaders
- [ ] Zoom, pan, fit-to-view and the usual shortcuts work
- [ ] A refused layout shows the engine's reason instead of a blank canvas
- [ ] Playwright golden test: Designer frame equals the apps repo's recording for each layout (skipped without Playwright)
- [ ] The Designer is still a static site; no server is needed
