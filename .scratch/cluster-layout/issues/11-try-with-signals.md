# 11: Try with signals and a demo drive

**What to build:** Trying a cluster layout runs the engine on demo data. A signals panel has sliders for rpm, speed, gear, oil and coolant temperature, boost, drive mode and tyres, and a demo drive moves them by itself. The shift lights, redline and shift grades react. Leaving Trying leaves the layout as it was.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Try starts and stops from the toolbar as for screens; editing is off while trying
- [ ] Sliders feed the engine the way the bench does; rpm near the shift point turns GT3 red
- [ ] Demo drive plays the kit's simulated drive
- [ ] The layout and its undo history are unchanged after trying
- [ ] Playwright test moves the rpm slider and checks the frame against the bench's
