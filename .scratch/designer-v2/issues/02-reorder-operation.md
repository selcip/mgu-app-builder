# 02: Reorder operation in the model

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** A model operation that moves named elements of one screen to a new place in its stacking order (`components[]`, bottom first). The moved elements keep their order relative to each other. Bring forward/backward and to front/back are expressed through it. `focus`, boxes and options are untouched. It is undoable as one step.

**Blocked by:** none

**Status:** resolved

- [x] Model tests: one element, a selection that isn't contiguous, no-ops at the top and bottom, undo/redo
- [x] `focus` is unchanged after every reorder

## Comments

2026-11-04: `designer/src/model/ops/stacking.ts` (registered in `model/operations.ts`) adds `restackElements { screen, elements, place }`, where `place` is `'forward' | 'backward' | 'front' | 'back'` or a drop index among the elements not being moved (0 = under all of them). `restacked()` and `canRestack()` are exported from `model/index.ts` for tickets 03 and 04: a command at an end can be disabled when `canRestack` is false. An `apply` that changes nothing still makes an undo step, so the UI should not dispatch one. `test/stacking-model.test.js` (6 tests) covers all of this. `npm test`: 225 pass, 0 fail, 29 skipped (the browser tests, no Playwright).
