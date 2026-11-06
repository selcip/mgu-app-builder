# 06: Add elements and edit widget options

**What to build:** The insert menu offers the generic cluster widgets. Each placed element has its options in the inspector with their defaults and ranges, a role picker over the layout's palette (shown read-only with each role's colour), and for text a template editor using the engine's tokens, a font list and alignment. The cluster widget catalog is hand-written and kept equal to the engine's validator by a test.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Insert menu lists text, GPU text, boxes, fill, rev bar, shift lights, arc, segment bar, icon, badge, scale, stripe and shift bar
- [ ] Option fields per widget with defaults; invalid values are refused with the engine's reason
- [ ] Role picker and read-only palette
- [ ] Text template with token picker, font and alignment
- [ ] Catalog-equals-validator test fails when the engine adds or changes a widget or option
- [ ] A layout built from nothing saves, reopens equal, and draws
