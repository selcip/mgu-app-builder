# 05: "From design to car" guide

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** A short guide in the Designer, opened from Help in the main menu and linked from Download. It covers: Download gives `screens.json` and `images/`; unzip them into the starter's `app/`; handle actions and set values in `main.js` (`rt.on('action')`, `rt.on('screen')`, `rt.set`); give the app its id and tile; `node tools/build.js`. It points to `starter/README.md` for the details and the emulator walkthrough.

**Blocked by:** none

**Status:** resolved

- [x] Reachable from Help and from Download (each with a `data-*` hook, covered in Playwright)
- [x] Wording follows `GLOSSARY.md` (screen file, not screens.json, except as the file's name)

## Comments

2026-11-04: `designer/src/shell/Guide.tsx` is a shadcn dialog (`components/ui/dialog.tsx`, added with `npx shadcn add dialog`; hook `data-guide`). It opens from the main menu, both under Help (`data-menu-guide`) and right under Download (`data-menu-to-car`). It covers download → unzip into the starter's `app/` → `rt.on('action')`, `rt.on('screen')`, `rt.set` → id, title and tile → `node tools/build.js`, and points to `starter/README.md`. Checked by eye in the dev server. A Playwright test in `test/designer-toolbar.test.js` skipped here (no Playwright). AGENTS.md mentions the guide and the canvas's right-click menu.
