# 06: Focus order, controller and touch actions

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** On the head unit, the driver moves the highlight between elements with the iDrive controller and presses to select, or taps an element on the touchscreen; both report the same action to the app's code as `{ screen, element, action }`. An element's action defaults to its name and can be renamed. Focus order follows reading order (top to bottom, left to right) unless the screen file lists an explicit `focus` order; elements can be left out of focus. In the Designer the app author sees the focus order numbered on the screen, reorders it, excludes elements, sets action names, and tries it in the preview with arrow keys and Enter as the controller and clicks as taps, with a log of the actions reported.

**Blocked by:** 04

**Status:** resolved

- [x] The runtime resolves reading order when `focus` is absent and the explicit order when present; excluded elements are skipped
- [x] Controller left/right moves the highlight, press reports the focused element's action; a tap on an element reports the same action
- [x] An element's action is its name unless the screen file names another; several elements may share one action
- [x] The Designer shows numbered focus order, reorders and excludes elements, and edits action names, all as document-model operations
- [x] The preview accepts arrow keys, Enter and clicks, and shows the actions reported
- [x] Runtime behaviour is tested at the recording seam with input sequences and expected recordings and actions

## Notes

- Screen file: an action other than the element's name is written as the Store's `onTap: 'event:<action>'`; an explicit order is the screen's `focus` list (excluding an element writes the whole order). With an explicit order, a newly added focusable element joins it at the end.
- Runtime: `rt.on('action', fn)`, `rt.controller('left'|'right'|'press'|'back', steps?)`, `rt.touch(phase, x, y)`; focus, actions, hit testing and the ring (8 px out, 5 px wide, white, radius = element's + 8) in `runtime/mgu_focus.js`; its `FOCUSABLE` list is held to the catalog by `test/focus-model.test.js`. Focus is per element (not per tab/list row); taps do not change widget state (no TRY). `back` is accepted and ignored (ticket 07).
- Head unit: claims the whole screen for touches and grabs the controller when the renderer offers the gate (`info.controller`); controller counter/push handled as the Store's `_dial`. FrontCCU and RHMI focus proxies are left to 07/13.
