# Redline example

A screen file after idrive7-apps' **Redline** (`apps/redline`), for trying the Designer: **main menu → Open… → `redline.zip`**.

| Screen | What it shows |
|---|---|
| `tach` (first) | the rev bar in 500 rpm segments, 12 shift lights, rpm, gear, speed, oil and water, shift point, last shift; buttons to the log and settings |
| `log` | recent upshifts with their verdicts, and shift accuracy |
| `settings` | Redline's settings as rows (redline, shift point, light style, flash, cold guard, units, theme) |

Redline itself draws every frame in code. This is a hand port of its layout onto the Designer's 1796 × 632 screen with the kit's widgets, showing sample values (6420 rpm in 3rd). The live parts (the bar filling, the lights, the gear) are plain rectangles and texts here: an app would set them from its code or draw them in a Drawing area (`.scratch/import-idrive7/spec.md`, `docs/adr/0003-import-copies-idrive7-apps.md`). Redline's HMI side buttons are buttons on the screen, and its settings list is a screen.

`make.js` writes `screens.json` and `redline.zip`: change it and run `node examples/redline/make.js`.
