# 08: Layer budget and connections

**What to build:** The Designer shows the layer budget live as the author edits: layers on each connection, layers in all and pixel memory, taken from the engine's own packing plan against the renderer's limits. The author can put an element on another connection. Going over a limit is a warning, never a block.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Counter for layers per connection, layers in all and pixel memory, updated on every edit
- [ ] Over-limit values are marked and say which limit
- [ ] An element's connection is chosen in the inspector
- [ ] Saving is never blocked
- [ ] Numbers equal the apps repo's for GT3, Sport and M (test)
