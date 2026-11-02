# 01: Vendor the kit and draw a Store screen file in Node

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** The repository is set up (Node tooling for the runtime and tests, a place for the Designer) and holds a pinned, unmodified copy of mgu-store's kit (the canvas, recording, fonts, themes, vector icons, PNG code, the widgets and their drawing code), with its licence notices. A sync script copies the kit from a given mgu-store commit and records that commit. A test draws the Store's iDrive 7 screens (its compact 1796×632 layout) through the vendored kit into a recording, proving the copy draws on its own outside mgu-store.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The sync script copies the kit from a named mgu-store commit and records the commit beside the copy
- [x] The vendored files are byte-identical to mgu-store at that commit, and their MIT notices are kept
- [x] A test draws every Store iDrive 7 screen through the vendored kit into a recording without errors
- [x] The recording of at least one Store screen is checked in as a golden file and the test compares against it
