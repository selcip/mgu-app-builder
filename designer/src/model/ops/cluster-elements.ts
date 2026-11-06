// Editing the elements of a cluster layout: its widgets[] (bottom first, the order the engine stacks them). An
// element's name is the widget's id. To let the canvas, the element list and the editing commands serve both kinds
// of document, a layout is also seen as a screen (`layoutScreen`): one Element per widget, carrying the widget
// itself in `widget`. The operations have the screen file's names and arguments (the `screen` argument is ignored),
// so the shared commands issue the same operations for either kind. A widget without an x, y, w, h box cannot be
// placed on the canvas: it is listed (flagged `boxless`), can be deleted and stacked, and refuses moving.
import { EditError, uniqueName, type ClusterLayout, type Element, type Screen } from '../core.ts';
import { boundsOf, EDGES, type Box, type Edge } from './canvas.ts';
import { restacked, type Place } from './stacking.ts';

/** The cluster's size: what a single element aligns to. */
export const CLUSTER = { w: 1920, h: 720 } as const;

/** The name of the screen a layout is seen as. */
export const LAYOUT_SCREEN = 'layout';

const KEYS = ['x', 'y', 'w', 'h'] as const;

type Widget = Record<string, unknown>;
const isWidget = (v: unknown): v is Widget => !!v && typeof v === 'object' && !Array.isArray(v);
const hasBox = (w: Widget) => KEYS.every((k) => typeof w[k] === 'number');

const seen = new WeakMap<ClusterLayout, Screen>();

/** The layout seen as a screen (same object for the same layout, so selectors stay stable; do not change the layout after). */
export function layoutScreen(layout: ClusterLayout): Screen {
    let s = seen.get(layout);
    if (!s) seen.set(layout, (s = screenOfWidgets(layout)));
    return s;
}

function screenOfWidgets(layout: ClusterLayout): Screen {
    const components: Element[] = [];
    layout.widgets.forEach((v, i) => {
        const w: Widget = isWidget(v) ? v : {};
        const name = typeof w.id === 'string' ? w.id : `widget${i + 1}`;
        const boxed = hasBox(w);
        components.push({
            name, gpu: typeof w.type === 'string' ? w.type : 'unknown', opts: {}, widget: w,
            x: boxed ? (w.x as number) : 0, y: boxed ? (w.y as number) : 0, w: boxed ? (w.w as number) : 0, h: boxed ? (w.h as number) : 0,
            ...(boxed ? {} : { boxless: true }),
        });
    });
    return { name: LAYOUT_SCREEN, components };
}

interface LayoutDraft {
    layout: ClusterLayout;
}

/** The widget named `name` in the draft, with what to refuse movement for when it has no box. */
function find(d: LayoutDraft, name: string): Widget {
    const w = d.layout.widgets.find((x) => isWidget(x) && x.id === name);
    if (!w) throw new EditError(`The layout has no element "${name}".`);
    return w as Widget;
}

function placeable(d: LayoutDraft, name: string): Widget {
    const w = find(d, name);
    if (!hasBox(w)) throw new EditError(`Element "${name}" has no box (x, y, w, h) in the layout, so it can’t be moved or resized.`);
    return w;
}

function checkBox(name: string, b: Partial<Box>): void {
    for (const k of KEYS) {
        const v = b[k];
        if (v === undefined) continue;
        if (typeof v !== 'number' || !Number.isInteger(v)) throw new EditError(`${name}: ${k} must be a whole number of pixels.`);
        if ((k === 'w' || k === 'h') && v < 1) throw new EditError(`${name}: the ${k === 'w' ? 'width' : 'height'} must be at least 1 pixel.`);
    }
}

export const clusterElementOps = {
    /** Sets the given parts of each named element's box. Outside the 1920x720 cluster is allowed; a size below 1 is not. */
    setBoxes(d: LayoutDraft, a: { screen?: string; boxes: Record<string, Partial<Box>> }) {
        const entries = Object.entries(a.boxes || {});
        const targets = entries.map(([name, b]) => { const w = placeable(d, name); checkBox(name, b || {}); return { w, b: b || {} }; });
        for (const { w, b } of targets) for (const k of KEYS) if (b[k] !== undefined) w[k] = b[k]!;
    },

    /** Moves the named elements by dx, dy. */
    moveElements(d: LayoutDraft, a: { screen?: string; elements: string[]; dx: number; dy: number }) {
        checkBox('The step', { x: a.dx, y: a.dy });
        const ws = a.elements.map((n) => placeable(d, n));
        for (const w of ws) { w.x = (w.x as number) + a.dx; w.y = (w.y as number) + a.dy; }
    },

    /** Aligns the named elements to one edge or centre line of the box around them all; one element aligns to the cluster's. */
    alignElements(d: LayoutDraft, a: { screen?: string; elements: string[]; edge: Edge }) {
        if (!EDGES.includes(a.edge)) throw new EditError(`Can’t align to the edge "${a.edge}".`);
        const ws = a.elements.map((n) => placeable(d, n));
        if (!ws.length) return;
        const boxes = ws.map((w) => ({ x: w.x as number, y: w.y as number, w: w.w as number, h: w.h as number }));
        const around = ws.length === 1 ? { x: 0, y: 0, ...CLUSTER } : boundsOf(boxes);
        for (const w of ws) {
            const [bw, bh] = [w.w as number, w.h as number];
            if (a.edge === 'left') w.x = around.x;
            if (a.edge === 'right') w.x = around.x + around.w - bw;
            if (a.edge === 'centre') w.x = Math.round(around.x + (around.w - bw) / 2);
            if (a.edge === 'top') w.y = around.y;
            if (a.edge === 'bottom') w.y = around.y + around.h - bh;
            if (a.edge === 'middle') w.y = Math.round(around.y + (around.h - bh) / 2);
        }
    },

    /** Deletes the named elements. */
    deleteElements(d: LayoutDraft, a: { screen?: string; elements: string[] }) {
        const ws = a.elements.map((n) => find(d, n));
        d.layout.widgets = d.layout.widgets.filter((x) => !ws.includes(x as Widget));
    },

    /** Adds copies of `elements` (from copyElements) on top, moved by dx, dy, under new ids (see pastedNames). */
    pasteElements(d: LayoutDraft, a: { screen?: string; elements: Element[]; dx?: number; dy?: number }) {
        const dx = a.dx || 0, dy = a.dy || 0;
        checkBox('The offset', { x: dx, y: dy });
        const els = a.elements || [];
        for (const e of els) {
            if (!e || !isWidget(e.widget)) throw new EditError('Only elements of a cluster layout can be pasted into a cluster layout.');
            if (!hasBox(e.widget)) throw new EditError(`Element "${String(e.name)}" has no box, so it can’t be pasted.`);
            checkBox(String(e.name), e.widget as Partial<Box>);
        }
        const taken = new Set(d.layout.widgets.map((w) => (isWidget(w) ? String(w.id) : '')));
        for (const e of els) {
            const copy = structuredClone(e.widget) as Widget;
            const want = typeof copy.id === 'string' && copy.id ? copy.id : String(copy.type);
            const id = taken.has(want) ? uniqueName(want.replace(/\d+$/, '') || String(copy.type), taken) : want;
            taken.add(id);
            copy.id = id;
            copy.x = (copy.x as number) + dx;
            copy.y = (copy.y as number) + dy;
            d.layout.widgets.push(copy);
        }
    },

    /** Moves the named elements to `place` in the stacking order (widgets[], bottom first). */
    restackElements(d: LayoutDraft, a: { screen?: string; elements: string[]; place: Place }) {
        (a.elements || []).forEach((n) => find(d, n));
        const s = screenOfWidgets(d.layout);       // not the cached one: the draft is being changed
        const order = restacked(s, a.elements || [], a.place);
        d.layout.widgets = order.map((e) => e.widget);
    },
};
