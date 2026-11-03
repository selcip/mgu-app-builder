# 04: Shell: toolbar, two docked panels, canvas with pan and zoom

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Replace the three columns with the shell: a slim top toolbar, a docked left and right panel frame, and a canvas viewport between them that shows the HMI page with pan (space-drag, middle mouse) and zoom (Ctrl+wheel, Ctrl+0, Shift+1). Existing sections move into the panel frames unchanged for now. Canvas editing, and touches while trying, convert pointer positions with zoom and pan.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Dragging, resizing and marquee land on the right screen pixels at 50 %, 100 % and 200 % zoom (Playwright)
- [ ] Touches while trying land on the right element when zoomed
- [ ] The golden preview test passes at 100 %
