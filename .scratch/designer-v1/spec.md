# Spec: Designer v1 (iDrive 7)

Status: ready-for-agent

## Problem Statement

An app author who wants a good-looking app on an iDrive 7 head unit today has to draw every screen by hand in JavaScript: position each widget in pixels, wire the iDrive controller's focus by hand, handle touch separately, write their own navigation and BACK handling, and copy the Store's kit and glue code into their app. The only way to see the result is to pack the app and run it in the emulator or the car. The Store's own screens show the kit can produce a polished, 60 fps UI, but nothing lets another app author reach that without reading thousands of lines of the Store's code.

## Solution

The **Designer**, a web tool in which an app author lays out an app's **screens** visually, from the kit's own **widgets**, and sees them exactly as the head unit will draw them. The Designer saves a **screen file** (the Store's existing screen format), not code. The app ships the screen file with the **kit** and the **runtime**. The runtime draws the screens through the **renderer**, moves the highlight in **focus order** with the iDrive controller, turns taps and controller presses into **actions** for the app author's code, follows **navigation** links, and handles BACK. A **starter app** shows an app author how the pieces fit, and is ready to copy and pack.

## User Stories

### Starting and saving

1. As an app author, I want to open the Designer in my browser without installing anything, so that I can start designing right away.
2. As an app author, I want to start a new, empty screen file, so that I can design an app from scratch.
3. As an app author, I want to upload an existing screen file (zip with `screens.json` and `images/`), so that I can keep working on a design I saved earlier.
4. As an app author, I want to upload a screen file that was written by hand or by the Store, so that existing screens open in the Designer without conversion.
5. As an app author, I want to download my design as a zip with `screens.json` at the root and my PNGs under `images/`, so that it drops into my app's folder as-is.
6. As an app author, I want the Designer to keep my open design in the browser automatically, so that a refresh or a closed tab doesn't lose my work.
7. As an app author, I want the Designer to offer to restore my last design when I reopen it, so that I can pick up where I left off.
8. As an app author, I want undo and redo for every edit, so that I can experiment safely.
9. As an app author, I want to be told clearly when an uploaded file isn't a valid screen file or uses an unknown schema, so that I don't silently lose data.

### Screens

10. As an app author, I want to add, rename, duplicate and delete screens, so that I can shape my app's structure.
11. As an app author, I want to see a list of all screens in my screen file, so that I can move between them.
12. As an app author, I want to mark one screen as the first screen, so that the app opens on it.
13. As an app author, I want every screen shown at the head unit's real size (1796×632) inside a mock of the HMI page, with its title bar, so that I design against what the driver will see.
14. As an app author, I want to give each screen a title, so that the HMI page's title bar shows it.
15. As an app author, I want to pick one of the kit's themes for the whole screen file, so that my app looks consistent.

### Elements

16. As an app author, I want a palette of every widget the kit can draw (buttons, toggles, sliders, dropdowns, tabs, cards, tiles, rows, lists, nav rail, title bar, metric, progress, colour picker, picture, text, field), so that I can build any screen the Store could.
17. As an app author, I want to drag a widget from the palette onto a screen, so that I can place an element.
18. As an app author, I want to move and resize elements with the mouse and with arrow keys, so that I can position them precisely.
19. As an app author, I want elements to snap to a grid, to each other's edges and to guides, so that layouts line up.
20. As an app author, I want the 8 px focus-ring margin shown around each element and the screen's edges, so that the highlight never gets clipped or overlaps a neighbour.
21. As an app author, I want to type an element's exact x, y, width and height, so that I can match a spec.
22. As an app author, I want to select several elements and move, align or delete them together, so that I can edit layouts quickly.
23. As an app author, I want to copy and paste elements within and between screens, so that I can reuse parts.
24. As an app author, I want each new element to get a unique name on its screen (such as `button1`), so that my code can refer to it straight away.
25. As an app author, I want to rename an element and be stopped if the name is already used on that screen, so that names stay unique.
26. As an app author, I want a property panel that shows exactly the options of the selected widget, with the right input for each (text, number, colour, toggle, choice, icon, image), so that I don't need to know the kit's internals.
27. As an app author, I want the options I set to be what the driver sees until my app changes them, so that screens look right before my code runs.
28. As an app author, I want to enter the default rows of a list element, so that the list looks realistic in the preview and before my app fills it.
29. As an app author, I want to pick an icon from the kit's vector icons, so that I can use consistent icons without making images.
30. As an app author, I want to upload my own PNGs and use them in picture elements, so that I can show my own artwork.
31. As an app author, I want images I no longer use to be left out of the download, so that my app stays small.

### Text and languages

32. As an app author, I want to add languages to my screen file, so that my app can be shown in the driver's language.
33. As an app author, I want to switch the language the Designer shows and edits, so that I can enter every text in each language.
34. As an app author, I want a text that has no translation in a language to fall back to the default language, so that nothing appears empty.
35. As an app author, I want to see which texts are missing a translation, so that I can complete them.

### Focus order, actions and navigation

36. As an app author, I want the focus order to follow reading order (top to bottom, left to right) by default, so that most screens need no work.
37. As an app author, I want to see the focus order numbered on the screen and reorder it, so that the controller moves the way I intend.
38. As an app author, I want to leave an element out of the focus order (for example a static text), so that the controller skips it.
39. As an app author, I want each element's action to default to its name, so that my code can react to it without extra setup.
40. As an app author, I want to give an element a different action name, so that several elements can report the same action.
41. As an app author, I want to link an element to another screen, so that selecting it opens that screen without any code.
42. As an app author, I want to see a screen's navigation links, so that I understand how my app's screens connect.
43. As an app author, I want to be warned about links to screens that no longer exist, so that the driver never hits a dead end.

### Preview

44. As an app author, I want the preview drawn by the same kit and runtime the head unit uses, so that what I see is what the driver sees.
45. As an app author, I want to try the screen with the arrow keys and Enter as a stand-in for the iDrive controller, so that I can check the focus order.
46. As an app author, I want to click elements in the preview as if they were tapped, so that I can check touch behaviour.
47. As an app author, I want the preview to follow navigation links and BACK, so that I can walk through my app's screens.
48. As an app author, I want to see the actions the preview reports, so that I know what my code will receive.
49. As an app author, I want selecting a field in the preview to open the keyboard screen, so that I can check text entry.

### Text entry

50. As an app author, I want to place a field element on a screen, so that the driver can enter text.
51. As a driver, I want selecting a field to open a keyboard screen, so that I can type text with the controller or by touch.
52. As a driver, I want to confirm or cancel what I typed, so that I return to the screen I came from either way.
53. As an app author, I want the typed text reported as the field's action, with the text as its value, so that my code gets it in one place.

### On the head unit

54. As a driver, I want designed apps drawn smoothly by the renderer inside the HMI page, so that they feel like part of the car.
55. As a driver, I want to move between elements with the iDrive controller and press to select, so that I can use the app while keeping my eyes mostly on the road.
56. As a driver, I want to tap elements on the touchscreen, so that I can use the app either way.
57. As a driver, I want BACK to return to the previous screen and to leave the app from its first screen, so that the app behaves like every stock page.
58. As an app author, I want to load my screen file with the runtime and show its first screen with one call, so that getting started takes a few lines.
59. As an app author, I want to set an element's value (text, toggle state, slider position, list rows, progress, picture) from my code, so that the screen shows live data.
60. As an app author, I want to receive actions with the screen and element that reported them, and any value, so that I can react to the driver.
61. As an app author, I want to be told when the runtime opens a screen through a navigation link or BACK, so that I can load that screen's data.
62. As an app author, I want to open a screen from my code, so that my app can move on its own (for example after a task completes).
63. As an app author, I want the runtime to refuse a screen file with an unknown schema with a clear log message, so that a mismatch doesn't fail silently.
64. As an app author, I want the kit bundled in my app, so that my app never depends on another component's kit version.

### Starter app

65. As an app author, I want a starter app with a screen file, the runtime, the kit and a small example of handling actions and setting values, so that I can copy it and start.
66. As an app author, I want the starter app to pack with the existing `oap_pack.js`, so that I publish it like any other app.
67. As an app author, I want instructions to replace the starter app's screen file with my Designer download, so that my design runs on the head unit in a few steps.

### Maintainers

68. As a maintainer, I want a test that fails when the widget catalog and the vendored kit disagree, so that the Designer never offers a widget or option the kit can't draw.
69. As a maintainer, I want a script that syncs the vendored kit from a pinned mgu-store commit, so that kit updates are deliberate and traceable.

## Implementation Decisions

- **Screen file format** (ADR-0001): the Store's existing screen format, unchanged: `design` (`w: 1796, h: 632`), `screens[]` each with `name`, `kind`, `title`, `theme`, `bg`, `components[]` (`name`, `rtype`, `gpu` widget name, `x`, `y`, `w`, `h`, `opts`, optional `onTap`). Added fields: top-level `schema: 1`, `languages` (list, first is the default), `first` (the first screen's name); per screen an optional `focus` (ordered element names; absent means reading order) and `nav` (map of action name to screen name). The file's `components` key is the legacy spelling of **Element**. Any text option is either a string or a map of language code to string. Image options refer to a vector icon by name or to a PNG by a path relative to the screen file (`images/…`).
- **Theme** is chosen once per screen file from the kit's existing themes (`m_red`, `m_tricolour`, `ice`, `amber`), written on every screen so the Store's drawing code reads it unchanged.
- **Placement**: embed only (inside the HMI page), one fixed size of 1796×632. No layer placement and no auto layout.
- **Modules**:
  - **Kit (vendored)**: a pinned, unmodified copy of mgu-store's kit (`kit_*`, `am_widgets`, `am_gpu` and their fonts and icons), refreshed by a sync script that records the source commit. The canonical copy stays in mgu-store. New widgets and themes land in mgu-store's kit first.
  - **Runtime** (Node 8, CommonJS, runs on the head unit and, bundled, in the browser). Interface: load a screen file; show a screen; set an element's value; open a screen from code; subscribe to actions (`{ screen, element, action, value? }`) and to screen changes; feed controller input (left, right, press, back) and touch points. It resolves focus order (explicit or reading order), draws through the kit's recording surface, routes a tap or a press on an element to that element's action (default: the element's name), follows `nav` links, keeps a screen stack for BACK (BACK on the first screen leaves the app), resolves text in the active language with fallback to the default language, and owns the **keyboard screen** for field elements (reporting the typed text as the field's action value; cancel reports nothing). The recording is sent to the renderer through the existing render client on the head unit, or played into a canvas in the browser.
  - **Widget catalog**: a hand-written description of each kit widget: its name, its options with their kinds (text, number, colour, boolean, choice, icon, image, rows) and their defaults, and whether it takes focus by default. It drives the Designer's palette and property panel.
  - **Designer document model** (TypeScript, no React): the in-memory screen file and every edit as an operation (add/rename/duplicate/delete screen, set first screen, set theme, add/move/resize/rename/delete element, set option, set text per language, add language, set focus order, include or exclude from focus, set action, link navigation, add/remove image), with undo/redo, validation (unique element names per screen, links to existing screens, schema), import from zip and export to zip (unused images dropped). Autosave serialises the model to browser storage.
  - **Designer UI** (React + Vite + TypeScript): screen list, palette, canvas with snapping, guides and focus-ring margins, property panel, focus-order overlay, navigation view, language switcher, and a preview mode that runs the runtime in the browser with keyboard and mouse as controller and touch. The kit's CommonJS files load through Vite with a browser `zlib` shim. No server; files move by upload and download only.
  - **Starter app**: a minimal app (`mgu-app.json`, `screens.json`, `images/`, runtime, kit, an example entry that handles actions and sets values) that packs with the existing `oap_pack.js` and links the oap-sdk from a donor bundle, as in mgu-store; no BMW SDK or firmware-derived files are committed.
- **Distribution**: the repository is private for now; the Designer is run locally from the repository (Vite dev server or a static build opened locally).

## Testing Decisions

- A good test drives a module through its public interface and checks what an outside observer sees: the recording sent to the renderer, the actions reported, the screen file produced. It never checks internal state or private helpers.
- **Seam 1: runtime → recording.** Given a screen file and a sequence of inputs (controller moves, presses, BACK, taps, values set from code), assert the kit recording produced for each frame and the actions and screen changes reported. Covers focus order (explicit and reading order), action defaults and overrides, navigation, the BACK stack, language fallback, list rows, the keyboard screen and schema rejection. The golden test draws the same screen files in Node and in the browser build and requires identical recordings, which is what proves the preview matches the head unit. Prior art: mgu-render's recorded sessions (`test/sessions`, replayed byte for byte), the Store's `tools/test_screens.js` and `tools/shots.js`.
- **Seam 2: document model → screen file.** Apply sequences of edit operations and assert the resulting screen file, validation errors, undo/redo, and zip round-trips (import then export gives the same file; Store screens import unchanged; unused images dropped). The React UI is not tested directly.
- **Seam 3: widget catalog ↔ vendored kit.** Fails when a widget or option exists in one and not the other, and draws every catalog widget with its defaults through the kit without errors.
- **Emulator check**: the starter app with a Designer-made screen file is installed and walked through in the head-unit emulator (mgu-emulator, iDrive 7) before the work is called done, per mgu-store's AGENTS.md.

## Out of Scope

- iDrive 8 (design size, `RemoteHmiApplication2`, its emulator preset).
- Stock HMI widgets (RHMI) and any renderer other than mgu-render.
- Layer placement; responsive or auto layout.
- Generated code of any kind (ADR-0001).
- Custom themes, per-screen themes and custom colour palettes.
- Per-row list templates.
- New widgets that the kit doesn't already draw.
- Opening and saving a folder in place (File System Access API); any server or cloud storage.
- Sending a design straight to the emulator or the car from the Designer.
- Writing app bundles (`mgu-app.json`, `release.json`) from the Designer; publishing to a Store source.
- Moving the kit's canonical copy out of mgu-store, or a shared kit component on the head unit.
- Public hosting and a licence for this repository.

## Further Notes

- Glossary: `GLOSSARY.md`. Decision record: `docs/adr/0001-screen-file-drawn-at-runtime.md`.
- The kit and the Store's screens derive from IterioDev's App Manager 2 and its HMI UI builder export, and from cauliflowermossgrape's idrive7-apps kit, both MIT; keep their licence notices with the vendored kit.
- The Store lays its screens out for iDrive 7 in its compact layout (1796×632, 8 px focus ring 5 px wide); the Designer's canvas and margins follow it.
