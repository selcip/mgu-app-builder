# 08: Layer budget and connections

**What to build:** The Designer shows the layer budget live as the author edits: layers on each connection, layers in all and pixel memory, taken from the engine's own packing plan against the renderer's limits. The author can put an element on another connection. Going over a limit is a warning, never a block.

**Blocked by:** 05

**Status:** resolved

- [x] Counter for layers per connection, layers in all and pixel memory, updated on every edit
- [x] Over-limit values are marked and say which limit
- [x] An element's connection is chosen in the inspector
- [x] Saving is never blocked
- [x] Numbers equal the apps repo's for GT3, Sport and M (test)

## Resolution

`cluster/budget.js` `budgetOf(engine)` reads the vendored engine's own packing plan (`hud._layerRefs()` grouped by connection, `hud.pixelBytes`) against `CAR` (8 layers per connection, 32 in all, 16 MiB, each image twice). `panels/layout/useLayerBudget.ts` runs a second, stage-less engine with `layerCap` 8 and `pixelBytes` 16 MiB on the open layout (`setLayout` on every committed edit, read again 120 ms after the engine reports a change), so the canvas engine is untouched (its goldens stay as they were). `LayerBudget.tsx` is a section at the foot of the layout inspector: layers on each connection, layers in all, pixel memory; an over-limit value is flagged (`data-over`, red, a warning sign) and a `role=alert` list names the limit (`Connection 1 has 15 layers; the limit is 8 on each connection.`). It stays up while Trying. Saving is never blocked (download tested on an over-cap layout). `setConn` (`model/ops/cluster-connections.ts`; `conn` 0..3, 0 removes the key, EditError otherwise or for an unknown element) is one undo step; `ElementConnection.tsx` is a select in the inspector for one selected element.

Tests: `test/cluster-budget.test.js` (Node: GT3 equals the apps golden `gt3-cluster.json`: 8 layers, 3 effects, 5 sheets, 8411712 bytes; GT3, Sport, M and the grid equal the engine's status row; an over-cap layout; `setConn`), `test/designer-cluster-budget.test.js` (Chromium: GT3's numbers, speed to connection 3 and undo, an over-cap layout marked and downloadable).

Notes. Sport, M and the grid have no apps golden, so they are checked against the engine's own status row, not a recording. The engine repacks sheets when widgets are added, so ten extra fills on GT3 make 15 layers, not 18. A layer the engine plans past 32 in all is counted from the plan, though the stand-in refuses it. Layers waiting over the cap are counted in the connection's number (that is the point: they are not drawn on the car). The `conn` select shows for one selected element only.
