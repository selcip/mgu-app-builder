# 05: Edit existing elements

**What to build:** On the cluster canvas the app author selects, moves, resizes, deletes, duplicates, copies and pastes the elements of an open layout, changes their stacking order, and undoes and redoes every step. The element list and inspector show each element's name, box and widget kind. Edits redraw through the engine at once. GT3 is fully editable.

**Blocked by:** 04

**Status:** resolved

- [x] Select (single and multiple), move and resize on the canvas with the usual snapping
- [x] Delete, duplicate, copy and paste
- [x] Stacking order from the element list and the four commands, as for screens
- [x] Every operation is one undo step; model tests cover each, and refusals
- [x] Saved file contains only what the author changed
- [x] Browser test drives move, resize and undo by `data-*` hooks and ARIA roles

## Resolution

A cluster layout is seen as a screen (`layoutScreen` in `model/ops/cluster-elements.ts`: one element per widget, name = widget id, kind = widget type, the widget itself kept in `widget`), so the screens' canvas (`Canvas`, now with `design` and `rings` props; 1920x720, no focus-ring margins), element list, Arrange section, commands, keys and snapping serve both kinds unchanged. The layout has handlers under the screen operations' names (`setBoxes`, `moveElements`, `alignElements`, `deleteElements`, `pasteElements`, `restackElements`; `screen` ignored), each one undo step. Refusals: unknown element, fraction, size below 1 pixel; a box outside 1920x720 is allowed. A widget without x, y, w, h (none in the four layouts) is listed, flagged `boxless`, not drawn on the canvas, and refuses move, resize and align (deleting and stacking work). `ClusterStage` hosts `Canvas`, and redraws through `setLayout` while an edit is dragged as well as on commit. Left panel: the element list under the layout facts; right panel: `LayoutInspector` (name, widget, box and align via `Arrange`). Edit and Arrange menus apply to layouts. The clipboard remembers its document kind; screen elements and layout elements are not pasted into each other.

Tests: `test/cluster-elements-model.test.js` and `test/cluster-elements-commands.test.js` (Node), `test/designer-cluster-editing.test.js` (Chromium: list, drag move with the engine canvas following and undo restoring its pixels, handle resize, Shift-click, marquee, keys, duplicate, copy/paste, stacking by keys, menu and list drag, download equals the file opened but for the edits).

Notes. Backdrop shaders (mdash, mtach, sdash) are ordinary movable elements for now (ticket 12 locks them). Inner boxes of a boxes widget are not elements yet (ticket 07). The marquee cannot start on GT3, Sport or M while their full-cluster widget is under the pointer (a drag there moves it, as on a screen); the test deletes the frame first. widgets[] order stacks only among widgets of the same class and z in the engine (the frame is ambient, z -10, so restacking it changes nothing on the canvas); the list still shows and edits the file's order as asked. Renaming an element (its id) is not offered yet.
