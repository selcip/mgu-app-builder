# 05: "From design to car" guide

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** A short guide in the Designer, opened from Help in the main menu and linked from Download. It covers: Download gives `screens.json` and `images/`; unzip them into the starter's `app/`; handle actions and set values in `main.js` (`rt.on('action')`, `rt.on('screen')`, `rt.set`); give the app its id and tile; `node tools/build.js`. It points to `starter/README.md` for the details and the emulator walkthrough.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Reachable from Help and from Download (each with a `data-*` hook, covered in Playwright)
- [ ] Wording follows `GLOSSARY.md` (screen file, not screens.json, except as the file's name)
