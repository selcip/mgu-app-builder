# 02: Editor state in a Zustand store

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Move App's state (history, selected screen, selection, view settings, clipboard, drag op, shown language, trying, reports, refusal messages) into a Zustand store under `store/`, with `edit(op)` keeping its refusal contract. App and panels read from the store. Nothing visible changes.

**Blocked by:** 01

**Status:** resolved

- [x] Edit, undo, redo, refusal and fall-back-to-first-screen logic is tested in Node without React
- [x] No panel receives the document or `edit` through props from App
- [x] npm test passes

## Comments

2026-11-03: `designer/src/store/editor.ts` is the store (zustand/vanilla, no React; derived selectors `docOf`, `fileOf`, `screenOf`, `elementOf`, `languageOf`, `canUndoOf`, `canRedoOf`), and `store/react.tsx` is its React binding (`EditorProvider`, `useEditor(selector)`, `useActions()`). `App` takes an optional `store`, which the Storybook decorator will use. The store now does what `App` used to: the selected screen follows a rename and falls back to the first screen when it goes, the selection follows element renames and drops deleted elements, and stopping trying returns to the walked screen. App's screen list and screen settings moved to `Screens.tsx`, its element list to `Elements.tsx`, and the stage, preview and palette to `Stage.tsx`. `CanvasSettings`, `Clipboard`, `Report` and `shownLanguage` moved into the store. `test/editor-store.test.js` has 8 Node tests. `npm test`: 207 pass, 0 fail, 3 skipped (Node 8). A Playwright smoke check of the build passed: palette add, canvas drag, Ctrl+Z/Ctrl+Shift+Z, refusal message, rename follow, try and stop, autosave restore.
