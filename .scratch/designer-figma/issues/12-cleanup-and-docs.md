# 12: Remove the old stylesheet; update AGENTS.md

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Delete `styles.css` and the components it no longer serves, and update the Designer paragraph of AGENTS.md (store, shell, panels, Storybook, the data-hook rule for tests).

**Blocked by:** 06, 08, 10, 11

**Status:** resolved

- [x] No unused CSS or components remain
- [x] AGENTS.md describes the new layout
- [x] npm test passes

## Comments

2026-11-03:
- **Stylesheets:** `styles.css` and `autosave.css` are gone. What is left is `designer/src/canvas/canvas.css`, the HMI page and the layout overlay, which the spec keeps as CSS. The restore dialog, messages and preview log are Tailwind, and the base comes from shadcn's (Geist).
- **Removed:** the unused shadcn badge, label and separator.
- **Folders:** the loose files moved into place, with every relative import rewritten. The stage, overlay and focus numbers went to `canvas/`; properties, rows, icons, pictures and languages to `panels/inspector/`; Try and autosave to `shell/`; CommitInput to `components/designer/`.
- **AGENTS.md:** the Designer paragraph now describes the store, shell, canvas, panels, styling and Storybook. A new bullet gives the browser-test rules: own build folder, `data-*` hooks only, native controls kept native.

`npm test`: 245 pass, 0 fail, 3 skipped (Node 8). All 16 stories render without page errors in the static Storybook build.
