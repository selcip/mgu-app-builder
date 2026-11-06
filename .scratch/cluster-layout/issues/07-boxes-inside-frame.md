# 07: Boxes inside the GT3 frame

**What to build:** Each box in a boxes widget is an element, a child row under its widget in the element list. The author selects, moves, resizes, adds, deletes and reorders them on their own; edits write back into the widget's list, within the engine's limit on boxes per widget.

**Blocked by:** 05

**Status:** resolved

- [x] Inner boxes appear as child rows and are selectable on the canvas
- [x] Move, resize, add, delete and reorder, each one undo step
- [x] Adding past the engine's limit is refused with a reason
- [x] The saved widget's list changes only where the author edited
- [x] Model and browser tests cover the above

## Resolution

Each entry of a boxes widget's `boxes` array is a child element of the widget in the layout-as-screen (`model/ops/cluster-boxes.ts`: name `<widget id>/<box id>`, `parent` = the widget, `box` = the entry itself, listed right after its widget), so the canvas (`Canvas` draws them as dotted elements with `data-canvas-child`; a selected box is raised above the widgets over it so it can be dragged), the list (child rows `data-element-box` / `data-parent`, indented, not draggable) and the commands serve them unchanged. `setBoxes`, `moveElements`, `alignElements` and `deleteElements` in `cluster-elements.ts` resolve box names too (deleting a widget takes its boxes; selecting the parent works as before); `restackElements` on boxes reorders the widget's array only (`stackScope`, also used by `canStack`); `addBox` (new `clusterBoxOps`, one line in `operations.ts`) adds on top under a unique id (`box1`, ...) and is refused past `MAX_BOXES` with the engine's limit as the reason. The inspector's Boxes section (`panels/layout/BoxesSection.tsx`) shows `n of 12` and an Add box button. Redraw while dragging goes through `setLayout` unchanged.

Tests: `test/cluster-boxes-model.test.js` (Node: list, move/resize keeps key order, add/limit/undo, delete, reorder, round trip) and `test/designer-cluster-boxes.test.js` (Chromium on GT3: child rows, select, drag, resize, engine canvas changes and undo restores, delete, add to 12 then refused, saved file differs only in the edited box).

Notes. The limit is a constant (`MAX_BOXES` = 12) pinned to the engine by a test that reads `u_box[N]` in `engine/shared/shaders.js` and the `.slice(0, N)` in `hud.js`: the model runs in Node and in the browser, and the engine does not export the number. A box cannot be pasted on its own (refused with the reason; copying a widget copies its boxes; Ctrl+A selects widgets only; the marquee skips boxes). Boxes are listed for every boxes widget, not only GT3's. Entries of `boxes` that are not objects are not elements, and a reorder rewrites the array without them. A box under a widget (the labels sit on the boxes) is reached by its list row or where no widget covers it. The shift-light "try" golden test failed intermittently on load, also before this change.

