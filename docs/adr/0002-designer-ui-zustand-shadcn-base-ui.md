# The Designer's UI uses a Zustand store, shadcn on Base UI, and Storybook for panels

The Designer's editor state moves out of one App component into a Zustand store that wraps the model's existing `History` and `dispatch`. The model in `designer/src/model/` is not changed. The UI is built from shadcn components on Base UI primitives, styled with Tailwind v4. Each panel is developed in Storybook against fixture screen files. Storybook is a development tool only: `npm test` stays the only gate.

## Considered Options

- **React context with `useReducer`**: rejected. Every consumer of a context re-renders on any edit, and every panel would need hand-wired access to `edit(op)`. The store also lets a story start from any fixture document.
- **shadcn on Radix**: rejected in favour of Base UI, the primitives shadcn now also targets.
- **Stories as tests (Storybook Vitest addon)**: deferred. It would add a second test runner beside `node --test` and Playwright.

## Consequences

- Panels must render from the store and fixtures alone. The live preview, which needs the runtime and the kit, gets no stories.
- The browser tests find things only by `data-*` hooks, never by class names, so restyling cannot break them.
