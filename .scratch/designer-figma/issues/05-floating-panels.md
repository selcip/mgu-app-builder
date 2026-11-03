# 05: Docked or floating panels

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Each panel gets its own docked/floating toggle in its header. A floating panel sits over the canvas, drags by its header, resizes its width and collapses to its header. Mode, position, width and collapsed state persist per browser in `localStorage`. Ctrl+\ hides and shows both panels. A floating panel cannot be dragged off-screen, and is pulled back on screen when the window shrinks.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Each panel toggles independently
- [ ] The panel layout survives a reload
- [ ] Ctrl+\ hides and shows both panels
- [ ] A panel cannot be lost off-screen
