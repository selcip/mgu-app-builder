# 10: Icons and images

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author picks icons from the kit's vector icons and uploads their own PNGs for picture elements. PNGs live under `images/` beside the screen file and are referenced by a relative path. The runtime draws them on the head unit and in the preview. Images no longer used by any element are left out of the download.

**Blocked by:** 04

**Status:** resolved

- [x] An icon picker lists the kit's vector icons and sets an element's icon
- [x] Uploaded PNGs are stored under `images/` and referenced by relative path
- [x] The runtime draws referenced PNGs (head unit and preview)
- [x] Unused images are dropped from the downloaded zip; a missing image is reported in the Designer
