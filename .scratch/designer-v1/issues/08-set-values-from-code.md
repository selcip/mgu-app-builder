# 08: Set element values from code

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** The app's code sets what an element shows: text, toggle state, slider position, list rows, progress and pictures, and the screen redraws with the new value. Until the code sets a value, the element shows the option from the screen file. In the Designer the app author enters a list's default rows.

**Blocked by:** 02, 04

**Status:** resolved

- [x] The runtime sets each value kind listed above and the next recording shows it
- [x] Elements show their screen-file options until a value is set
- [x] Setting a value on an unknown screen or element logs a clear message and changes nothing
- [x] The Designer edits a list element's default rows and the preview shows them

**Notes:** `rt.set(screen, element, value)` in `runtime/mgu_runtime.js` (tests: `test/runtime-set-values.test.js`). Pictures set from code take what the kit draws today, a PNG data URL or `key:<name>`; paths to `images/*.png` come with ticket 10. Row editing: `model/ops/rows.ts` (`addRow`, `setRow`, `deleteRow`, `moveRow`; tests `test/list-rows.test.js`), UI `designer/src/RowsEditor.tsx` (browser test `test/designer-list-rows.test.js`). Rows held as a list of objects (Store files) are shown, not edited row by row.
