// The car's view: what the driver cannot see of the cluster (the hood over the top corners, BMW's gear box and the
// seat-belt light) and which elements of a layout sit under it. The geometry and the reasons are the engine's own
// (engine/shared/visible.js, passed in so this module needs no bundler: Node tests give it the file, the Designer
// the one bundled with the engine). Warnings are the layout check's lines, per widget id; they never block saving.
export interface Visible {
    HOOD: number[][];
    BLACK_BOX: number[];
    BELT: number[];
    check(widgets: unknown[], target: string): string[];
}

export interface Rect { x: number; y: number; w: number; h: number }

/** The reasons (the engine's text, without the id) for each element of the layout that is hidden by something, by widget id. */
export function warningsOf(layout: { widgets: unknown[] }, visible: Visible): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const w of layout.widgets) {
        if (!w || typeof w !== 'object') continue;
        const id = String((w as { id?: unknown }).id);
        const prefix = id + ': ';
        const lines = visible.check([w], 'panel').map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l));
        if (lines.length) out[id] = (out[id] || []).concat(lines);
    }
    return out;
}

const rectOf = (b: number[]): Rect => ({ x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] });

/** The three masks: the hood as a polygon over the top edge (corner to corner along the curve), the two boxes. */
export function masksOf(visible: Visible): { hood: number[][]; gearBox: Rect; belt: Rect } {
    const last = visible.HOOD[visible.HOOD.length - 1];
    return {
        hood: [[0, 0], ...visible.HOOD.map((p) => [p[0], p[1]]), [last[0], 0]],
        gearBox: rectOf(visible.BLACK_BOX),
        belt: rectOf(visible.BELT),
    };
}
