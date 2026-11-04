# 01: Readable dropdowns

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** Every native `<select>` in the Designer shows its open option list in the appearance's colours. `color-scheme` follows the appearance (dark/light), and `<option>` uses the popover background and foreground. The selects stay native.

**Blocked by:** none

**Status:** resolved

- [x] Options are readable while open in the dark and light appearances (checked by hand in Chromium on Windows)
- [x] A Playwright check reads the computed `color-scheme` of a select in each appearance

## Comments

2026-11-04: `designer/src/index.css` sets `color-scheme` on `:root` (light) and `.dark` (dark) and gives `option`/`optgroup` the popover colours. The selects stay native. In the dev server in Chromium on Windows, the theme select reads `color-scheme: dark` with options in `oklch(0.205 0 0)` / `oklch(0.985 0 0)`. `test/designer-navigation.test.js` checks the link field's computed `color-scheme` and option colours in both appearances. It was written but **not run here**: Playwright isn't installed in this checkout, so every browser test skipped.
