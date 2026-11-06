# A cluster layout is its own file kind, in the apps repo's format

The Designer opens and saves two kinds of document: the screen file (HMI page, kit widgets, drawn by mgu-render) and the **cluster layout** (the instrument cluster, drawn through cluster-render). A cluster layout is the apps repo's layout JSON (`schemaVersion: 2`: `target`, `theme`, `widgets[]`) read and written as it is, so cluster-render's engine (`layouts.js`) accepts what the Designer saves with no conversion. The document model, store, history and canvas are shared; the widget catalog and the preview are per kind.

## Considered Options

- **A `surface` field on Screen in the screen file**: rejected. The screen file's format is locked (ADR 0001) and the two kinds share almost nothing: different widgets, colour roles instead of a kit Theme, conditions on settings, a different target size, no focus order or navigation.
- **Convert to and from a Designer-owned format**: rejected for the same reason as in ADR 0001: a second format to keep in step with the engine for no gain on the car.

## Consequences

- The layout format belongs to the apps repo. A change to it starts there and arrives here by sync (ADR 0005).
- Generated layouts (GT3, Sport and M come from Python generators) become hand-edited files once a layout is saved from the Designer; the generators are no longer their source.
- The layout's `target` is a field from the start, so the HUD can be added later without a model change.
