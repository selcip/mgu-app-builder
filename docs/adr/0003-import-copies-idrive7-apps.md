# Importing an idrive7-apps app makes the app author's own copy on our runtime

idrive7-apps (`cauliflowermossgrape/idrive7-apps`) draws every screen in code, frame by frame, with its own kit (`gauges.js`). There is no layout to open in the Designer. Importing one of its apps therefore makes the app author's **own copy**: a starter-based app on our runtime. The fixed parts of each layout (frame, tabs, panels, buttons, labels) become elements in a screen file. The live gauges become **Drawing areas** that the copied code draws into. Upstream idrive7-apps is not changed. The widgets the copy needs (idrive7's frame, panel, button and label look, and the Drawing area) are proposed to mgu-store's kit and synced into `kit/` from there, like every other kit change.

## Considered Options

- **Change idrive7-apps so its kit reads screen files**: rejected. It is another project with its own authors and release cycle, so our Designer would depend on it accepting and keeping a large change to its kit.
- **Switch imported apps to our kit's existing widgets**: rejected. The imported app would no longer look like itself.
- **Import only the HMI page from `app.json`** (screens, side buttons, settings): rejected. It is easy, but none of the app's own drawing becomes editable.
- **Recover layouts automatically by recording a frame in idrive7's `sim.js`**: deferred until a second app has been ported by hand and the pattern is clear.

## Consequences

- An imported app is a fork: fixes made upstream in idrive7-apps after the import do not reach it on their own.
- The HMI's own side buttons and settings menu, which idrive7 apps use, become ordinary screen-file elements and a Settings screen. The runtime gains no HMI-menu concept.
- The copy uses the starter's renderer client (mgu-render) and drops `idrive7-renderd`.
- New widgets wait on mgu-store: the kit here stays a pinned, unmodified copy.
