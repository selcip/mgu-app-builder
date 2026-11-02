# 12: Autosave, restore and upload validation

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** The Designer keeps the open design in browser storage as the app author edits, and offers to restore it on reopening. Uploading something that isn't a valid screen file, or one with an unknown schema, shows a clear error and leaves the current design untouched.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Every edit is autosaved to browser storage; reopening offers to restore the last design
- [ ] Declining the restore starts a new design; the stored copy is replaced on the next edit
- [ ] An invalid zip, invalid JSON or unknown schema shows a clear error and changes nothing
- [ ] Storage failures (quota, private mode) are reported and don't break editing
