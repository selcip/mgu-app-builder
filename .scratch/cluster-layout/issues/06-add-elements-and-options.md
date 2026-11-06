# 06: Add elements and edit widget options

**What to build:** The insert menu offers the generic cluster widgets. Each placed element has its options in the inspector with their defaults and ranges, a role picker over the layout's palette (shown read-only with each role's colour), and for text a template editor using the engine's tokens, a font list and alignment. The cluster widget catalog is hand-written and kept equal to the engine's validator by a test.

**Blocked by:** 05

**Status:** resolved

- [x] Insert menu lists text, GPU text, boxes, fill, rev bar, shift lights, arc, segment bar, icon, badge, scale, stripe and shift bar
- [x] Option fields per widget with defaults; invalid values are refused with the engine's reason
- [x] Role picker and read-only palette
- [x] Text template with token picker, font and alignment
- [x] Catalog-equals-validator test fails when the engine adds or changes a widget or option
- [x] A layout built from nothing saves, reopens equal, and draws

## Resolution

Insert menu (`shell/ClusterInsert.tsx`) lists the 13 generic widgets and adds a selected element with the catalog's box and starting options (`addWidget`, unique id such as `text1`, kept on the cluster). The inspector (`panels/layout/WidgetOptions.tsx`) shows each widget's options with the engine default as placeholder, a role picker (with swatch) over the palette of the layout's `theme`, a token picker, the baked font list and alignment for text, and a read-only palette (`PalettePanel`) with every role's colour. `setWidgetOption` (null removes the key) is one undo step; a refusal is the engine's own words (`cluster/checks.js` runs `layouts.js _validate` on the one widget) first, then the catalog's range, choice or palette. A layout without a `theme` gets the engine's fallback palette (classic). Locked widgets refuse option edits (`assertEditable`).

Tests: `test/cluster-catalog.test.js` (catalog equals the engine: types and required options, fonts, icons, tokens resolve in the engine, defaults draw, option keys are read by hud.js), `test/cluster-widgets-model.test.js` (Node), `test/designer-cluster-widgets.test.js` (Chromium).

Notes. The catalog test reads the `TYPES` table from layouts.js's source (it is not exported), so a reformatting of that table breaks the test. Not editable yet: boxes' inner `boxes` list (ticket 07), `toggle`/`themes` conditions, `hole`/`holeWhen`, `own`, `colorBy`, `hotWhen`, `near`, spacing, rate. Ranges not in the engine (for example lights count 1..32, segments 1..200) are the Designer's. Roles other than `color` (`color2` is offered; `headColor`, `fill`, `line` belong to boxes' inner boxes) are plain.
