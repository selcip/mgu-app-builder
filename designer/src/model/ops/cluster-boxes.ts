// The boxes inside a `boxes` widget (the GT3 frame): each entry of its `boxes` array is an element of the cluster
// layout seen as a screen, a child of the widget (`parent` = the widget's id, `box` = the entry itself), named
// "<widget id>/<box id>". The engine draws the widget as ONE layer; the Designer shows and edits each box. Edits
// write back into the widget's array only. The other operations of cluster-elements.ts resolve these names too.
import { EditError, uniqueName, type Element, type Screen } from '../core.ts';

/**
 * How many boxes one boxes widget draws: the length of the shader's `u_box[N]` array (engine/shared/shaders.js, and
 * hud.js slices the list to it). test/cluster-boxes-model.test.js reads the engine source and fails if this differs.
 */
export const MAX_BOXES = 12;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

export const isBoxesWidget = (w: unknown): w is Rec => isRec(w) && w.type === 'boxes';
export const boxList = (w: Rec): Rec[] => (Array.isArray(w.boxes) ? (w.boxes as unknown[]).filter(isRec) : []);

/** The id a box has for the element list: its own, else its position. */
const boxId = (b: Rec, i: number) => (typeof b.id === 'string' && b.id ? b.id : `box${i + 1}`);
export const boxName = (widgetId: string, b: Rec, i: number) => `${widgetId}/${boxId(b, i)}`;

/** The elements for a widget's boxes, bottom first (the order of the array). */
export function innerElements(w: Rec, widgetId: string): Element[] {
    if (!isBoxesWidget(w) || !Array.isArray(w.boxes)) return [];
    const out: Element[] = [];
    (w.boxes as unknown[]).forEach((b, i) => {
        if (!isRec(b)) return;
        const placed = ['x', 'y', 'w', 'h'].every((k) => typeof b[k] === 'number');
        out.push({
            name: boxName(widgetId, b, i), gpu: 'box', opts: {}, parent: widgetId, box: b,
            x: placed ? (b.x as number) : 0, y: placed ? (b.y as number) : 0, w: placed ? (b.w as number) : 0, h: placed ? (b.h as number) : 0,
            ...(placed ? {} : { boxless: true }),
        });
    });
    return out;
}

/** The box record named `name` ("frame/speed_box") among the widgets, or undefined. */
export function innerBox(widgets: readonly unknown[], name: string): Rec | undefined {
    for (const w of widgets) {
        if (!isBoxesWidget(w) || typeof w.id !== 'string' || !name.startsWith(w.id + '/') || !Array.isArray(w.boxes)) continue;
        const i = (w.boxes as unknown[]).findIndex((b, j) => isRec(b) && boxName(w.id as string, b, j) === name);
        if (i >= 0) return (w.boxes as Rec[])[i];
    }
    return undefined;
}

/** The elements as the element list shows them: top first, each widget's boxes (top first) right under it. */
export function listOrder(components: readonly Element[]): Element[] {
    const out: Element[] = [];
    const kids = new Map<string, Element[]>();
    for (const c of components) if (typeof c.parent === 'string') (kids.get(c.parent) || kids.set(c.parent, []).get(c.parent)!).push(c);
    for (const c of components.slice().reverse()) {
        if (typeof c.parent === 'string') continue;
        out.push(c, ...(kids.get(c.name) || []).slice().reverse());
    }
    return out;
}

/**
 * What stacking the named elements works on: the boxes of one widget when all named are its boxes, else the
 * widgets only (a name that is a box then makes the move unavailable).
 */
export function stackScope(screen: Screen, names: readonly string[]): Screen {
    const els = names.map((n) => screen.components.find((c) => c.name === n));
    const parent = els[0] && typeof els[0].parent === 'string' ? els[0].parent : null;
    const siblings = parent !== null && els.every((e) => e && e.parent === parent);
    if (!siblings && !screen.components.some((c) => typeof c.parent === 'string')) return screen;
    return { ...screen, components: screen.components.filter((c) => (siblings ? c.parent === parent : typeof c.parent !== 'string')) };
}

/** The id a box added to the widget `w` gets (box1, box2, ...). */
export function newBoxId(w: Rec): string {
    return uniqueName('box', boxList(w).map((b) => (typeof b.id === 'string' ? b.id : '')));
}

interface Draft { layout: { widgets: unknown[] } }

export const clusterBoxOps = {
    /** Adds a box on top of the widget's boxes (id given or unique); refused past the engine's limit. */
    addBox(d: Draft, a: { widget: string; id?: string; x?: number; y?: number; w?: number; h?: number }) {
        const w = d.layout.widgets.find((x) => isRec(x) && x.id === a.widget);
        if (!isBoxesWidget(w)) throw new EditError(`Element "${a.widget}" is not a boxes widget, so it holds no boxes.`);
        const list = Array.isArray(w.boxes) ? (w.boxes as unknown[]) : [];
        if (list.length >= MAX_BOXES) {
            throw new EditError(`"${a.widget}" already holds ${list.length} boxes; the engine draws at most ${MAX_BOXES} in one boxes widget.`);
        }
        const id = a.id ?? newBoxId(w);
        if (boxList(w).some((b) => b.id === id)) throw new EditError(`"${a.widget}" already has a box "${id}".`);
        const box = { id, x: a.x ?? (w.x as number || 0) + 40 + 16 * (list.length % 8), y: a.y ?? (w.y as number || 0) + 40 + 16 * (list.length % 8), w: a.w ?? 200, h: a.h ?? 120 };
        for (const k of ['w', 'h'] as const) if (!Number.isInteger(box[k]) || box[k] < 1) throw new EditError(`The new box needs a ${k === 'w' ? 'width' : 'height'} of at least 1 pixel.`);
        for (const k of ['x', 'y'] as const) if (!Number.isInteger(box[k])) throw new EditError(`The new box needs a whole number of pixels for ${k}.`);
        w.boxes = list.concat([box]);
    },
};
