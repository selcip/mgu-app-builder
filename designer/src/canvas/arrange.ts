// Distributing elements: spacing three or more evenly between the outermost two, across or down, with equal gaps.
// It gives the boxes for one setBoxes edit (the model has no operation of its own for it). Plain maths, no DOM.
import type { Box, Screen } from '../model/index.ts';

export type Axis = 'across' | 'down';

/** The new x (across) or y (down) of each named element, or null when fewer than three are named. */
export function distribute(screen: Screen, names: string[], axis: Axis): Record<string, Partial<Box>> | null {
    const els = screen.components.filter((c) => names.includes(c.name));
    if (els.length < 3) return null;
    const pos = axis === 'across' ? 'x' : 'y', size = axis === 'across' ? 'w' : 'h';
    const sorted = [...els].sort((a, b) => a[pos] - b[pos] || a.name.localeCompare(b.name));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const span = last[pos] + last[size] - first[pos];
    const gap = (span - sorted.reduce((t, c) => t + c[size], 0)) / (sorted.length - 1);
    const out: Record<string, Partial<Box>> = {};
    let at = first[pos];
    for (const c of sorted) {
        out[c.name] = { [pos]: Math.round(at) };
        at += c[size] + gap;
    }
    return out;
}
