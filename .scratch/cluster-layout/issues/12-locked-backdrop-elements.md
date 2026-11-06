# 12: Locked backdrop elements (M and Sport)

**What to build:** The whole-theme shaders of M and Sport (backdrop, rev blade) open as one locked element each. The author can move, resize, condition, stack and delete it, but its internals are read-only in the inspector, with a note on what it draws and why it is locked. M and Sport can be opened, edited around the locked element, and saved.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] M and Sport open with their backdrop shown as a locked element
- [ ] Locked internals cannot be edited; the inspector says what it draws
- [ ] Move, resize, condition, stack and delete work on it
- [ ] Saved file keeps the shader's parameters exactly
- [ ] Model and browser tests cover it
