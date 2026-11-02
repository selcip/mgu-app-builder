// Undo and redo: the documents before and after the present one. Documents are never changed in place (apply()
// returns a new one), so keeping them is all undo needs.
import type { Doc } from './core.ts';
import { apply } from './document.ts';
import type { Op } from './operations.ts';

export interface History {
    readonly past: readonly Doc[];
    readonly present: Doc;
    readonly future: readonly Doc[];
}

const LIMIT = 200;

export function createHistory(doc: Doc): History {
    return { past: [], present: doc, future: [] };
}

/** Applies `op` to the present document; throws EditError (history unchanged) when it is refused. */
export function dispatch(h: History, op: Op): History {
    const next = apply(h.present, op);
    return { past: h.past.concat([h.present]).slice(-LIMIT), present: next, future: [] };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
    if (!canUndo(h)) return h;
    return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present].concat(h.future) };
}

export function redo(h: History): History {
    if (!canRedo(h)) return h;
    return { past: h.past.concat([h.present]), present: h.future[0], future: h.future.slice(1) };
}
