# 11: Text entry and the keyboard screen

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author places a field element on a screen. When the driver selects it, the runtime opens its own keyboard screen (the Store's text box and on-screen keyboard), usable with the controller and by touch. Confirming returns to the screen and reports the typed text as the field's action value; cancelling returns and reports nothing. It works the same in the preview.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Selecting a field opens the runtime's keyboard screen with the field's current text
- [ ] Confirm returns to the previous screen and reports `{ screen, element, action, value }` with the typed text
- [ ] Cancel returns and reports nothing
- [ ] Controller and touch both work on the keyboard screen
- [ ] The preview opens the keyboard screen too; tested at the recording seam
