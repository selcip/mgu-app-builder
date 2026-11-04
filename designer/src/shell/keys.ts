// The editing shortcuts, as in Figma. Not while typing in a field (it keeps its own keys), and not while trying (the
// keys are the iDrive controller's then).
//   Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo, Ctrl/Cmd+C copy, +X cut, +V paste, +D duplicate, +A select all,
//   Delete/Backspace delete, arrows move 1 px (Shift: a grid step; Alt: resize), Escape clears the selection,
//   Ctrl/Cmd+] bring forward, +[ send backward, +Shift+] bring to front, +Shift+[ send to back.
// The canvas's own keys (Space to pan, zoom) are in Viewport.tsx; Ctrl+\ (the panels) in Panel.tsx.
import { useEffect } from 'react';
import { copy, cut, deleteSelection, duplicate, nudge, paste, selectAll, selected, stack } from './commands.ts';
import { useEditorStore } from '../store/react.tsx';

/** A key event's target is a field that takes typing. */
export const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function useEditKeys() {
    const store = useEditorStore();
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            const s = store.getState();
            if (s.trying || typing(e.target) || e.defaultPrevented) return;
            const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
            let done = true;
            if (mod && k === 'z' && !e.shiftKey) s.undo();
            else if (mod && ((k === 'z' && e.shiftKey) || k === 'y')) s.redo();
            else if (mod && k === 'c') done = copy(store);
            else if (mod && k === 'x') done = cut(store);
            else if (mod && k === 'v') done = paste(store);
            else if (mod && k === 'd') duplicate(store);           // always kept from the browser's bookmark key
            else if (mod && k === 'a') selectAll(store);
            // e.code: Shift turns ] into } on most layouts
            else if (mod && e.code === 'BracketRight') stack(store, e.shiftKey ? 'front' : 'forward');
            else if (mod && e.code === 'BracketLeft') stack(store, e.shiftKey ? 'back' : 'backward');
            else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) done = deleteSelection(store);
            else if (!mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) done = nudge(store, e.key, e.shiftKey, e.altKey);
            else if (e.key === 'Escape' && selected(store).length) s.select([]);
            else done = false;
            if (done) e.preventDefault();
        };
        window.addEventListener('keydown', down);
        return () => window.removeEventListener('keydown', down);
    }, [store]);
}
