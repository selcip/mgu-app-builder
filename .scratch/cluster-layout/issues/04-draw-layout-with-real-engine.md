# 04: Draw a cluster layout on the canvas with the real engine

**What to build:** An open cluster layout is drawn on the canvas at 1920x720 by the vendored engine running in the browser, with the canvas's zoom, pan and fit-to-view. A layout the engine refuses opens with the engine's own reason shown. A golden test requires the Designer's frames to equal the apps repo's recording of the same layout.

**Blocked by:** 02, 03

**Status:** resolved

- [x] GT3, Sport, M and the grid draw on the canvas, image layers as pixels and effect layers with their real shaders
- [x] Zoom, pan, fit-to-view and the usual shortcuts work
- [x] A refused layout shows the engine's reason instead of a blank canvas
- [x] Playwright golden test: Designer frame equals the apps repo's recording for each layout (skipped without Playwright)
- [x] The Designer is still a static site; no server is needed

## Resolution

`designer/src/canvas/ClusterStage.tsx` replaces ticket 03's placeholder: it starts `createEngine` with the open layout, feeds the apps repo's stage (`createStage`, view `panel`, 1920x720) the scene (`onChange`) and pixel rects (`onPixels`), redraws when something changed and on every frame while `stage.animated()`, and calls `engine.setLayout` when the document's layout changes. It sits in the existing `Viewport`, so zoom, pan, fit and their keys are the screens' own (the toolbar's zoom control now shows for a layout; the canvas opens fitted). A refused layout shows the engine's status row (`engine.hud.problem` set) in `[data-cluster-refusal]`. Still a static site. Every frame is announced as `mgu-cluster-frame`.

Golden (`test/designer-cluster-golden.test.js`): not a committed recording. The apps goldens are layer-stream hashes, not pixels, so the reference is built in the test: the Node engine's scene and pixels drawn by the vendored `stage.js` (kept equal to the apps checkout by the sync test) on a plain page in the same Chromium, at the time the Designer drew; Playwright's fake clock fixes `new Date()` and frame times, and Node's `new Date()` is frozen to the same minute. GT3, Sport, M and the grid are pixel-equal (WebGL works in headless Chromium). No signals are fed (the Designer has no signals until ticket 08), and none of the four layouts has an animated (`time`) effect at idle, so the `stage.animated()` redraw path is not exercised by pixels; the rename test proves a changed layout redraws. Not proved: equality with the car's cluster-render.
