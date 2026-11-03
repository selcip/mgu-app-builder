# 02: Editor state in a Zustand store

**Spec:** `.scratch/designer-figma/spec.md`

**What to build:** Move App's state (history, selected screen, selection, view settings, clipboard, drag op, shown language, trying, reports, refusal messages) into a Zustand store under `store/`, with `edit(op)` keeping its refusal contract. App and panels read from the store. Nothing visible changes.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Edit, undo, redo, refusal and fall-back-to-first-screen logic is tested in Node without React
- [ ] No panel receives the document or `edit` through props from App
- [ ] npm test passes
