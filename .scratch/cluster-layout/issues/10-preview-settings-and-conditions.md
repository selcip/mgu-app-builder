# 10: Preview settings and conditions

**What to build:** A "Preview settings" section in the inspector lists the settings the layout refers to (for example "Leave room for the map"), with a switch each, and the canvas shows the variant. An element's condition (shown when a setting is on, off, or has a value, or limited to certain palettes) is picked from that list, not typed.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Settings are collected from the layout's conditions and map-window cut-out
- [ ] Flipping a switch redraws the canvas with that variant
- [ ] Condition picker covers on, off, value and palette limits, and writes the apps repo's condition strings
- [ ] Preview settings are not saved into the layout
- [ ] Browser test flips "Leave room for the map" on GT3 and sees the cut-out
