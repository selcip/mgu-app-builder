// Stacking order: the order of a screen's elements in `components` (bottom first), which is the order the kit draws
// them in, so a later element covers an earlier one. Reordering leaves boxes, options and the focus order alone.
import { EditError, elementOf, screenOf, type Draft, type Element, type Screen } from '../core.ts';

/**
 * Where restacked elements go: one step up past the next element not being moved ('forward'), one step down
 * ('backward'), to the top ('front') or bottom ('back'), or an index among the elements not being moved (0 = under
 * all of them), as a drop in the element list gives.
 */
export type Place = 'forward' | 'backward' | 'front' | 'back' | number;

/** The screen's elements after moving `names` to `place`; the moved ones keep their order relative to each other. */
export function restacked(screen: Screen, names: readonly string[], place: Place): Element[] {
    names.forEach((n) => elementOf(screen, n));
    const all = screen.components.slice();
    const moving = (e: Element) => names.includes(e.name);
    if (place === 'forward' || place === 'backward') {
        // Each moved element swaps with the unmoved one next to it, so a run of moved elements steps as one.
        const up = place === 'forward';
        const order = all.map((_, i) => i);
        if (up) order.reverse();
        for (const i of order) {
            const j = up ? i + 1 : i - 1;
            if (j < 0 || j >= all.length) continue;
            if (moving(all[i]) && !moving(all[j])) [all[i], all[j]] = [all[j], all[i]];
        }
        return all;
    }
    const moved = all.filter(moving), rest = all.filter((e) => !moving(e));
    let at: number;
    if (place === 'front') at = rest.length;
    else if (place === 'back') at = 0;
    else if (typeof place === 'number' && Number.isInteger(place) && place >= 0 && place <= rest.length) at = place;
    else throw new EditError(`Can’t move elements to ${JSON.stringify(place)} in the stacking order.`);
    return rest.slice(0, at).concat(moved, rest.slice(at));
}

/** Whether moving `names` to `place` would change the stacking order (Bring forward on the top element would not). */
export function canRestack(screen: Screen, names: readonly string[], place: Place): boolean {
    if (!names.length) return false;
    const next = restacked(screen, names, place);
    return next.some((e, i) => e !== screen.components[i]);
}

export const stackingOps = {
    /** Moves the named elements to `place` in the screen's stacking order. */
    restackElements(d: Draft, a: { screen: string; elements: string[]; place: Place }) {
        const s = screenOf(d, a.screen);
        s.components = restacked(s, a.elements || [], a.place);
    },
};
