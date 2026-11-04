# 08: Right panel: Prototype tab

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Move the action field, link field, focus order panel and navigation view into the Prototype tab, in shadcn, with stories.

**Blocked by:** 07

**Status:** resolved

- [x] Existing navigation, focus and action tests pass unchanged
- [x] Stories cover the dead-links fixture

## Comments

2026-11-03: The Prototype tab is `designer/src/panels/inspector/Prototype.tsx`, with three sections:
- **Interaction:** the action and "Opens screen" for the selected element; a dead link is flagged (`data-link-problem`).
- **Focus order:** numbered rows with up, down and leave-out buttons, a "Not in focus" list, reset as an icon (`data-reset-focus`), and the toggle for numbering elements on the canvas (`data-show-focus`), which moved here from the panel's foot.
- **Navigation:** links per screen, dead ones flagged and counted (`data-dead-links`), and "<screen> is opened from".

The link labels and button titles the tests read are kept. `ActionField.tsx`, `FocusPanel.tsx` and `Navigation.tsx` are gone, and so are their stylesheet rules. The stories moved to `panels/inspector/Navigation.stories.tsx` (also InteractionDeadLink and CustomFocusOrder), with `Inspector.stories.tsx` adding PrototypeTab. All 16 stories render without page errors in the static Storybook build. `npm test` passes.
