# 12: Locked backdrop elements (M and Sport)

**What to build:** The whole-theme shaders of M and Sport (backdrop, rev blade) open as one locked element each. The author can move, resize, condition, stack and delete it, but its internals are read-only in the inspector, with a note on what it draws and why it is locked. M and Sport can be opened, edited around the locked element, and saved.

**Blocked by:** 05

**Status:** resolved

- [x] M and Sport open with their backdrop shown as a locked element
- [x] Locked internals cannot be edited; the inspector says what it draws
- [x] Move, resize, condition, stack and delete work on it
- [x] Saved file keeps the shader's parameters exactly
- [x] Model and browser tests cover it

## Resolution

`mdash`, `mtach` (M: the backdrop and both rev bars) and `sdash` (Sport) open as locked elements: `Element.locked` is set by `layoutScreen`, the list shows a lock marker (`data-lock-marker`, row `data-locked`), and `LayoutInspector` shows a Locked section (`data-locked-note`: what it draws and why it is locked) with the parameters read-only in a `<pre>` (`data-locked-params`). New module `model/ops/cluster-locked.ts` holds the table, `lockedNote` and `assertEditable(widget, what)` for later operations (tickets 06/10 should call it before editing a widget's options; a condition, `toggle`/`themes`, is not an internal and needs no refusal).

Decision: move and resize are NOT offered. Inside the widget the engine's numbers are target px (mdash and mtach subtract the box from absolute positions, sdash does not), so changing x, y, w, h clips or shifts the drawing against its own geometry, and rewriting the numbers is editing internals. `setBoxes`, `moveElements`, `alignElements` and `pasteElements` (so duplicate and copy-paste, which would stack a second backdrop on the first) refuse a locked element with an EditError naming it; a mixed selection is refused whole. Select, stack, delete and (when ticket 10 lands) condition work. The canvas selects a locked element on click but starts no drag and shows no resize handles; the Arrange fields and arrow keys still try and show the refusal in the toolbar alert. This departs from the ticket's "move, resize" and the spec's story 28; undoing it later means giving each type a translate rule.

Tests: `test/cluster-locked-model.test.js` (Node: refusals, allowed operations, parameters byte-equal, M and Sport round trip), `test/designer-cluster-locked.test.js` (Chromium: M and Sport marker, note, parameters, refused edit, edit elsewhere and download equal but for it). Not proved: the condition picker on a locked element (ticket 10), the look of the note on the canvas at other panel sizes.
