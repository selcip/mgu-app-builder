# 01: Browser tests find things by data-* hooks only

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Replace every class selector in the Playwright tests (`.try-panel`, `.screen-props`, `.action-field`, `.link-field`) with `data-*` hooks or ARIA roles, and add those hooks to today's markup. Nothing visible changes.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] No browser test selects by class name
- [x] npm test passes, including the golden preview test

## Comments

2026-11-03: Hooks added: `data-try-panel`, `data-try-toggle`, `data-action-field`, `data-link-problem`, `data-reset-focus`, `data-screen-props`, `data-screen-name`, `data-delete-screen`, `data-hmi-page`. Text selectors (`text=Back to reading order`, `hasText: 'Delete'`, `hasText: 'Name'`) went too. The four browser tests now run `npm run build` through a shell on Windows (`npm` is `npm.cmd` there). With Playwright 1.64.1 all 10 browser tests pass, golden included. `npm test` on Windows still has 12 failures that fail the same way before this change: `widget-catalog` and `widget-sizes` import a bare Windows path (needs `pathToFileURL`), plus `kit-pinned` and `starter-pack`.

2026-11-03: The 12 Windows failures are fixed. A root `.gitattributes` (`* text=auto eol=lf`, PNG and `.rec` binary) stops Git for Windows' `core.autocrlf=true` from checking out the kit, the Store fixtures, `starter/vendor` and the starter's generated files as CRLF, which broke their byte comparisons. `widget-catalog` and `widget-sizes` import `catalog.ts` through `pathToFileURL`. `starter-pack` runs tar on archive names relative to its working folder, since GNU tar reads `C:\…` as host:path. `npm test` on Windows with Playwright: 199 pass, 0 fail, 3 skipped (the Node 8 tests).
