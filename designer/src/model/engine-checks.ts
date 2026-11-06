// What the model asks the vendored cluster engine without drawing: whether it accepts a widget, and the palette of a
// layout's theme. The engine is CommonJS with Node shims, so the model does not import it: whoever runs the model
// registers the checks (cluster/checks.js) once, the Designer's main.tsx from the engine bundle, a Node test from
// cluster/node.js. Editing a layout's widgets refuses until they are registered.
export interface PaletteRole { role: string; rgba: [number, number, number, number] }

export interface EngineChecks {
    /** Why the engine refuses the widget (its own words), or null. */
    problem(widget: unknown, target?: string): string | null;
    /** The roles (name and colour) of the palette a layout's `theme` names; an unknown or missing theme gets the engine's fallback. */
    palette(theme: unknown): PaletteRole[];
    /** The names of the vector icons the engine draws. */
    icons(): string[];
}

let current: EngineChecks | null = null;

export function setEngineChecks(checks: EngineChecks | null): void { current = checks; }

export function engineChecks(): EngineChecks {
    if (!current) throw new Error('The cluster engine’s checks are not registered (setEngineChecks).');
    return current;
}
