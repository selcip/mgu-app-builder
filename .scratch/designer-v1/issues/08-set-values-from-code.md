# 08: Set element values from code

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** The app's code sets what an element shows: text, toggle state, slider position, list rows, progress and pictures, and the screen redraws with the new value. Until the code sets a value, the element shows the option from the screen file. In the Designer the app author enters a list's default rows.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] The runtime sets each value kind listed above and the next recording shows it
- [ ] Elements show their screen-file options until a value is set
- [ ] Setting a value on an unknown screen or element logs a clear message and changes nothing
- [ ] The Designer edits a list element's default rows and the preview shows them
