# 11: Try with signals and a demo drive

**What to build:** Trying a cluster layout runs the engine on demo data. A signals panel has sliders for rpm, speed, gear, oil and coolant temperature, boost, drive mode and tyres, and a demo drive moves them by itself. The shift lights, redline and shift grades react. Leaving Trying leaves the layout as it was.

**Blocked by:** 04

**Status:** resolved

- [x] Try starts and stops from the toolbar as for screens; editing is off while trying
- [x] Sliders feed the engine the way the bench does; rpm near the shift point turns GT3 red
- [x] Demo drive plays the kit's simulated drive
- [x] The layout and its undo history are unchanged after trying
- [x] Playwright test moves the rpm slider and checks the frame against the bench's

## Resolution

Try (the toolbar's own button, now shown for a layout) turns on a Signals card (`shell/Signals.tsx`, `data-signals-panel`) with range sliders (ARIA role slider, named) for rpm, speed, gear, oil and coolant temperature, boost and tyre pressure and temperature, a Drive mode radio group (Sport, Comfort, Eco Pro) and a Demo drive switch. `designer/src/store/signals.ts` (plain TS) is the Designer's own copy of the bench's mapping from slider units to the raw SOME/IP values (rpm x0.25, speed x1/64, temperature -48, FES `displayBoostPressure` x0.01, TPMS in 0.1 bar and raw - 40 C with the rear pair a notch higher, drive mode wire numbers 1/4/7, gear as G1.. with stage D/P); fuel, range, ambient, torque and g-forces go in at the bench's defaults. The editor store holds `signals` and `demoDrive` (`setSignal` clamps to the slider's range, `setDemoDrive`); stopping Trying turns the demo drive off. Signals are never part of the document, so history and layout are untouched.

`ClusterStage` restarts the engine and stage whenever Trying starts or stops (so leaving Trying gives back the frame the layout had before, pixel for pixel), and while trying calls `engine.feed()` for every field on each change and again every 250 ms (the engine drops a boost reading older than 3 s; the bench re-sends every 50 ms). Demo drive is the engine's own `demo` setting set to on, i.e. the kit's `sim.js` run by `car.js`; the sliders are disabled while it runs. Editing is off while trying: undo/redo and the editing keys are disabled by `trying` as for screens (ticket 05's editing must honour `trying` the same way).

Tests: `test/cluster-signals.test.js` (Node: hand-worked raw values, ranges, store trying leaves document and history untouched); `test/designer-cluster-try.test.js` (Chromium: GT3 at 3000 and 6800 rpm pixel-equal to the vendored `stage.js` over the Node engine fed the same signals, more red at 6800; the demo drive runs and frames change; frame, layout and undo history unchanged after trying). Not proved: the sim's frames against a recording (they are time-driven), the drive mode's effect on layout choice (`byMode` is off in the host), equality with the car. Test note: the fake clock must not jump far ahead while signals are fed, or the engine reads them as stale.
