# 02: Runtime shows a screen file

**Spec:** `.scratch/designer-v1/spec.md`

**What to build:** An app's code loads a screen file with the runtime and shows its first screen: the runtime reads `schema: 1`, `design`, `first` and the screens, draws the first screen's elements in the screen file's theme through the kit's recording surface, and hands the recording to a sink (the render client on the head unit, a buffer in tests). A screen file with a missing or unknown schema is refused with a clear log message. Store screen files (no `schema`, no `first`) are drawn too, the first listed screen being the first screen.

**Blocked by:** 01

**Status:** resolved

- [x] Loading a valid `schema: 1` screen file and showing it produces the recording of its `first` screen
- [x] The theme named in the screen file is the one drawn
- [x] An unknown `schema` value is refused with a log message naming the value; nothing is drawn
- [x] A Store screen file draws unchanged, starting from its first listed screen
- [x] Tests drive the runtime through its public interface only and compare recordings with golden files
