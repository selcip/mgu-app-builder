# 03: Designer opens a screen file and previews it

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author opens the Designer locally in the browser (React + Vite + TypeScript), uploads a zip with `screens.json` (and `images/`), sees the list of screens, and sees the selected screen at 1796×632 inside a mock HMI page frame with its title. The preview is drawn by the runtime and the kit running in the browser (CommonJS loaded through Vite, with a browser `zlib` shim). The golden test proves the browser and Node produce identical recordings for the same screen files.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The Designer runs locally from the repository with no server beyond the dev server or a static build
- [ ] Uploading a zip with a screen file lists its screens; selecting one previews it inside the HMI page frame
- [ ] The preview is drawn by the runtime and the vendored kit, not by separate preview code
- [ ] A golden test draws the same screen files in Node and in the browser build and requires identical recordings
