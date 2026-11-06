# 03: Open, save and download a cluster layout

**What to build:** The Designer opens a cluster layout (the apps repo's layout file) from the same Open command as a screen file, shows which kind of document is open, and lets the app author rename it, autosaves it, and downloads it as `<name>.json`. A layout opened and saved again without edits is equal to the file opened. This ticket is the model seam of the spec and needs no engine; the layout files are test fixtures.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Open recognises screen files and cluster layouts; the document kind is shown and menus that do not apply are hidden
- [ ] GT3, Sport, M and the calibration grid open and save equal to the original (fixtures, model test)
- [ ] The layout's target is a field; the cluster is the only one exposed
- [ ] Rename, autosave and restore work as for screen files
- [ ] Download gives a `.json` named after the layout
- [ ] Glossary terms are used in the UI (Cluster layout, not "theme")
