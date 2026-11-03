# Spec: Designer layout like Figma (shadcn, Storybook, floating panels)

Status: ready-for-agent

## Problem Statement

The Designer works, but its UI is hard to change and awkward to use. All editor state and layout live in one `App` component. All styling is hand-written in one stylesheet. The canvas has a fixed width and scrolls sideways, and its edit bar wraps. The right side is one long column of about eight stacked sections. The side areas are fixed columns that always take space from the canvas. App authors who know Figma find nothing where they expect it, and nothing about a panel can be worked on alone.

## Solution

Rebuild the Designer's UI layer around a **canvas** with pan and zoom and two **panels**, laid out like Figma's UI3. The app author can switch each panel between **docked** and **floating**. Editor state moves into a store over the existing model. The UI is built from shadcn components on Base UI, in a dark **appearance**. Each panel can be developed in Storybook against fixture screen files. The screen file, the model, the runtime and the kit do not change. See `docs/adr/0002-designer-ui-zustand-shadcn-base-ui.md`.

## User Stories

1. As an app author, I want the screen I'm editing to fill the space between the panels, with pan (space-drag, middle mouse) and zoom (Ctrl+wheel, Ctrl+0 for 100 %, Shift+1 to fit), so that I can work on a 1796 × 632 screen on any monitor.
2. As an app author, I want the screen shown inside its HMI page with the title bar, at every zoom level, so that I still see it as the head unit shows it.
3. As an app author, I want the screens and the current screen's elements in one left panel, Screens above Elements, so that I can move around the app like Figma's layer list.
4. As an app author, I want the right panel to have a Design tab (box, align, distribute, options, rows, pictures) and a Prototype tab (action, link, focus order, navigation view), so that layout and behaviour are each in one place.
5. As an app author, I want the right panel to show the screen and the screen file's settings (theme, languages, pictures, text issues) when no element is selected, so that settings for the whole file have a home.
6. As an app author, I want to switch each panel between docked and floating on its own, so that I can give the canvas more room when I need it.
7. As an app author, I want to drag a floating panel by its header, resize its width and collapse it to its header, so that it stays out of the way.
8. As an app author, I want the Designer to remember each panel's mode, position, width and collapsed state in this browser, so that my layout survives a reload.
9. As an app author, I want Ctrl+\ to hide and show both panels, so that I can see the screen alone.
10. As an app author, I want a slim top toolbar with the file menu (New, Open, Download), undo and redo, a searchable insert menu for widgets (click to add, or drag onto the canvas), a View menu (grid, snap, guides, focus order) and zoom, so that the commands I use often are always in reach.
11. As an app author, I want a Play button that starts trying the app on the canvas, hides the editing panels and shows the report in its own floating panel, so that trying feels like Figma's Present.
12. As an app author, I want Figma's shortcuts (undo/redo, copy/paste/duplicate, Delete, arrow nudges with Shift for 10 px, select all), so that my habits carry over. While I am trying the app, keys go to the controller instead.
13. As an app author, I want the Designer to keep its current behaviour: every edit, refusal message, autosave and restore works as before, so that nothing I rely on is lost in the restyle.

## Implementation Decisions

- Scope is the Designer's UI layer only: `designer/src/*.tsx`, the CSS and the state wiring. `model/`, `catalog.ts`, `preview.ts`, `runtime/`, `kit/` and `starter/` keep their interfaces.
- **Store**: Zustand, wrapping `createHistory`/`dispatch`/`undo`/`redo`. It holds the selected screen, the selection, view settings (grid, snap, guides, focus order shown, zoom, pan), clipboard, drag preview op, shown language, trying, reports and refusal messages. `edit(op)` keeps today's contract: a refusal sets the message and changes nothing. Panel layout (mode, position, width, collapsed) lives in a separate slice, persisted to `localStorage`.
- **UI kit**: shadcn on Base UI, Tailwind v4, with shadcn components in `designer/src/components/ui/`. The dark appearance uses shadcn's CSS-variable tokens; light mode is out of scope. The canvas overlay (handles, guides, snap lines, focus-ring margins, marquee) keeps a small scoped CSS file.
- **Folders**: `components/ui/` (shadcn), `shell/` (toolbar, panel frame, canvas viewport), `panels/<name>/` (panel component and its stories), `store/`.
- **Words on screen** follow `GLOSSARY.md`: Screens, Elements, Widgets, Theme (the kit's), Appearance (the Designer's). "Component" appears only in code.
- **Canvas**: one screen at a time, so the preview stays a single runtime instance. Zoom scales the HMI page with a CSS transform. Pointer-to-screen-pixel conversion in the canvas and while trying must take zoom and pan into account.
- **Storybook** lives in the `designer` workspace and uses the Vite builder. A decorator sets up a store from a fixture document. Fixtures: an empty screen file, a typical screen file, one with dead links, one with missing images, and one with untranslated and undrawable text. The live preview gets no stories.
- **Migration** is incremental on this branch, in the issue order below. `npm test` must pass after every issue.

## Testing Decisions

- `npm test` stays the only gate. Storybook is not wired into it.
- Browser tests find things by `data-*` hooks and ARIA roles only. Issue 01 replaces today's class selectors (`.try-panel`, `.screen-props`, `.action-field`, `.link-field`) before any restyling.
- `designer-preview-golden.test.js` must keep passing at 100 % zoom: every preview frame equals Node's recording.
- New behaviour gets tests at the cheapest level. The store's edit, refusal and selection logic is tested in Node without React. Panel modes, persistence, the panel toggle, zoom-aware hit testing and the Play/stop flow are tested in Playwright.

## Out of Scope

- All screens on one board (Figma frames); light appearance; stories run as tests; any change to the screen file, the model's operations, the runtime or the kit.
