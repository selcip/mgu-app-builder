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
- `runtime/`: the runtime (Node 8, CommonJS; modules require each other and the kit by basename, `./x.js`, as the OAP linker lays an app out flat). `mgu_runtime.js` is the platform-free core (screen file in, recordings out to a sink, input in); `mgu_headunit.js` adapts it to the render client. `designer/`: the Designer (React + Vite + TypeScript). `starter/`: the starter app. Created by their tickets.
- `test/*.test.js`: all tests, run with `npm test` (`node --test`). `test/fixtures/mgu-store/` holds Store files synced with the kit; `test/golden/` holds golden recordings (refresh with `UPDATE_GOLDEN=1 npm test` after a deliberate sync).
- `NODE8=<node 8 binary> npm test` also runs the runtime under Node 8 (`npm pack node-linux-x64@8.16.2` gives one); skipped without.
- The sync test needs a local mgu-store clone (`MGU_STORE`, default `../mgu-store`) and is skipped without one.
