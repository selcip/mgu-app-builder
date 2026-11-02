# The designer edits a screen file that the kit draws at runtime

The designer saves a screen file and generates no code: the app ships the file and draws it on the head unit with the kit, bundled into each app. The screen file is the Store's existing screen format (`design`, `screens[]` with `components[]`) unchanged, plus `schema: 1` and the optional `focus` and `nav` fields, so the Store's drawing code reads it as-is and the Store's screens open in the designer without conversion.

## Considered Options

- **Generated JS draw code per screen**: rejected. It is a second drawing path beside the one the Store already runs on iDrive 7, and app authors could not hand-edit output without losing it on the next regeneration.
- **A new format with glossary-aligned keys** (`elements`, `widget`, `action`): rejected. It would need converting both ways with the Store's format for no gain on the head unit. The file's `components` key is the legacy spelling of **Element**.

## Consequences

- The screen format is locked in once apps ship: a breaking change needs a new `schema` value that the runtime still reads beside the old one.
- The kit's canonical copy stays in mgu-store; this repo vendors a pinned copy. Each app bundles its own kit, so no app depends on another component's kit version.
