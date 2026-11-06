# 09: The car's view and visibility warnings

**What to build:** A toggle on the canvas masks what the driver cannot see (the hood curve over the top corners, BMW's gear box and the seat-belt light), using the engine's own geometry. Each element that sits under one of them gets a warning with the reason.

**Blocked by:** 05

**Status:** resolved

- [x] The car's view toggle draws the three masks at the measured positions
- [x] A warning with the reason on each element hidden by the hood, gear box or belt light, in the element list and inspector
- [x] Dragging an element under the hood adds its warning; moving it away removes it
- [x] Warnings never block saving
- [x] Warnings equal the engine's layout check (test)

## Resolution

`canvas/CarView.tsx`: a `Car's view` switch (ARIA role switch, `data-car-view-toggle`, on by default, state local to `ClusterStage`) shows an SVG layer (`data-car-mask` hood, gear-box, belt) above the engine canvas inside the same page, so zoom and pan carry it; it is not drawn into the engine's canvas, so the pixel goldens and the saved file are untouched. The geometry is the engine's `visible.js`, exported from the `virtual:cluster-engine` bundle as `cluster.visible`. `model/visibility.ts` (`warningsOf`, `masksOf`; the `visible` module is passed in, so Node tests use the file itself) gives the reasons per widget id by running `check()` on each widget, which equals the layout check's lines (prefix cut). `useWarnings()` applies the drag in progress, so the warning appears and goes while dragging; the element list shows a warning mark (`data-warning`, title = reasons) and `LayoutInspector` a Warnings section (`data-warning-text`). Nothing blocks saving.

Tests: `test/cluster-visibility.test.js` (Node: equal to `check()` for GT3, Sport, M and the grid; moves under hood, gear box and belt light add and remove the warning; mask geometry), `test/designer-cluster-carview.test.js` (Chromium: masks at the measured positions, switch, drag under the hood shows the warning mid-drag, undo and box fields remove it, download still works and equals the original with the switch on or off).

Notes. Warnings come from `check()` per widget, not from the scene's per-layer warnings (layers carry refs, not widget ids, and one widget such as GT3's frame registers several). Like `check()`, they ignore a widget's condition and layer visibility. The hood label sits at the bench's fixed position. Not proved: appearance beside the car's real photos.
