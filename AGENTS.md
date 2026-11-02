# mgu-ui-builder

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Layout and tooling

- `kit/`: the vendored kit, a pinned unmodified copy of mgu-store's (`SOURCE.json` records the commit and each file's blob id). Never edit it; change the kit in mgu-store, then `npm run sync-kit -- --from <mgu-store clone> --commit <rev>`.
- `runtime/`: the runtime (Node 8, CommonJS; modules require each other and the kit by basename, `./x.js`, as the OAP linker lays an app out flat). `mgu_runtime.js` is the platform-free core (screen file in, recordings out to a sink, input in); `mgu_focus.js` holds focus order, actions, hit testing and the focus ring; `mgu_headunit.js` adapts it to the render client. `designer/`: the Designer (React + Vite + TypeScript, an npm workspace: run `npm install` at the root). `npm run designer` starts the dev server, `npm run build-designer` type-checks and writes the static build to `designer/dist/`. Its preview runs the runtime and the kit unchanged in the browser through the `virtual:mgu-runtime` module (`designer/vite.config.ts`: esbuild bundles them flat, `zlib` and `Buffer` shimmed in `designer/src/shims/`). The Designer's document model is `designer/src/model/` (TypeScript, no React; Node runs it directly in the tests): every edit is an operation applied by `apply(doc, op)` (undo/redo in `history.ts`); each group of operations is a module under `model/ops/` exporting handlers, merged in `model/operations.ts`, so a new group is a new module plus one line there. `designer/src/catalog.ts` is the hand-written widget catalog (kept equal to the kit by `test/widget-catalog.test.js`). Model files import each other with `.ts` extensions. `starter/`: the starter app, created by its ticket.
- `test/*.test.js`: all tests, run with `npm test` (`node --test`). `test/fixtures/mgu-store/` holds Store files synced with the kit; `test/golden/` holds golden recordings (refresh with `UPDATE_GOLDEN=1 npm test` after a deliberate sync).
- `test/designer-preview-golden.test.js` builds the Designer and drives it in Playwright's Chromium (`require('playwright')`; skipped without it), requiring every preview frame to equal Node's recording of the same screen.
- `NODE8=<node 8 binary> npm test` also runs the runtime under Node 8 (`npm pack node-linux-x64@8.16.2` gives one); skipped without.
- The sync test needs a local mgu-store clone (`MGU_STORE`, default `../mgu-store`) and is skipped without one.
