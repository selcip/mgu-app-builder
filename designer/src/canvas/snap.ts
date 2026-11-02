// Snapping on the canvas: while an element is dragged or resized, its edges and centre snap to the lines near
// them (the other elements' edges and centres, the screen's edges and centre, the focus-ring margin inside the
// screen's edges, and the app author's guides), else to the grid. Pure functions, no React.
import type { Box, Screen } from '../model/index.ts';

/** The focus ring is drawn 8 px outside an element (5 px wide): an element needs that much room inside the screen. */
export const RING_MARGIN = 8;

/** Vertical lines (x) and horizontal lines (y) to snap to. */
export interface Lines {
    xs: number[];
    ys: number[];
}

export interface SnapOptions {
    grid: number;           // grid step in px; 0 = no grid
    threshold: number;      // how close an edge must be to a line to snap to it; 0 = no line snapping
}

/** What a snap gives: the box, and the lines it snapped to (shown on the canvas while dragging). */
export interface Snapped {
    box: Box;
    shown: Lines;
}

/** A side or corner of the box being dragged: n, s, e, w, ne, nw, se, sw. */
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The lines the elements not in `moving` give, with the screen's own lines and the guides. */
export function snapLines(screen: Screen, moving: readonly string[], guides: Lines, design: { w: number; h: number }): Lines {
    const xs = [0, RING_MARGIN, design.w / 2, design.w - RING_MARGIN, design.w, ...guides.xs];
    const ys = [0, RING_MARGIN, design.h / 2, design.h - RING_MARGIN, design.h, ...guides.ys];
    for (const c of screen.components) {
        if (moving.includes(c.name)) continue;
        xs.push(c.x, c.x + c.w / 2, c.x + c.w);
        ys.push(c.y, c.y + c.h / 2, c.y + c.h);
    }
    return { xs: [...new Set(xs.map(Math.round))], ys: [...new Set(ys.map(Math.round))] };
}

/** The nearest line to any of `points` within `threshold`: the shift that puts that point on it. */
function nearest(points: number[], lines: number[], threshold: number): { shift: number; line: number } | null {
    let best: { shift: number; line: number } | null = null;
    for (const p of points) {
        for (const l of lines) {
            const d = l - p;
            if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.shift))) best = { shift: d, line: l };
        }
    }
    return best;
}

const toGrid = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid : Math.round(v));

/** One axis of a move: start and size; returns the snapped start and the line used, if any. */
function moveAxis(start: number, size: number, lines: number[], o: SnapOptions): { start: number; line?: number } {
    const hit = o.threshold > 0 ? nearest([start, start + size / 2, start + size], lines, o.threshold) : null;
    if (hit) return { start: Math.round(start + hit.shift), line: hit.line };
    return { start: toGrid(start, o.grid) };
}

/** Snaps a box being moved. */
export function snapMove(box: Box, lines: Lines, o: SnapOptions): Snapped {
    const x = moveAxis(box.x, box.w, lines.xs, o);
    const y = moveAxis(box.y, box.h, lines.ys, o);
    return {
        box: { x: x.start, y: y.start, w: Math.round(box.w), h: Math.round(box.h) },
        shown: { xs: x.line === undefined ? [] : [x.line], ys: y.line === undefined ? [] : [y.line] },
    };
}

/** One dragged edge: snapped to a line near enough, else to the grid. */
function edge(v: number, lines: number[], o: SnapOptions): { v: number; line?: number } {
    const hit = o.threshold > 0 ? nearest([v], lines, o.threshold) : null;
    return hit ? { v: hit.line, line: hit.line } : { v: toGrid(v, o.grid) };
}

/** Snaps a box being resized by `handle`: only the dragged edges move; the size never goes below 0. */
export function snapResize(box: Box, handle: Handle, lines: Lines, o: SnapOptions): Snapped {
    let l = box.x, t = box.y, r = box.x + box.w, b = box.y + box.h;
    const shown: Lines = { xs: [], ys: [] };
    const put = (s: { v: number; line?: number }, into: number[]) => { if (s.line !== undefined) into.push(s.line); return s.v; };
    if (handle.includes('w')) l = put(edge(l, lines.xs, o), shown.xs); else l = Math.round(l);
    if (handle.includes('e')) r = put(edge(r, lines.xs, o), shown.xs); else r = Math.round(r);
    if (handle.includes('n')) t = put(edge(t, lines.ys, o), shown.ys); else t = Math.round(t);
    if (handle.includes('s')) b = put(edge(b, lines.ys, o), shown.ys); else b = Math.round(b);
    if (handle.includes('w')) l = Math.min(l, r); else r = Math.max(r, l);
    if (handle.includes('n')) t = Math.min(t, b); else b = Math.max(b, t);
    return { box: { x: l, y: t, w: r - l, h: b - t }, shown };
}
