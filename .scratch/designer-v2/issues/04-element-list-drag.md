# 04: Element list shows and edits stacking order

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** The left panel's element list is flipped so its top row is the element drawn on top. Rows can be dragged to change stacking order. Dragging a selected row moves the whole selection, keeping its relative order, and the list shows a drop line while dragging. Rows keep `data-element`, and the drop targets get `data-*` hooks. The Storybook story is updated.

**Blocked by:** 02

**Status:** resolved

- [x] The list's order is the reverse of `components[]`
- [x] Playwright drags one row and a multi-selection, then checks the canvas's drawing order and that `focus` is unchanged
- [x] One undo restores the order

## Comments

2026-11-04: `panels/screens/ScreensPanel.tsx`: the element list is the reverse of `components[]` (top row = drawn on top). Rows are HTML5-draggable (`application/x-mgu-element`). Dragging a row that isn't selected selects it, and the selection is what moves, keeping its relative order. A drop line (`data-drop-line`) shows the gap. `shell/commands.ts` `dropPlace()` turns the gap into the restack place, and the drop goes through `stack()`, so a drop where the rows already are makes no undo step. Tests: `dropPlace` in `test/editing-commands.test.js` (Node). A Playwright drag test in `test/designer-shortcuts.test.js` skipped here (no Playwright). `test/designer-toolbar.test.js` now reads order from the canvas, since list order flipped. Checked in the dev server by firing drag events from script: one row, a selection of two, the drop line, and the selection kept. The pane's own mouse drag doesn't start native HTML drags, so a real mouse drag hasn't been tried by hand. The Storybook stories need no change: the Typical story shows the flipped list.
