# 09: Languages

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app author adds languages to the screen file and enters every text in each: any text option is either a plain string or a map of language code to string, and the first language in `languages` is the default. The runtime shows the active language and falls back to the default language for any missing text. The Designer has a language switcher and shows which texts are missing a translation.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The screen file holds `languages`; text options accept a string or a per-language map
- [ ] The runtime draws the active language and falls back to the default for missing texts
- [ ] The Designer's language switcher edits and previews each language
- [ ] Missing translations are listed in the Designer
- [ ] Store screen files with plain strings keep working
