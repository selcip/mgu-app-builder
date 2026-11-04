# 09: Toolbar: file, insert, view and zoom

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Fill the toolbar: a file menu (New, Open, Download), undo/redo, a searchable insert menu for widgets (click to add, or drag onto the canvas), a View menu (grid size, snap, guides, show focus order) and a zoom control. Remove the old palette and what is left of the edit bar.

**Blocked by:** 04

**Status:** resolved

- [x] Every widget in the catalog can be added from the insert menu by click or drag
- [x] Grid, snap, guides and focus order are toggled from the View menu

## Comments

2026-11-03: The toolbar (`designer/src/shell/Toolbar.tsx`), from left to right:
- **Main menu** ("mgu Designer ▾", `data-main-menu`): New, Open…, Download, then Undo, Redo, Copy, Cut, Paste, Duplicate, Delete and Select all, with their shortcuts shown.
- **Insert** (+, `data-insert`): a searchable popover of every catalog widget. Click to add, Enter adds the first match, or drag a widget onto the screen.
- Undo and redo icons, the messages, the shown language.
- **View menu** (`data-view-menu`): a Grid submenu (off, 4, 8, 16, 32), Snap, focus numbers, and adding or removing guides.
- The zoom control.

The Open file input stays a hidden `<input type=file>` in the header, outside the menu (`data-open-input`). The edit bar and the left panel's palette are gone. The editing logic is now plain functions on the store in `shell/commands.ts` (copy, cut, paste, duplicate, delete, select all, nudge, guides; `test/editing-commands.test.js`). The keys are in `shell/keys.ts`, which issue 11 extends.

Also:
- The insert menu's search now clears however the menu closes (choosing a widget left it filtered).
- The canvas now starts fitted when 100 % doesn't fit the window.

`test/designer-toolbar.test.js` (3 Playwright tests) covers it. `npm test`: 240 pass, 0 fail.
