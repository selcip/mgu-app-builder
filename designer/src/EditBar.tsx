// The canvas's edit bar and keyboard shortcuts: undo and redo; grid, snapping and guides; the selected element's
// exact box; align, copy, cut, paste and delete the selection. Every edit is a document-model operation.
//
// Keys (not while typing in a field): Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo, Ctrl/Cmd+C copy, +X cut,
// +V paste, +A select all, Delete/Backspace delete, arrows move 1 px (Shift: one grid step), Alt+arrows resize,
// Escape clears the selection.
import { useEffect, useRef } from 'react';
import { copyElements, pastedNames, type Box, type Edge, type Element, type Op, type Screen } from './model/index.ts';
import { CommitInput } from './PropertyPanel';
import type { CanvasSettings } from './Canvas';

/** What was copied, and from which screen (pasting there again moves each paste a little further). */
export interface Clipboard {
    screen: string;
    elements: Element[];
    pastes: number;
}

interface Props {
    screen: Screen;
    design: { w: number; h: number };
    selection: string[];
    settings: CanvasSettings;
    clipboard: Clipboard | null;
    canUndo: boolean;
    canRedo: boolean;
    onEdit(op: Op): boolean;
    onUndo(): void;
    onRedo(): void;
    onSelect(names: string[]): void;
    onSettings(s: CanvasSettings): void;
    onClipboard(c: Clipboard | null): void;
}

const GRIDS = [0, 4, 8, 16, 32];
const ALIGN: { edge: Edge; label: string }[] = [
    { edge: 'left', label: 'Left' }, { edge: 'centre', label: 'Centre' }, { edge: 'right', label: 'Right' },
    { edge: 'top', label: 'Top' }, { edge: 'middle', label: 'Middle' }, { edge: 'bottom', label: 'Bottom' },
];
const PASTE_STEP = 16;

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function EditBar(props: Props) {
    const { screen, selection, settings, clipboard, onEdit, onSelect } = props;
    const sel = selection.filter((n) => screen.components.some((c) => c.name === n));
    const one = sel.length === 1 ? screen.components.find((c) => c.name === sel[0]) : undefined;

    const copy = () => { if (sel.length) props.onClipboard({ screen: screen.name, elements: copyElements(screen, sel), pastes: 0 }); };
    const del = () => { if (sel.length && onEdit({ type: 'deleteElements', screen: screen.name, elements: sel })) onSelect([]); };
    const cut = () => { copy(); del(); };
    function paste() {
        if (!clipboard || !clipboard.elements.length) return;
        const pastes = clipboard.screen === screen.name ? clipboard.pastes + 1 : clipboard.pastes;
        const step = clipboard.screen === screen.name ? pastes * PASTE_STEP : 0;
        const names = pastedNames(screen, clipboard.elements);
        if (onEdit({ type: 'pasteElements', screen: screen.name, elements: clipboard.elements, dx: step, dy: step })) {
            onSelect(names);
            props.onClipboard({ ...clipboard, pastes });
        }
    }
    const align = (edge: Edge) => { if (sel.length) onEdit({ type: 'alignElements', screen: screen.name, elements: sel, edge }); };

    function arrow(key: string, shift: boolean, alt: boolean) {
        if (!sel.length) return;
        const step = shift ? settings.grid || 10 : 1;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        if (!alt) {
            onEdit({ type: 'moveElements', screen: screen.name, elements: sel, dx, dy });
            return;
        }
        const boxes: Record<string, Partial<Box>> = {};
        for (const c of screen.components) {
            if (sel.includes(c.name)) boxes[c.name] = { w: Math.max(0, c.w + dx), h: Math.max(0, c.h + dy) };
        }
        onEdit({ type: 'setBoxes', screen: screen.name, boxes });
    }

    // the latest handlers, for the one window listener
    const keys = useRef<(e: KeyboardEvent) => void>(() => {});
    keys.current = (e: KeyboardEvent) => {
        if (typing(e.target)) return;
        const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        let done = true;
        if (mod && k === 'z' && !e.shiftKey) props.onUndo();
        else if (mod && ((k === 'z' && e.shiftKey) || k === 'y')) props.onRedo();
        else if (mod && k === 'c') copy();
        else if (mod && k === 'x') cut();
        else if (mod && k === 'v') paste();
        else if (mod && k === 'a') onSelect(screen.components.map((c) => c.name));
        else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) del();
        else if (!mod && e.key.startsWith('Arrow') && sel.length) arrow(e.key, e.shiftKey, e.altKey);
        else if (e.key === 'Escape' && sel.length) onSelect([]);
        else done = false;
        if (done) e.preventDefault();
    };
    useEffect(() => {
        const on = (e: KeyboardEvent) => keys.current(e);
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, []);

    const setBox = (k: keyof Box) => (v: string) => {
        const n = Number(v);
        if (one && v.trim() !== '' && isFinite(n)) onEdit({ type: 'setBoxes', screen: screen.name, boxes: { [one.name]: { [k]: Math.round(n) } } });
    };
    const addGuide = (axis: 'xs' | 'ys') => {
        const mid = Math.round((axis === 'xs' ? props.design.w : props.design.h) / 2);
        props.onSettings({ ...settings, guides: { ...settings.guides, [axis]: settings.guides[axis].concat([mid]) } });
    };

    return (
        <div className="edit-bar" aria-label="Edit">
            <span className="group">
                <button disabled={!props.canUndo} onClick={props.onUndo} title="Ctrl+Z">Undo</button>
                <button disabled={!props.canRedo} onClick={props.onRedo} title="Ctrl+Shift+Z">Redo</button>
            </span>
            <span className="group">
                <label>Grid{' '}
                    <select value={settings.grid} onChange={(e) => props.onSettings({ ...settings, grid: Number(e.target.value) })}>
                        {GRIDS.map((g) => <option key={g} value={g}>{g ? `${g} px` : 'off'}</option>)}
                    </select>
                </label>
                <label title="Snap to other elements, the screen's edges and guides (hold Alt while dragging to place freely)">
                    <input type="checkbox" checked={settings.snap} onChange={(e) => props.onSettings({ ...settings, snap: e.target.checked })} /> Snap
                </label>
                <button onClick={() => addGuide('xs')} title="Add a vertical guide">| guide</button>
                <button onClick={() => addGuide('ys')} title="Add a horizontal guide">— guide</button>
            </span>
            {one && (
                <span className="group box" data-box={one.name}>
                    {(['x', 'y', 'w', 'h'] as const).map((k) => (
                        <label key={k}>{k.toUpperCase()} <CommitInput type="number" step="1" value={String(one[k])} onCommit={setBox(k)} /></label>
                    ))}
                </span>
            )}
            <span className="group">
                {ALIGN.map((a) => (
                    <button key={a.edge} disabled={!sel.length} onClick={() => align(a.edge)}
                        title={sel.length > 1 ? `Align ${a.label.toLowerCase()} edges/lines of the selection` : `Align to the screen's ${a.label.toLowerCase()}`}>
                        {a.label}
                    </button>
                ))}
            </span>
            <span className="group">
                <button disabled={!sel.length} onClick={copy} title="Ctrl+C">Copy</button>
                <button disabled={!sel.length} onClick={cut} title="Ctrl+X">Cut</button>
                <button disabled={!clipboard} onClick={paste} title="Ctrl+V">Paste</button>
                <button disabled={!sel.length} onClick={del} title="Delete">Delete</button>
            </span>
            {sel.length > 1 && <span className="hint">{sel.length} selected</span>}
        </div>
    );
}
