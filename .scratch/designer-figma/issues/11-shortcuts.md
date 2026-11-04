# 11: Figma's shortcuts

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Ctrl+Z / Ctrl+Shift+Z, Ctrl+C/V/D, Delete, arrow nudges (Shift = 10 px) and Ctrl+A, wired through the store. Text inputs keep their own keys, and while trying, keys go to the controller.

**Blocked by:** 09

**Status:** resolved

- [x] Each shortcut is covered in Playwright
- [x] Typing in a field never triggers a shortcut

## Comments

2026-11-03: The shortcuts are in `designer/src/shell/keys.ts`, on the shared commands in `shell/commands.ts`:
- Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z or Ctrl+Y redo;
- Ctrl/Cmd+C, X, V, D (duplicate) and A (select all);
- Delete and Backspace;
- arrows move 1 px, Shift+arrow moves a grid step (10 px with no grid), Alt+arrow resizes;
- Escape clears the selection.

The canvas keys (Space, zoom) are in `Viewport.tsx`, and Ctrl+\ is in `Panel.tsx`. No shortcut fires while typing in a field (input, textarea, select, contenteditable) or while trying. `test/designer-shortcuts.test.js` (3 Playwright tests) covers each shortcut, a field keeping its own keys, and trying. Also: the inspector's box fields and property panel now remount per element, so selecting another element no longer briefly shows the last one's values. `npm test` passes.
