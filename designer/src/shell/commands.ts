// The editing commands the menus, the toolbar and the keyboard share: copy, cut, paste, duplicate, delete, select
// all, nudge and resize by the arrow keys, stacking order (bring forward, send backward, to front, to back), and
// guides. Each works on the store's selection on the selected screen and edits through the store (so a refusal
// shows as its problem). Plain TypeScript, no React or DOM: Node tests it.
import { canRestack, copyElements, pastedNames, type Box, type Place } from '../model/index.ts';
import { DESIGN, screenOf, type EditorState, type EditorStore } from '../store/editor.ts';

/** How far each paste on the same screen moves from the one before. */
const PASTE_STEP = 16;

/** The selection, without names no longer on the selected screen. */
export function selected(store: EditorStore): string[] {
    return selectedIn(store.getState());
}

export function selectedIn(s: EditorState): string[] {
    const screen = screenOf(s);
    return s.selection.filter((n) => screen.components.some((c) => c.name === n));
}

export function copy(store: EditorStore): boolean {
    const s = store.getState(), sel = selected(store);
    if (!sel.length) return false;
    s.setClipboard({ screen: s.selected, elements: copyElements(screenOf(s), sel), pastes: 0 });
    return true;
}

export function deleteSelection(store: EditorStore): boolean {
    const s = store.getState(), sel = selected(store);
    if (!sel.length || !s.edit({ type: 'deleteElements', screen: s.selected, elements: sel })) return false;
    s.select([]);
    return true;
}

export function cut(store: EditorStore): boolean {
    return copy(store) && deleteSelection(store);
}

/** Pastes the clipboard on the selected screen (each paste on the screen it came from a step further) and selects it. */
export function paste(store: EditorStore): boolean {
    const s = store.getState(), clip = s.clipboard;
    if (!clip || !clip.elements.length) return false;
    const same = clip.screen === s.selected;
    const pastes = same ? clip.pastes + 1 : clip.pastes;
    const step = same ? pastes * PASTE_STEP : 0;
    const names = pastedNames(screenOf(s), clip.elements);
    if (!s.edit({ type: 'pasteElements', screen: s.selected, elements: clip.elements, dx: step, dy: step })) return false;
    s.select(names);
    s.setClipboard({ ...clip, pastes });
    return true;
}

/** Copies of the selection a step down and right, selected; the clipboard is left as it was. */
export function duplicate(store: EditorStore): boolean {
    const s = store.getState(), sel = selected(store), screen = screenOf(s);
    if (!sel.length) return false;
    const elements = copyElements(screen, sel);
    const names = pastedNames(screen, elements);
    if (!s.edit({ type: 'pasteElements', screen: s.selected, elements, dx: PASTE_STEP, dy: PASTE_STEP })) return false;
    s.select(names);
    return true;
}

export function selectAll(store: EditorStore): void {
    const s = store.getState();
    s.select(screenOf(s).components.map((c) => c.name));
}

/** An arrow key: moves the selection 1 px (with Shift: a grid step, 10 px without a grid); with Alt resizes it. */
export function nudge(store: EditorStore, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', shift: boolean, alt: boolean): boolean {
    const s = store.getState(), sel = selected(store);
    if (!sel.length) return false;
    const step = shift ? s.settings.grid || 10 : 1;
    const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
    const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
    if (!alt) return s.edit({ type: 'moveElements', screen: s.selected, elements: sel, dx, dy }) !== null;
    const boxes: Record<string, Partial<Box>> = {};
    for (const c of screenOf(s).components) {
        if (sel.includes(c.name)) boxes[c.name] = { w: Math.max(0, c.w + dx), h: Math.max(0, c.h + dy) };
    }
    return s.edit({ type: 'setBoxes', screen: s.selected, boxes }) !== null;
}

/** The stacking commands as the menus list them, with their keys (after Ctrl/Cmd) and test hooks. */
export const STACKING = [
    { place: 'front', label: 'Bring to front', keys: '⇧]', hook: 'front' },
    { place: 'forward', label: 'Bring forward', keys: ']', hook: 'forward' },
    { place: 'backward', label: 'Send backward', keys: '[', hook: 'backward' },
    { place: 'back', label: 'Send to back', keys: '⇧[', hook: 'back' },
] as const;

/** Whether moving the selection to `place` in the stacking order would change it (for disabling a command). */
export function canStack(s: EditorState, place: Place): boolean {
    return canRestack(screenOf(s), selectedIn(s), place);
}

/** Which of the STACKING commands would change anything, as a string of 1s and 0s (a stable store selector). */
export const stackableOf = (s: EditorState): string => STACKING.map((c) => (canStack(s, c.place) ? '1' : '0')).join('');

/**
 * Moves the selection to `place` in the stacking order: 'forward', 'backward', 'front', 'back' or a drop index among
 * the other elements. Does nothing (and makes no undo step) when that changes nothing.
 */
export function stack(store: EditorStore, place: Place): boolean {
    const s = store.getState(), sel = selected(store);
    if (!canStack(s, place)) return false;
    return s.edit({ type: 'restackElements', screen: s.selected, elements: sel, place }) !== null;
}

/**
 * Where a drop at gap `gap` of the element list (`shown` top first; 0 = above the top row) puts the elements being
 * moved: their index among the others, bottom first, which is how many of those are listed below the gap.
 */
export function dropPlace(shown: readonly string[], moving: readonly string[], gap: number): number {
    return shown.slice(gap).filter((n) => !moving.includes(n)).length;
}

/** A guide across the middle of the screen: vertical ('xs') or horizontal ('ys'). */
export function addGuide(store: EditorStore, axis: 'xs' | 'ys'): void {
    const s = store.getState();
    const mid = Math.round((axis === 'xs' ? DESIGN.w : DESIGN.h) / 2);
    s.setGuides({ ...s.settings.guides, [axis]: s.settings.guides[axis].concat([mid]) });
}

export function clearGuides(store: EditorStore): void {
    store.getState().setGuides({ xs: [], ys: [] });
}
