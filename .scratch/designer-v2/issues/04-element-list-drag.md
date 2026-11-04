# 04: Element list shows and edits stacking order

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** The left panel's element list is flipped so its top row is the element drawn on top. Rows can be dragged to change stacking order. Dragging a selected row moves the whole selection, keeping its relative order, and the list shows a drop line while dragging. Rows keep `data-element`, and the drop targets get `data-*` hooks. The Storybook story is updated.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The list's order is the reverse of `components[]`
- [ ] Playwright drags one row and a multi-selection, then checks the canvas's drawing order and that `focus` is unchanged
- [ ] One undo restores the order
