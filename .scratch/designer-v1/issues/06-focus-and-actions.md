# 06: Focus order, controller and touch actions

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** On the head unit, the driver moves the highlight between elements with the iDrive controller and presses to select, or taps an element on the touchscreen; both report the same action to the app's code as `{ screen, element, action }`. An element's action defaults to its name and can be renamed. Focus order follows reading order (top to bottom, left to right) unless the screen file lists an explicit `focus` order; elements can be left out of focus. In the Designer the app author sees the focus order numbered on the screen, reorders it, excludes elements, sets action names, and tries it in the preview with arrow keys and Enter as the controller and clicks as taps, with a log of the actions reported.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The runtime resolves reading order when `focus` is absent and the explicit order when present; excluded elements are skipped
- [ ] Controller left/right moves the highlight, press reports the focused element's action; a tap on an element reports the same action
- [ ] An element's action is its name unless the screen file names another; several elements may share one action
- [ ] The Designer shows numbered focus order, reorders and excludes elements, and edits action names, all as document-model operations
- [ ] The preview accepts arrow keys, Enter and clicks, and shows the actions reported
- [ ] Runtime behaviour is tested at the recording seam with input sequences and expected recordings and actions
