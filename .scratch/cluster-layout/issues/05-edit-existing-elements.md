# 05: Edit existing elements

**What to build:** On the cluster canvas the app author selects, moves, resizes, deletes, duplicates, copies and pastes the elements of an open layout, changes their stacking order, and undoes and redoes every step. The element list and inspector show each element's name, box and widget kind. Edits redraw through the engine at once. GT3 is fully editable.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Select (single and multiple), move and resize on the canvas with the usual snapping
- [ ] Delete, duplicate, copy and paste
- [ ] Stacking order from the element list and the four commands, as for screens
- [ ] Every operation is one undo step; model tests cover each, and refusals
- [ ] Saved file contains only what the author changed
- [ ] Browser test drives move, resize and undo by `data-*` hooks and ARIA roles
