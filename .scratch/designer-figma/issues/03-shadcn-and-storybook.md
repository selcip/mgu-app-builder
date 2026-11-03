# 03: shadcn on Base UI, Tailwind v4, dark appearance and Storybook

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Set up Tailwind v4 and shadcn (Base UI) in `designer/`, with the dark appearance tokens, and Storybook (Vite builder, reusing the Designer's Vite config) with a decorator that sets up a store from a fixture screen file. Add the fixtures named in the spec, and one story for an existing panel to prove the setup.

**Blocked by:** 02

**Status:** resolved

- [x] `npm run build-designer` type-checks and builds with Tailwind
- [x] A root `npm run storybook` opens with one working panel story
- [x] Fixture screen files exist for empty, typical, dead links, missing images and text issues

## Comments

2026-11-03: Tailwind v4 comes in through `@tailwindcss/vite`, and `@/` resolves to `designer/src` in both Vite and tsconfig. shadcn 4.23 was initialised with `--base base` (Base UI 1.9) and the `base-nova` preset, in `designer/components.json`. Its `cn` is shadcn's own `cn` package, and it brings Geist and Lucide. The dark appearance is shadcn's neutral `.dark` tokens, switched on by `class="dark"` on `<html>`. `styles.css` is unlayered, so it still wins over Tailwind's base styles until the panels move to shadcn. Storybook 10.6 is in `designer/.storybook/`: the React Vite framework with telemetry off. A global decorator makes one editor store per story from `parameters.screenFile`, with `parameters.editor` for extra setup. The fixtures are in `designer/src/fixtures/screen-files.ts`, built from model operations, and `test/story-fixtures.test.js` keeps each one showing its case. `src/Navigation.stories.tsx` has three stories, which render in the static build and the dev server: NoLinks, Typical (live: selecting a link selects its screen) and DeadLinks. `npm audit` reports 9 low/moderate findings, all in dev tooling (Storybook's docgen plugin and the shadcn CLI, through glob, minimatch and deepmerge); none ships in the Designer. `npm test`: 209 pass, 0 fail, 3 skipped (Node 8).
