# Spec: Import idrive7-apps apps for UI changes (later version)

Status: needs-triage

## Problem Statement

App authors want to change the look of the apps in idrive7-apps (`cauliflowermossgrape/idrive7-apps`) in the Designer: move or resize a panel, change a label or colour, add a button. They can't. Those apps have no screen file. Each `main.js` draws every frame in code with idrive7's own kit (`gauges.js`: `G.frame`, `G.button`, `G.radial`…). The `screens` in `app.json` only describe the HMI page around the drawing (`kind: "canvas"`, side buttons, a settings list), so there is nothing to open.

## Solution

Importing an app makes the app author's **own copy**: a starter-based app on our runtime (see `docs/adr/0003-import-copies-idrive7-apps.md`).

- The fixed parts of each layout (frame and tabs, panels, buttons, labels) become elements in a screen file. They are drawn by idrive7-look widgets proposed to mgu-store's kit.
- The live parts (gauges, charts, trails) become **Drawing areas**: elements whose box is in the screen file and whose contents the copied code draws each frame.
- The HMI side buttons become elements on the screen, and the `app.json` settings list becomes a Settings screen of toggle and list rows that the app's code fills.
- The copy uses the starter's renderer client (mgu-render) and drops `idrive7-renderd`.

Pilot: **G-Force** (`apps/gforce`), ported by hand.

## User Stories

1. As an app author, I want to open my copy of G-Force in the Designer and see its frame, tabs, buttons, labels and a placeholder where the friction circle is drawn.
2. As an app author, I want to move, resize, recolour and re-label those parts and see them that way on the car.
3. As an app author, I want the friction circle to keep drawing live at 60 fps inside the box I gave its Drawing area.
4. As an app author, I want the app's settings (circle size, trail, units, colour theme…) on a Settings screen I can lay out.
5. As a driver, I want the imported app to look and behave like the original.

## Implementation Decisions

- **Kit (mgu-store, then `npm run sync-kit`)**: a Drawing area widget, plus the idrive7 frame-with-tabs, panel, button and label widgets in their G20 look. Nothing is edited in `kit/` here.
- **Runtime**: `rt.draw(screen, element, (surface, box) => …)` registers a Drawing area's drawing function, and `rt.redraw(screen, element)` asks for a frame. The runtime calls the function only while that screen is shown and clips it to the box. The surface offers the drawing calls of `kit_canvas.js`, which shares its origin with idrive7's `canvas.js`, so gauge code ports with little change.
- **Designer**: the Drawing area appears in the widget catalog (`catalog.ts`, kept equal to the kit by its test) and draws as a labelled placeholder on the canvas and in the preview.
- **Pilot port**: G-Force by hand, as an app in its own folder or repository. It is not added to idrive7-apps.
- An automatic importer (recording a frame in idrive7's `sim.js` / `record.js` and turning `G.*` calls into elements) is not built until a second app has been ported by hand.

## Testing Decisions

- Runtime tests: a Drawing area is drawn only while shown, clipped to its box, and on `redraw`. There are golden recordings for a screen with one.
- The Designer's preview golden test covers a screen with a Drawing area placeholder.
- The G-Force copy runs in the emulator before it is called done (mgu-store `AGENTS.md`).

## Out of Scope

- Changing idrive7-apps upstream.
- HMI-native side buttons and settings menus in the runtime (revisit if drivers miss them).
- Porting every idrive7 widget (gauges, tyres, charts…) to the kit; that grows widget by widget later.
- Doom and other apps whose whole screen is a live drawing.
