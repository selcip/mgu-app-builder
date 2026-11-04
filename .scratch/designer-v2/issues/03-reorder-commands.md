# 03: Bring forward / send backward commands

**Spec:** `.scratch/designer-v2/spec.md`

**What to build:** Bring forward (Ctrl+]), Send backward (Ctrl+[), Bring to front (Ctrl+Shift+]) and Send to back (Ctrl+Shift+[) in `shell/commands.ts`, in the main menu, on the canvas's right-click menu, and on the keyboard in `shell/keys.ts`. They act on the selection, and never while typing or trying.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Playwright covers each command from the menu and from its key
- [ ] Commands are disabled or do nothing when the selection is already at that end
