# 05: Canvas editing

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author lays out elements directly on the canvas: drag widgets from the palette onto a screen, move and resize elements with the mouse and the arrow keys, type exact x, y, width and height, snap to a grid, to other elements' edges and to guides, see the 8 px focus-ring margin around each element and the screen's edges, select several elements to move, align or delete them together, copy and paste elements within and between screens, and undo and redo every edit.

**Blocked by:** 04

**Status:** resolved

- [x] Dragging a widget onto a screen adds an element where it was dropped
- [x] Moving and resizing with mouse and arrow keys, and typing exact boxes, all go through document-model operations
- [x] Snapping to grid, edges and guides works while dragging and resizing
- [x] The focus-ring margin is shown for every element and the screen's edges
- [x] Multi-select move, align and delete; copy and paste within and between screens (pasted names stay unique)
- [x] Undo and redo cover every edit, tested on the document model
