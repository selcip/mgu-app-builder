# 07: Navigation and the BACK stack

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author links an element to another screen, so selecting it opens that screen without any code. The runtime follows `nav` links, keeps a screen stack so BACK returns to the previous screen and leaves the app from the first screen, tells the app's code whenever the screen changes, and lets the code open a screen itself. In the Designer the app author edits links, sees how the screens connect, is warned about links to screens that no longer exist, and walks through the app in the preview, BACK included.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Selecting a linked element opens its screen; the action is still reported
- [ ] BACK returns to the previous screen; BACK on the first screen leaves the app
- [ ] The app's code is told of every screen change and can open any screen itself
- [ ] The Designer edits links, shows a navigation view, and warns about links to missing screens (also after a screen is deleted or renamed)
- [ ] The preview follows links and BACK
- [ ] Tested at the recording seam (runtime) and the document-model seam (Designer)
