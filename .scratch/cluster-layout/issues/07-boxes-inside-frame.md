# 07: Boxes inside the GT3 frame

**What to build:** Each box in a boxes widget is an element, a child row under its widget in the element list. The author selects, moves, resizes, adds, deletes and reorders them on their own; edits write back into the widget's list, within the engine's limit on boxes per widget.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Inner boxes appear as child rows and are selectable on the canvas
- [ ] Move, resize, add, delete and reorder, each one undo step
- [ ] Adding past the engine's limit is refused with a reason
- [ ] The saved widget's list changes only where the author edited
- [ ] Model and browser tests cover the above
