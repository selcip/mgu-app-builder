// Focus order and action operations: reorder, leave out, take back in, reset to reading order; name an action.
// The screen file keeps an explicit order as the screen's `focus` (element names); without one the runtime uses
// reading order over the widgets that take focus (catalog `focusable`). An action other than the element's name is
// written as `onTap: 'event:<action>'`, the Store's spelling. focusOrderOf and actionOf must agree with the runtime
// (runtime/mgu_focus.js); test/focus-model.test.js holds them to it.
import { widget } from '../../catalog.ts';
import { EditError, elementOf, screenOf, type Draft, type Element, type Screen } from '../core.ts';

const EVENT = 'event:';

const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
const shown = (c: Element | undefined): c is Element => !!c && !(c.opts && c.opts.hidden);

/** Reading order: lines top to bottom (an element joins a line when its middle is within the line's first element's
 * height), each line left to right; ties keep the file's order. */
function readingOrder(elements: Element[]): Element[] {
    const byTop = elements.map((c, i) => ({ c, i, x: num(c.x, 0), y: num(c.y, 0), h: num(c.h, 0) }));
    byTop.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.i - b.i));
    const out: Element[] = [];
    let k = 0;
    while (k < byTop.length) {
        const head = byTop[k];
        const line: typeof byTop = [];
        while (k < byTop.length && (!line.length || byTop[k].y + byTop[k].h / 2 <= head.y + head.h)) line.push(byTop[k++]);
        line.sort((a, b) => (a.x - b.x) || (a.y - b.y) || (a.i - b.i));
        for (const e of line) out.push(e.c);
    }
    return out;
}

/** The names of a screen's elements in the order the controller moves through them. */
export function focusOrderOf(s: Screen): string[] {
    const all = s.components || [];
    if (Array.isArray(s.focus)) {
        const byName = new Map<string, Element>();
        for (const c of all) if (!byName.has(c.name)) byName.set(c.name, c);
        const out: string[] = [];
        for (const n of s.focus) if (shown(byName.get(n)) && !out.includes(n)) out.push(n);
        return out;
    }
    return readingOrder(all.filter((c) => shown(c) && !!widget(c.gpu)?.focusable)).map((c) => c.name);
}

/** The action an element reports when selected: its name unless the screen file names another. */
export function actionOf(c: Element): string {
    const t = c.onTap;
    return typeof t === 'string' && t.startsWith(EVENT) && t.length > EVENT.length ? t.slice(EVENT.length) : c.name;
}

/** The order as it stands, written to the screen (an explicit order from now on). */
function explicit(s: Screen): string[] {
    s.focus = focusOrderOf(s);
    return s.focus;
}

export const focusOps = {
    setFocusOrder(d: Draft, a: { screen: string; order: string[] }) {
        const s = screenOf(d, a.screen);
        const seen = new Set<string>();
        for (const n of a.order) {
            elementOf(s, n);
            if (seen.has(n)) throw new EditError(`"${n}" is in the focus order twice.`);
            seen.add(n);
        }
        s.focus = a.order.slice();
    },

    /** Back to reading order: the screen file lists no order. */
    resetFocusOrder(d: Draft, a: { screen: string }) {
        delete screenOf(d, a.screen).focus;
    },

    /** Moves an element to position `to` (0 = first) of the focus order. */
    moveInFocus(d: Draft, a: { screen: string; element: string; to: number }) {
        const s = screenOf(d, a.screen);
        elementOf(s, a.element);
        const order = focusOrderOf(s);
        const from = order.indexOf(a.element);
        if (from < 0) throw new EditError(`"${a.element}" is not in the focus order.`);
        if (!Number.isInteger(a.to) || a.to < 0 || a.to >= order.length) throw new EditError(`No position ${a.to} in the focus order.`);
        order.splice(from, 1);
        order.splice(a.to, 0, a.element);
        s.focus = order;
    },

    excludeFromFocus(d: Draft, a: { screen: string; element: string }) {
        const s = screenOf(d, a.screen);
        elementOf(s, a.element);
        s.focus = explicit(s).filter((n) => n !== a.element);
    },

    /** Takes an element into the focus order, at the end. */
    includeInFocus(d: Draft, a: { screen: string; element: string }) {
        const s = screenOf(d, a.screen);
        elementOf(s, a.element);
        const order = explicit(s);
        if (order.includes(a.element)) throw new EditError(`"${a.element}" is already in the focus order.`);
        order.push(a.element);
    },

    /** Names the action an element reports; '' or the element's own name goes back to the default (its name). */
    setAction(d: Draft, a: { screen: string; element: string; action: string }) {
        const e = elementOf(screenOf(d, a.screen), a.element);
        if (typeof a.action !== 'string') throw new EditError('An action is a name.');
        if (a.action !== a.action.trim()) throw new EditError('An action name can’t start or end with spaces.');
        if (a.action === '' || a.action === e.name) {
            if (typeof e.onTap === 'string' && e.onTap.startsWith(EVENT)) delete e.onTap;
            return;
        }
        e.onTap = EVENT + a.action;
    },
};

/** Called when an element is added: with an explicit order, an element whose widget takes focus joins at the end. */
export function joinFocus(s: Screen, c: Element) {
    if (Array.isArray(s.focus) && widget(c.gpu)?.focusable && !s.focus.includes(c.name)) s.focus.push(c.name);
}
