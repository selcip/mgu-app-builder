# 05: Docked or floating panels

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Each panel gets its own docked/floating toggle in its header. A floating panel sits over the canvas, drags by its header, resizes its width and collapses to its header. Mode, position, width and collapsed state persist per browser in `localStorage`. Ctrl+\ hides and shows both panels. A floating panel cannot be dragged off-screen, and is pulled back on screen when the window shrinks.

**Blocked by:** 04

**Status:** resolved

- [x] Each panel toggles independently
- [x] The panel layout survives a reload
- [x] Ctrl+\ hides and shows both panels
- [x] A panel cannot be lost off-screen

## Comments

2026-11-03: The layout rules are in `designer/src/shell/panels.ts`: where a panel first floats, clamping, width limits (200 to 560 px), and reading and writing the layouts under `localStorage['mgu-designer.panels']` (broken values read as the defaults). The store holds `panels` and `panelsHidden`. Docking, floating, resizing or hiding the left panel moves the view by as much as the canvas's left edge moves, so the HMI page stays put on screen. `shell/Panel.tsx` has the frame:
- the header holds the collapse button (floating only) and the dock/float toggle;
- a floating panel drags by its header;
- the inner edge resizes in both modes, and a floating right panel keeps its right edge;
- `PanelArea` measures the area under the toolbar, so a floating panel is always drawn inside it, which pulls it back when the window shrinks;
- `usePanelKeys` is Ctrl/Cmd+\.

The edit bar moved to a full-width row under the toolbar, so floating panels cover only the canvas; issues 07 and 09 take it apart. Hooks: `data-panel`, `data-panel-mode`, `data-collapsed`, `data-panel-header`, `data-panel-collapse`, `data-panel-float-toggle`, `data-panel-resize`, `data-panel-area`. Tests: `panel-layout.test.js`, a store test, and `designer-floating-panels.test.js` (3 Playwright tests). `npm test`: 227 pass, 0 fail, 3 skipped (Node 8).
