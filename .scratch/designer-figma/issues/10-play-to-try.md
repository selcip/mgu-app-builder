# 10: Play button for trying

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** A Play button in the toolbar starts trying on the canvas. The editing panels hide, the report shows in its own floating panel, and stopping returns to editing the screen the walk ended on.

**Blocked by:** 05, 09

**Status:** resolved

- [x] Starting and stopping from the toolbar works as the Try checkbox did
- [x] Panels come back as they were after stopping

## Comments

2026-11-03: The toolbar's Try/Stop button (`PlayButton` in `designer/src/TryPanel.tsx`) is a `role="switch"` with `aria-checked`, so it keeps the `data-try-toggle` hook and the tests' `check()`/`uncheck()`. While trying:
- both panels step aside, and the store moves the view so the page stays put on screen;
- the insert menu and editing are off;
- the report is a card in the canvas's corner (`TryReport`, `data-try-panel`): the keys, what the runtime reported, Clear;
- Space no longer pans the canvas, because it is the controller's press.

Stopping brings the panels back as they were and returns to the screen the walk ended on. Each try starts with an empty report.

`npm test` runs test files at the same time, and with 7 browser test files their builds into the shared `designer/dist` raced, so a page could load a half-written build. Each browser test now builds into its own temporary folder through `test/designer-dist.js`. Tests: a store test for trying, and a Playwright test for Play/Stop in `designer-toolbar.test.js`. `npm test`: 242 pass, 0 fail, twice in a row.
