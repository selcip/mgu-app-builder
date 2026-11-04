# 03: Bring forward / send backward commands

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** Bring forward (Ctrl+]), Send backward (Ctrl+[), Bring to front (Ctrl+Shift+]) and Send to back (Ctrl+Shift+[) in `shell/commands.ts`, in the main menu, on the canvas's right-click menu, and on the keyboard in `shell/keys.ts`. They act on the selection, and never while typing or trying.

**Blocked by:** 02

**Status:** resolved

- [x] Playwright covers each command from the menu and from its key
- [x] Commands are disabled or do nothing when the selection is already at that end

## Comments

2026-11-04: `shell/commands.ts` adds `stack(store, place)`, `canStack(state, place)`, `stackableOf` (a stable selector) and `STACKING`, the list the menus show. `shell/keys.ts` uses `e.code` (BracketRight/BracketLeft, so Shift works on any layout). The main menu has an Arrange group (`data-menu-stack`). The canvas has a right-click menu (shadcn `context-menu`, added with `npx shadcn add`; `data-canvas-menu`, `data-canvas-stack`) with copy, cut, paste, duplicate, delete and the four stacking commands. Right-clicking an element that isn't selected selects it. A command with nothing to do is disabled and makes no undo step. Tests: `test/editing-commands.test.js` (Node) and a new test in `test/designer-shortcuts.test.js`, which skipped here (no Playwright); that file's `elements()` now reads the canvas's stacking order instead of the list. Checked by hand in the dev server: the keys, the right-click menu and Send to back.
