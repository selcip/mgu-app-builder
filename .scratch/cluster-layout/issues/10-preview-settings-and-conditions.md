# 10: Preview settings and conditions

**What to build:** A "Preview settings" section in the inspector lists the settings the layout refers to (for example "Leave room for the map"), with a switch each, and the canvas shows the variant. An element's condition (shown when a setting is on, off, or has a value, or limited to certain palettes) is picked from that list, not typed.

**Blocked by:** 05

**Status:** resolved

- [x] Settings are collected from the layout's conditions and map-window cut-out
- [x] Flipping a switch redraws the canvas with that variant
- [x] Condition picker covers on, off, value and palette limits, and writes the apps repo's condition strings
- [x] Preview settings are not saved into the layout
- [x] Browser test flips "Leave room for the map" on GT3 and sees the cut-out

## Resolution

The layout inspector has a "Preview settings" section (`PreviewSettings.tsx`, `data-preview-settings`): the settings the layout refers to, collected by `settingsOf` from widget and inner-box `toggle` conditions and `holeWhen` (GT3 and Sport: "Leave room for the map" and "Show boost"; M and the grid: none), each with a switch (ARIA role switch, `data-preview-switch`) or, for a choice, a select. They live in the editor store (`previewSettings`, reset on opening another document) and reach the engine as `settings` on start and `setSetting` on a flip; they survive edits, undo and Trying, and are in neither the file nor the history. The selected element has a "Shown when" section (`ElementCondition.tsx`): a select of every condition of the app's settings ("Leave room for the map is on/off", "Units is/is not km/h...") writing "name", "!name", "name=value", "!name=value" (`setCondition`, one undo step; EditError for an unknown setting, a value not on offer, or a value on a bool), and palette checkboxes (`setThemes`, `themes: [...]`, in the engine's palette order). Both work on locked elements (ticket 12). A toggle string the table does not know shows as an extra "not a setting the Designer knows" option and is kept.

Surprises. The setting table (`model/cluster-settings.ts`) is hand-written, tested equal to `engine/apps/cluster_themes/app.json` (host-owned settings left out: layout, byMode, drive-mode layouts, demo); only settings the table knows are listed. A `themes` limit has no preview control: the layout's own `theme` decides the palette. Number settings (redline) cannot be conditions in the engine and are not offered.

Tests: `test/cluster-conditions.test.js` (Node: collection from the four layouts, strings, refusals, locked M/Sport, table equals app.json, store state out of document and history), `test/designer-cluster-golden.test.js` (GT3 flip: the map window turns see-through at its centre and the whole canvas equals the stage over the Node engine with mapWindow on), `test/designer-cluster-editing.test.js` (picker writes the strings, undo steps, palettes, switch leaves file and undo history alone). Not proved: the choice select in a browser (no layout has a choice condition; Node covers the strings).
