# 02: Vendor the engine and the stand-in

**What to build:** This repo holds a pinned, unmodified copy of the apps repo's engine (shared drawing code), the stand-in modules from ticket 01 and the baked fonts, with a record of the source commit and each file's blob id, a sync script, and a test that checks the copy against a local apps-repo clone (skipped without one). A Node test runs the GT3 layout through the engine against the in-memory stand-in (no socket) and gets a frame. This settles the spec's open assumption that the engine bundles with shims alone; if it does not, record what the apps repo must make injectable.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Vendored folder with a pin record, never edited here
- [ ] A sync command updates it from the apps repo at a given commit; the sync test fails when the copy has drifted
- [ ] The engine's Node-only pieces (socket, file access, kit context) are shimmed for the browser, with an in-memory pipe in place of the socket
- [ ] A Node test draws GT3 and checks the layers it registers
- [ ] AGENTS.md names the vendored folder and its rules
