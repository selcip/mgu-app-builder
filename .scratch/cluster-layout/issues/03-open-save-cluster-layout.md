# 03: Open, save and download a cluster layout

**What to build:** The Designer opens a cluster layout (the apps repo's layout file) from the same Open command as a screen file, shows which kind of document is open, and lets the app author rename it, autosaves it, and downloads it as `<name>.json`. A layout opened and saved again without edits is equal to the file opened. This ticket is the model seam of the spec and needs no engine; the layout files are test fixtures.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Open recognises screen files and cluster layouts; the document kind is shown and menus that do not apply are hidden
- [x] GT3, Sport, M and the calibration grid open and save equal to the original (fixtures, model test)
- [x] The layout's target is a field; the cluster is the only one exposed
- [x] Rename, autosave and restore work as for screen files
- [x] Download gives a `.json` named after the layout
- [x] Glossary terms are used in the UI (Cluster layout, not "theme")
