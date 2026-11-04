# Spec: Designer v2: readable dropdowns, stacking order, design to car

Status: resolved

## Problem Statement

Three things get in the app author's way in the Designer:

- The Inspector's dropdowns are unreadable while open. The Designer's dark appearance styles the native `<select>` with light text on a see-through background, but nothing tells the browser the page is dark. Chromium opens the option list on white, so the options are light-on-white until one is picked.
- An element's **stacking order** can't be changed. The kit draws a screen's elements in the screen file's order, so the last one added always covers the earlier ones. The element list shows them bottom first, in the order they were added, and nothing reorders them.
- Nothing in the Designer says how a downloaded screen file becomes a running app. That path (unzip into `starter/app/`, change `main.js`, `node tools/build.js`) is only written down in `starter/README.md`.

## Solution

- Tell the browser which colour scheme the appearance uses, and give options the popover colours. The selects stay native.
- Make stacking order editable from the left panel's element list (drag) and from Figma's four commands. The list is flipped so its top row is drawn on top, as in Figma.
- Add a short "From design to car" guide, reachable from the Designer's Help and from Download.

## User Stories

1. As an app author, I want to read every option of a dropdown while it is open, in the dark appearance and in the light one.
2. As an app author, I want the element list's top row to be the element drawn on top, so that it reads like Figma's layer list.
3. As an app author, I want to drag an element up or down in the element list to change its stacking order.
4. As an app author, I want to drag several selected elements at once, keeping their order relative to each other.
5. As an app author, I want Bring forward (Ctrl+]), Send backward (Ctrl+[), Bring to front (Ctrl+Shift+]) and Send to back (Ctrl+Shift+[) in the main menu, on the canvas's right-click menu and on the keyboard.
6. As an app author, I want each reorder to be one undo step, and a command that has nothing to do (Bring forward on the topmost element) to do nothing.
7. As an app author, I want reordering to leave focus order and positions alone.
8. As an app author, I want to find out from the Designer how my download becomes an app on the car.

## Implementation Decisions

- Stacking order is the order of `components[]` in the screen file, bottom first. That doesn't change, and neither does the file format. The list only displays it reversed.
- A new model operation reorders elements within one screen, in a new or existing module under `model/ops/`. It takes the names to move and where to put them, and keeps the moved elements' relative order. Focus order (`focus`) and boxes are untouched.
- The four commands live in `shell/commands.ts` with keys in `shell/keys.ts`, under the existing rules: never while typing or trying.
- The dropdown fix belongs in the Designer's styles (`index.css` / `components/designer/form.tsx`): `color-scheme` follows the appearance, and `<option>` uses the popover colours. The selects stay native, because the browser tests and the keyboard rely on them.
- Hooks: element rows keep `data-element`; drag targets add `data-*` hooks for the tests.

## Testing Decisions

- The model test covers the reorder operation: moving one element, moving a selection that isn't contiguous, no-ops at the ends, undo.
- Playwright covers dragging in the list, each command and its key, and that `focus` is unchanged.
- The dropdown fix is checked by reading the computed `color-scheme` on a select in each appearance.

## Out of Scope

- Importing idrive7-apps (`.scratch/import-idrive7/`), Export app (`.scratch/export-app/`).
- Groups or nested elements.

## Comments

2026-11-04: All five tickets are resolved. Not verified: the Playwright browser tests (Playwright isn't installed in this checkout, so they skipped) and a real mouse drag in the element list (checked with drag events fired from script).

2026-11-04: With Playwright 1.64.1 installed (`npm install --no-save playwright`, `npx playwright install chromium`), `npm test` passes 256 with 0 failures; only the 3 Node 8 tests skip. The browser tests needed two fixes after the list flipped: selections are compared sorted (`designer-canvas-zoom`, `designer-shortcuts`), and the right-click test clicks the element drawn on top. The Playwright drag test in the element list passes with a real mouse drag.
