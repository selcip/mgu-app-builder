# 04: Shell: toolbar, two docked panels, canvas with pan and zoom

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Replace the three columns with the shell: a slim top toolbar, a docked left and right panel frame, and a canvas viewport between them that shows the HMI page with pan (space-drag, middle mouse) and zoom (Ctrl+wheel, Ctrl+0, Shift+1). Existing sections move into the panel frames unchanged for now. Canvas editing, and touches while trying, convert pointer positions with zoom and pan.

**Blocked by:** 03

**Status:** resolved

- [x] Dragging, resizing and marquee land on the right screen pixels at 50 %, 100 % and 200 % zoom (Playwright)
- [x] Touches while trying land on the right element when zoomed
- [x] The golden preview test passes at 100 %

## Comments

2026-11-03: The shell is in `designer/src/shell/`:
- `Toolbar.tsx`: the old header on shadcn buttons, plus zoom −, level (resets to 100 %), + and fit. Hooks: `data-zoom-out`, `data-zoom-reset`, `data-zoom-level`, `data-zoom-in`, `data-zoom-fit`.
- `Panel.tsx`: the docked frame. Left (240 px): screens, screen settings, widget palette. Right (320 px): the inspector as before, plus the focus-order toggle and the try panel.
- `Viewport.tsx`: the canvas. Space + drag, middle drag and the wheel pan; Ctrl + wheel zooms about the pointer; Ctrl + =/−/0 and Shift + 1 zoom.
- `view.ts`: the view maths.

The view (`zoom`, `x`, `y`) and the last measured canvas and page sizes are in the store. The page starts centred at 100 %. Zoom is a CSS transform on the page. `Canvas` and touches while trying already converted pointers through the page's on-screen box, so they needed no change. The edit bar runs across the top of the canvas column until issues 07 and 09 split it. Tests: `canvas-view.test.js` (view maths), a store test for zooming and fitting, and `designer-canvas-zoom.test.js` (move, resize and marquee at 50/100/200 %; taps while trying at 50/200 %; toolbar zoom, fit, Ctrl+0, Space/middle/wheel pan, Ctrl+wheel about the pointer). `npm test`: 219 pass, 0 fail, 3 skipped (Node 8).
