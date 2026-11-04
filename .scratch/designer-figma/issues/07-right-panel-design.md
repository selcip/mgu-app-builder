# 07: Right panel: Design tab and screen-file settings

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Build the right panel with tabs. The Design tab holds the box, align and distribute controls (moved out of the edit bar), the element's options, rows and picture uploads. With no element selected it shows the screen's settings (name, title, make first, duplicate, delete) and the screen file's (theme, languages, pictures, text issues). Stories over the fixtures.

**Blocked by:** 05

**Status:** resolved

- [x] Box, align and distribute live in the Design tab
- [x] Theme, languages, pictures and text issues show with nothing selected
- [x] Stories cover the missing-images and text-issues fixtures

## Comments

2026-11-03: The right panel is `designer/src/panels/inspector/Inspector.tsx`, with Design and Prototype tabs (`data-inspector-tab`). The current tab is the store's `inspectorTab`, so it survives selection changes and stories can set it.

The Design tab:
- **With a selection:** `Arrange.tsx`, with its box (`data-box`; one element only), six align buttons (`data-align`) and two distribute buttons (`data-distribute`, enabled from three elements), then the restyled `PropertyPanel` (delete is the trash icon, `data-delete-element`).
- **With nothing selected:** `Settings.tsx`. The screen's name and title, with make-first, duplicate and delete as icons (`data-make-first`, `data-duplicate-screen`, `data-delete-screen`). Then the screen file's theme (moved out of the toolbar), languages (a list with add and remove), images and text issues.

The toolbar keeps a shown-language picker (`ShownLanguage`) once there are two languages. Distribute is `canvas/arrange.ts`, which sends one `setBoxes` edit, since the model has no distribute operation; `test/distribute.test.js` covers it. Restyled onto shadcn inputs and the shared form pieces: CommitInput, the rows editor, the icon picker, pictures, languages, the text input and text issues. Their stylesheet rules are gone.

The browser tests now switch to the Prototype tab for links, focus order and actions, and back to Design for screen settings. Stories: `Inspector.stories.tsx` (NewDesign, OneElement, Picture, SeveralElements, MissingImages, TextIssues, MissingTranslation). `npm test` passes.
