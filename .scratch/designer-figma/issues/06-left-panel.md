# 06: Left panel: Screens and Elements

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Rebuild the screen list (first-screen and dead-link markers, add screen) and the element list (multi-select with Shift/Ctrl, widget label) as one left panel in shadcn, Screens above Elements, with stories over the fixtures.

**Blocked by:** 05

**Status:** resolved

- [x] Stories cover the typical and dead-links fixtures
- [x] `data-screen` and `data-element` hooks are kept

## Comments

2026-11-03: The left panel ("Screen file") holds Screens and Elements as two sections, in `designer/src/panels/screens/ScreensPanel.tsx`. Screens is a list with the first screen (home icon) and dead links (warning icon) marked, and + to add one (`data-add-screen`). Elements is a layer list with each widget's icon and label, and Shift/Ctrl/Cmd for multi-select. Shared pieces (`Section`, `Row`, `Hint`, `listRowClass`, `selectClass`) are in `components/designer/form.tsx`. Stories: `ScreensPanel.stories.tsx` (Empty, Typical with two selected, DeadLinks). Screen settings and the palette stay in the left panel until issues 07 and 09 move them. `data-screen`, `data-element` and `aria-current` are kept.
