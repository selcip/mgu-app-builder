// Canvas operations: move and resize elements (typed, dragged or with the arrow keys), several at once; align,
// delete and paste them. Each is one operation, so one undo step however many elements it touches.
import { elementOps } from './elements.ts';
import { DESIGN, EditError, elementOf, screenOf, uniqueName, type Draft, type Element, type Screen, type ScreenFile } from '../core.ts';

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

const KEYS = ['x', 'y', 'w', 'h'] as const;

export const EDGES = ['left', 'centre', 'right', 'top', 'middle', 'bottom'] as const;
export type Edge = typeof EDGES[number];

const designOf = (f: ScreenFile) => f.design || DESIGN;

function checkBox(name: string, b: Partial<Box>): void {
    for (const k of KEYS) {
        const v = b[k];
        if (v === undefined) continue;
        if (typeof v !== 'number' || !Number.isInteger(v)) throw new EditError(`${name}: ${k} must be a whole number of pixels.`);
        if ((k === 'w' || k === 'h') && v < 0) throw new EditError(`${name}: the ${k === 'w' ? 'width' : 'height'} can’t be negative.`);
    }
}

export const canvasOps = {
    /** Sets the given parts of each named element's box (`{ button1: { x: 20 }, ... }`). */
    setBoxes(d: Draft, a: { screen: string; boxes: Record<string, Partial<Box>> }) {
        const s = screenOf(d, a.screen);
        for (const [name, b] of Object.entries(a.boxes || {})) {
            const e = elementOf(s, name);
            checkBox(name, b || {});
            for (const k of KEYS) if (b[k] !== undefined) e[k] = b[k]!;
        }
    },

    /** Moves the named elements by dx, dy (the arrow keys). */
    moveElements(d: Draft, a: { screen: string; elements: string[]; dx: number; dy: number }) {
        const s = screenOf(d, a.screen);
        checkBox('The step', { x: a.dx, y: a.dy });
        for (const e of a.elements.map((n) => elementOf(s, n))) {
            e.x += a.dx;
            e.y += a.dy;
        }
    },
    /**
     * Aligns the named elements to one edge or centre line of the box around them all; a single element aligns
     * to the screen's.
     */
    alignElements(d: Draft, a: { screen: string; elements: string[]; edge: Edge }) {
        const s = screenOf(d, a.screen);
        if (!EDGES.includes(a.edge)) throw new EditError(`Can’t align to the edge "${a.edge}".`);
        const els = a.elements.map((n) => elementOf(s, n));
        if (!els.length) return;
        const D = designOf(d.file);
        const around = els.length === 1 ? { x: 0, y: 0, w: D.w, h: D.h } : boundsOf(els);
        for (const e of els) {
            if (a.edge === 'left') e.x = around.x;
            if (a.edge === 'right') e.x = around.x + around.w - e.w;
            if (a.edge === 'centre') e.x = Math.round(around.x + (around.w - e.w) / 2);
            if (a.edge === 'top') e.y = around.y;
            if (a.edge === 'bottom') e.y = around.y + around.h - e.h;
            if (a.edge === 'middle') e.y = Math.round(around.y + (around.h - e.h) / 2);
        }
    },

    /** Deletes the named elements (they leave the focus order too). */
    deleteElements(d: Draft, a: { screen: string; elements: string[] }) {
        const s = screenOf(d, a.screen);
        a.elements.forEach((n) => elementOf(s, n));
        for (const n of a.elements) elementOps.deleteElement(d, { screen: a.screen, element: n });
    },

    /** Adds copies of `elements` (from copyElements) on top of the screen, moved by dx, dy; see pastedNames. */
    pasteElements(d: Draft, a: { screen: string; elements: Element[]; dx?: number; dy?: number }) {
        const s = screenOf(d, a.screen);
        const dx = a.dx || 0, dy = a.dy || 0;
        checkBox('The offset', { x: dx, y: dy });
        const els = a.elements || [];
        for (const e of els) {
            if (!e || typeof e.gpu !== 'string') throw new EditError('Only elements can be pasted: this one has no widget.');
            checkBox(String(e.name), e);
        }
        const names = pastedNames(s, els);
        els.forEach((e, i) => {
            s.components.push(Object.assign(structuredClone(e), { name: names[i], x: e.x + dx, y: e.y + dy }));
        });
    },
};

/** The smallest box around all the given boxes. */
export function boundsOf(boxes: readonly Box[]): Box {
    const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
    const r = Math.max(...boxes.map((b) => b.x + b.w)), btm = Math.max(...boxes.map((b) => b.y + b.h));
    return { x, y, w: r - x, h: btm - y };
}

/** Copies of the named elements, in the screen's order (bottom first), for the clipboard. */
export function copyElements(screen: Screen, names: readonly string[]): Element[] {
    names.forEach((n) => elementOf(screen, n));
    return structuredClone(screen.components.filter((c) => names.includes(c.name)));
}

/**
 * The names pasted `elements` get on `screen`: its own name when that is free, else the name without its number
 * followed by the smallest number free (button1 -> button2, fog -> fog1).
 */
export function pastedNames(screen: Screen, elements: readonly Element[]): string[] {
    const taken = new Set(screen.components.map((c) => c.name));
    return elements.map((e) => {
        const want = typeof e.name === 'string' && e.name ? e.name : e.gpu;
        const name = taken.has(want) ? uniqueName(want.replace(/\d+$/, '') || e.gpu, taken) : want;
        taken.add(name);
        return name;
    });
}
