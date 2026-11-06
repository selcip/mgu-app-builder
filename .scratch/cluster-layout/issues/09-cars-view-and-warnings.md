# 09: The car's view and visibility warnings

**What to build:** A toggle on the canvas masks what the driver cannot see (the hood curve over the top corners, BMW's gear box and the seat-belt light), using the engine's own geometry. Each element that sits under one of them gets a warning with the reason.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The car's view toggle draws the three masks at the measured positions
- [ ] A warning with the reason on each element hidden by the hood, gear box or belt light, in the element list and inspector
- [ ] Dragging an element under the hood adds its warning; moving it away removes it
- [ ] Warnings never block saving
- [ ] Warnings equal the engine's layout check (test)
