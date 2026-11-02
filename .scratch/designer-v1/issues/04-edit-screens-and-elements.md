# 04: Edit screens and elements, download the zip

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author builds a screen file from scratch or edits an uploaded one: add, rename, duplicate and delete screens; mark the first screen; set each screen's title; pick one kit theme for the whole screen file; add widgets from a palette; rename and delete elements; set each element's options in a property panel that shows exactly that widget's options with the right input for each; and download the result as a zip. The document model (TypeScript, no React) holds the screen file and applies every edit as an operation with validation (unique element names per screen, schema). New elements get a unique name per screen (such as `button1`). A hand-written widget catalog describes every kit widget's options, their kinds and defaults, and drives the palette and the property panel.

**Blocked by:** 03

**Status:** resolved

- [x] Every screen and element edit above is an operation on the document model and is tested there
- [x] New elements get a unique name per screen; renaming to a name already used on that screen is refused
- [x] The theme is chosen once and written on every screen so the Store's drawing code reads it unchanged
- [x] The palette offers every widget in the catalog, and the property panel shows exactly the selected widget's options
- [x] Option values set in the Designer are what the preview shows
- [x] Download gives a zip with `screens.json` at the root; uploading then downloading a file gives the same file; Store screen files import unchanged
- [x] A test fails when a widget or option exists in the catalog and not in the vendored kit, or the other way round, and draws every catalog widget with its defaults without errors
