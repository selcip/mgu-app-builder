# 07: Navigation and the BACK stack

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author links an element to another screen, so selecting it opens that screen without any code. The runtime follows `nav` links, keeps a screen stack so BACK returns to the previous screen and leaves the app from the first screen, tells the app's code whenever the screen changes, and lets the code open a screen itself. In the Designer the app author edits links, sees how the screens connect, is warned about links to screens that no longer exist, and walks through the app in the preview, BACK included.

**Blocked by:** 06

**Status:** resolved

- [x] Selecting a linked element opens its screen; the action is still reported
- [x] BACK returns to the previous screen; BACK on the first screen leaves the app
- [x] The app's code is told of every screen change and can open any screen itself
- [x] The Designer edits links, shows a navigation view, and warns about links to missing screens (also after a screen is deleted or renamed)
- [x] The preview follows links and BACK
- [x] Tested at the recording seam (runtime) and the document-model seam (Designer)

**Notes:** The runtime reports `screen` ({ screen, from, by: start|link|back|open }) and `leave` ({ screen }) events, opens screens from code with `open(name)`, starts on a named screen with `start(name)` and tells the shown screen with `screen()`. Opening a screen already on the stack returns to it (no stack growth). The Store's `onTap: 'screen:<name>'` / `'back'` spellings are not followed; only `nav`. On the head unit the HMI's BACK still has to be fed by the app (RHMI comes later); `leave` is the app's to handle.
