# Spec: Design the instrument cluster in the Designer

Status: ready-for-agent

## Problem Statement

App authors can lay out an app's screens in the Designer, but not the instrument cluster. The cluster themes in the apps repo (GT3, M, Sport) are layout JSON files, written by Python generators and checked on the car by trial. To move a box, change a label, see which layers a layout needs or find out whether the hood hides something, the app author edits numbers and redeploys. The author has no way to see what the car will draw, or how close the layout is to the renderer's limits, before it is on the car.

## Solution

The Designer opens, edits and saves a **Cluster layout**: the apps repo's layout file (`schemaVersion: 2`) as it is, kept apart from the screen file (ADR 0004). The canvas shows the 1920x720 cluster drawn by the apps repo's own engine running in the browser (ADR 0005), with the car's view (what the hood, BMW's gear box and the belt light hide) and the layer budget. Trying runs the layout on demo signals. The author downloads the file and the "From design to car" guide says how it gets to the car.

## User Stories

1. As an app author, I want to open the GT3, M, Sport and calibration-grid layouts in the Designer, so that I can start from a layout that already works on the car.
2. As an app author, I want a layout I open and save again without editing to come out equal to the file I opened, so that the Designer never changes what I didn't touch.
3. As an app author, I want the canvas to show the 1920x720 cluster as the car's engine draws it, so that I can trust what I see.
4. As an app author, I want to select, move and resize an element on the canvas with the snapping I have for screens, so that laying out the cluster feels like laying out a screen.
5. As an app author, I want to add an element of any generic cluster widget from the insert menu, so that I can build a layout, not only change one.
6. As an app author, I want to delete, duplicate, copy and paste elements, so that I can work as fast as on a screen.
7. As an app author, I want every edit to undo and redo, so that I can try things.
8. As an app author, I want to select each box inside GT3's frame on its own and see it as a child row of the frame element in the element list, so that I don't have to know one layer draws them all.
9. As an app author, I want to add, delete and reorder boxes inside the frame, so that I can change how many boxes a layout has (up to the engine's limit).
10. As an app author, I want to change the stacking order of elements as I do for screens, so that I control what covers what.
11. As an app author, I want to choose which role of the palette an element uses, so that its colour follows the layout's palette.
12. As an app author, I want to see the layout's palette, read-only, with each role's colour, so that I know what each role looks like before I pick it.
13. As an app author, I want to edit a text element's template, picking from the signal tokens the engine knows, so that I can change what it shows.
14. As an app author, I want to choose a text element's font from the fonts the engine ships and its alignment, so that I can change how it looks.
15. As an app author, I want the options of each widget (a rev bar's height and slant, the lights' count and first rpm, an arc's start and sweep, a segment bar's segment count) in the inspector with their defaults and ranges, so that I don't edit raw numbers.
16. As an app author, I want the layer budget (layers on each connection, layers in all, and pixel memory) shown and updated as I edit, so that I know whether the car will draw all of it.
17. As an app author, I want to put an element on another connection, so that I can fit a layout the first connection cannot hold.
18. As an app author, I want the car's view on the canvas (the hood, BMW's gear box and the belt light masked) that I can turn off, so that I see what the driver sees.
19. As an app author, I want a warning on each element that is under the hood, the gear box or the belt light, with the reason, so that I can move it before the car shows me.
20. As an app author, I want warnings never to stop me saving, so that I can keep a layout I'm still working on.
21. As an app author, I want a "Preview settings" section listing the settings my layout refers to (such as "Leave room for the map"), so that I can flip them and see each variant.
22. As an app author, I want to set an element's condition by picking from those settings and their values, so that I don't have to type setting names.
23. As an app author, I want to limit an element to certain palettes or modes from the inspector, so that one layout can serve several looks.
24. As an app author, I want to Try the layout on demo data with sliders for rpm, speed, gear, oil and coolant temperature, boost, drive mode and tyres, so that I see the shift lights, redline and grades react.
25. As an app author, I want a demo drive that moves the signals by itself, so that I can watch the layout live without touching sliders.
26. As an app author, I want Trying to stop when I leave it and the layout to be as I left it, so that trying never edits my layout.
27. As an app author, I want GT3's elements all editable, so that I can change a complete layout.
28. As an app author, I want M's and Sport's backdrop shader to open as one locked element that I can move, resize and condition, so that I can still use those layouts and know what I can't change.
29. As an app author, I want the locked element to say why it is locked and what it draws, so that I'm not left guessing.
30. As an app author, I want a layout the engine would refuse to be refused with the engine's own reason when I open it, so that I know what to fix.
31. As an app author, I want to rename a layout and its elements, so that my layouts are named as I want.
32. As an app author, I want my work autosaved and restored as it is for screen files, so that a closed tab doesn't lose it.
33. As an app author, I want to download the layout as a `.json` file with the layout's name, so that I can put it in my app.
34. As an app author, I want the "From design to car" guide to cover cluster layouts and name the two ways to the car, so that I know what to do with the file.
35. As an app author, I want to open a screen file or a cluster layout from the same Open command, so that I don't have to know which Designer to choose.
36. As an app author, I want the Designer to tell me which kind of document is open, so that I know which menus apply.
37. As an app author, I want zoom, pan, fit-to-view and the shortcuts I know from screens to work on the cluster canvas, so that I don't relearn the Designer.
38. As an app author, I want the Designer to keep working as a static site in any browser, so that I don't install anything to design a cluster.
39. As a maintainer, I want the vendored engine to be a pinned, unmodified copy with a sync script, so that I know what the Designer draws with and can update it.
40. As a maintainer, I want a test to fail when the Designer's frames differ from the apps repo's recording of the same layout and signals, so that the canvas cannot drift from the car.
41. As a maintainer, I want the widget catalog for the cluster kept equal to the engine's own validator by a test, so that the Designer never offers a widget or an option the engine refuses.
42. As a driver, I want a layout made in the Designer to draw on the car exactly as it did on the canvas, so that nothing surprises me on the road.

## Implementation Decisions

- **Two kinds of document.** The Designer opens a screen file or a cluster layout. The document model, editing operations, history, store, canvas viewport, selection and snapping are shared. The widget catalog, the preview and the inspector's sections are per kind. The cluster layout's file format is the apps repo's layout file and is read and written as it is; ADR 0004 records why it is not folded into the screen file.
- **Target.** A layout names its target (the cluster at 1920x720 or the HUD at 800x480). The Designer exposes the cluster only in this version; the HUD is a later spec that needs no model change.
- **Engine and stand-in.** First, in the apps repo, the bench is split into modules that need no HTTP server or socket: the cluster-render protocol and limits, and the WebGL stage that draws layers. The bench itself uses those. This repo then vendors the engine, those modules and the baked fonts as a pinned, unmodified copy with a record of the commit and each file's blob id (as for the kit), behind a virtual module like the screen preview's. The engine's socket becomes an in-memory pipe into the stand-in, and its file access and the kit's context are shimmed. If shimming proves heavy, the apps repo is asked to make them injectable (ADR 0005).
- **Widgets offered.** The generic widgets: text, GPU text, boxes, fill, rev bar, shift lights, arc, segment bar, icon, badge, scale, stripe and shift bar. The backdrop shaders of M and Sport (whole-theme, rev blade) open as a locked element. A hand-written cluster widget catalog describes each widget's options, kinds and defaults, kept equal to the engine's validator by a test.
- **Inner boxes.** Each entry of a boxes widget is an element and a child row under its widget in the element list. Selecting, moving and resizing it writes into the widget's list; adding and deleting change that list. The engine's limit on how many boxes one widget holds applies.
- **Palette.** Elements name a role. The palette is taken from the vendored engine and shown read-only. Editing a palette needs the layout file to carry its own palette, which is a change in the apps repo and a later spec.
- **Settings and conditions.** The Designer collects the settings the layout refers to from its elements' conditions and the map-window cut-out. The inspector lists them with a preview switch each. An element's condition is picked from that list; the file keeps the apps repo's condition strings.
- **Trying.** The signals panel and a demo drive feed the engine the same way the bench does, including the shift-grade logic. Trying never edits the layout.
- **Limits shown.** The layer budget comes from the engine's own packing plan. The car's view and per-element warnings come from the engine's visible-area geometry and layout check. All are warnings; nothing blocks saving.
- **Locked element.** A locked element can be moved, resized, conditioned, deleted and stacked, and its internals are read-only in the inspector with a note on what it draws.
- **Refusals.** A layout the engine refuses opens with the engine's own reason shown, as the apps repo's status row shows it.
- **Export.** Download only, as a named `.json` file. The "From design to car" guide covers copying it into the app's layouts and rebuilding, and pushing it with the deploy script into the car's override folder. The Designer does not write into a checkout.
- **Generators.** The apps repo's Python generators are no longer the source of a layout saved from the Designer; they stay as history.
- **Glossary.** Cluster layout, Palette, Role and Layer budget are defined. "Theme" stays the kit's term; the cluster side of the Designer does not use it.

## Testing Decisions

- A good test drives external behaviour only: a document goes in, operations or signals are applied, and the saved file or the drawn frame comes out. It does not look at class names or internal state; the browser tests find things by `data-*` hooks and ARIA roles.
- **Seam 1: the document model** (apply an operation to a document, in Node). Covers: open then save equals the original for GT3, Sport, M and the calibration grid; each operation (add, move, resize, delete, duplicate, role, text, inner box add/move/delete, condition, stacking, connection); undo and redo; refusals with the engine's reason; locked elements. Prior art: the existing model tests for operations, history and the screen file.
- **Seam 2: the preview golden** (the Designer built and driven in Playwright's Chromium). The Designer's frame for a layout and signals must equal the apps repo's recording of the same. The UI behaviours ride on this seam: select and drag an inner box and see the layer budget change; drag an element under the hood and see its warning; flip "Leave room for the map"; Try with a slider; download the file. Prior art: the existing preview golden test and the other browser tests, each building the Designer into a folder of its own.
- The catalog-equals-engine test and the sync test (skipped without an apps-repo clone; the clone's location is set by an environment variable, with a default beside this repo) follow the kit's equivalents.
- The bench split in the apps repo is covered by the bench's own recording of a layout before and after; no third seam is added here.

## Out of Scope

- The HUD (800x480): designed for, not exposed.
- Editing palettes or fonts; breaking the M and Sport backdrop shaders into editable parts.
- Writing into an apps-repo checkout from the browser.
- Changes to the apps repo beyond the bench split and the injectability asked for in ADR 0005.
- The cluster_themes app's own settings page on the center screen.
- Mesh and video layers (the bench draws neither).
- Verifying a layout on the car; only the car shows real brightness, colour and warning-light behaviour.

## Further Notes

- Suggested order of tickets: (1) the apps-repo bench split, which blocks the rest; (2) vendor the engine and stand-in with the pin record, sync script and sync test; (3) open and save a cluster layout in the model, with the round trip of the four layouts; (4) the engine preview on the canvas, with its golden test; (5) the cluster widget catalog and operations, with inner boxes; (6) layer budget, car's view and warnings; (7) preview settings and conditions; (8) Trying with signals and a demo drive; (9) locked backdrop elements; (10) download and the guide.
- Assumptions to confirm while slicing: text elements edit a template against the token list in the engine's header and use the fonts the engine already ships; the engine bundles for the browser with shims alone.
- Decisions on record: ADR 0004 (a cluster layout is its own file kind) and ADR 0005 (the preview runs the apps engine in the browser).
