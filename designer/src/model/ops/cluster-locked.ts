// Locked elements of a cluster layout (ticket 12). The whole-theme widgets of M and Sport (`mdash`, `mtach`, `sdash`)
// are shaders whose parameters are positions in target pixels (a card's corners, the blade's bend, the tyre glyph,
// the scale's ends, ...). The Designer has no editor for those numbers, so they are read-only. Moving or resizing the
// widget's x, y, w, h box would not move that geometry with it (mdash and mtach subtract the box from absolute
// positions, sdash does not), so it would clip or shift the drawing against itself: move, resize, align and paste are
// refused. Select, stack, condition (toggle, themes) and delete work, and the saved parameters are never rewritten.
import { EditError } from '../core.ts';

interface Lock { draws: string }

const LOCKS: Record<string, Lock> = {
    mdash: { draws: 'the whole backdrop of the M cluster: the two cards, their chamfers, the tyre block, the gauges, the setup level bars and the line between' },
    mtach: { draws: 'one rev bar of the M cluster, a slanted blade that fills with the engine speed and turns red at the redline' },
    sdash: { draws: 'the whole Sport cluster: the speed and rev scales with their brackets, the fuel and oil bars, the strip along the bottom and the black middle with the map window cut out' },
};

/** Whether this widget type opens as a locked element. */
export const isLockedType = (type: unknown): boolean => typeof type === 'string' && Object.prototype.hasOwnProperty.call(LOCKS, type);

/** What the locked widget draws, as a phrase ("the whole Sport cluster: ..."), or '' for another widget. */
export const lockedDraws = (type: string): string => (isLockedType(type) ? LOCKS[type].draws : '');

/** The inspector's note: what it draws and why it is locked. */
export function lockedNote(type: string): string {
    if (!isLockedType(type)) return '';
    return `Locked, read-only. This element draws ${LOCKS[type].draws}. Its parameters are positions in cluster pixels inside one shader, `
        + 'which the Designer cannot edit part by part, so they are kept exactly as the file has them. You can select it, stack it, condition it or delete it; it cannot be moved or resized.';
}

/** Refuses an operation that would edit a locked widget's internals or its box. Other operations (conditions, new options) call this too. */
export function assertEditable(w: Record<string, unknown>, what = 'edited'): void {
    if (isLockedType(w.type)) {
        throw new EditError(`Element "${String(w.id)}" is locked (${String(w.type)} draws ${LOCKS[String(w.type)].draws}), so it can’t be ${what}.`);
    }
}
