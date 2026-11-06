// The canvas: an overlay on the preview where the app author lays elements out with the mouse and the keyboard.
// Drop a widget from the palette, click or drag a rectangle to select, drag to move, drag a handle to resize, arrow
// keys to move (Shift: a grid step, Alt: resize). Moves and resizes snap to the grid, the other elements' edges and
// centres, the screen's edges and the guides (hold Alt while dragging to place freely). Every element shows its
// 8 px focus-ring margin, and the screen its own along the edges. Every change is one document-model operation:
// during a drag the preview shows the operation applied, and releasing the mouse commits it.
import { useEffect, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent, type DragEvent } from 'react';
import { boundsOf, newElementName, type Box, type Op } from '../model/index.ts';
import { widget } from '../catalog.ts';
import { RING_MARGIN, snapLines, snapMove, snapResize, type Handle, type Lines } from './snap.ts';
import { DESIGN, screenOf } from '../store/editor.ts';
import { useActions, useEditor, useEditorStore } from '../store/react.tsx';
import { STACKING, copy, cut, deleteSelection, duplicate, paste, stack, stackableOf } from '../shell/commands.ts';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/ui/context-menu';

export const WIDGET_DRAG_TYPE = 'application/x-mgu-widget';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const THRESHOLD = 6;


type Drag =
    | { kind: 'move'; names: string[]; start: { x: number; y: number }; from: Record<string, Box>; shown: Lines; op: Op | null }
    | { kind: 'resize'; name: string; handle: Handle; start: { x: number; y: number }; from: Box; shown: Lines; op: Op | null }
    | { kind: 'marquee'; start: { x: number; y: number }; at: { x: number; y: number }; add: string[] }
    | { kind: 'guide'; axis: 'xs' | 'ys'; index: number };

const boxOf = (c: Box): Box => ({ x: c.x, y: c.y, w: c.w, h: c.h });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The overlay for laying out the selected screen; `children` is the preview canvas under it. For a cluster layout
 * (one "screen" of the layout's widgets) `design` is the cluster's 1920x720 and `rings` is off: no focus ring there.
 */
export function Canvas({ children, design = DESIGN, rings = true }: { children: ReactNode; design?: { w: number; h: number }; rings?: boolean }) {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const settings = useEditor((s) => s.settings);
    const actions = useActions();
    const onSelect = actions.select;
    const onEdit = (op: Op) => actions.edit(op) !== null;
    const onDrag = actions.setDragOp;          // the edit being dragged, shown in the preview until committed
    const onGuides = actions.setGuides;
    const layer = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [boxes, setBoxes] = useState<Record<string, Box> | null>(null);  // the dragged boxes, drawn on the overlay

    /** A pointer event's position in screen pixels. */
    function point(e: { clientX: number; clientY: number }) {
        const r = layer.current!.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (design.w / r.width), y: (e.clientY - r.top) * (design.h / r.height) };
    }

    const snapOpts = (free: boolean) => (free ? { grid: 0, threshold: 0 } : { grid: settings.grid, threshold: settings.snap ? THRESHOLD : 0 });
    const linesWithout = (names: string[]) => snapLines(screen, names, settings.snap ? settings.guides : { xs: [], ys: [] }, design, rings ? RING_MARGIN : 0);

    function startMove(e: RPointerEvent, name: string) {
        e.stopPropagation();
        if (e.button === 2) {                   // right-click: select it for the menu (keeping a selection it is in)
            if (!selection.includes(name)) onSelect([name]);
            return;
        }
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
            onSelect(selection.includes(name) ? selection.filter((n) => n !== name) : selection.concat([name]));
            return;
        }
        const names = selection.includes(name) ? selection : [name];
        if (!selection.includes(name)) onSelect(names);
        const from: Record<string, Box> = {};
        for (const c of screen.components) if (names.includes(c.name)) from[c.name] = boxOf(c);
        capture(e);
        setDrag({ kind: 'move', names, start: point(e), from, shown: { xs: [], ys: [] }, op: null });
    }

    function startResize(e: RPointerEvent, name: string, handle: Handle) {
        e.stopPropagation();
        const c = screen.components.find((x) => x.name === name);
        if (!c) return;
        capture(e);
        setDrag({ kind: 'resize', name, handle, start: point(e), from: boxOf(c), shown: { xs: [], ys: [] }, op: null });
    }

    function startMarquee(e: RPointerEvent) {
        if (e.button !== 0) return;
        const p = point(e);
        const add = e.shiftKey || e.metaKey || e.ctrlKey ? selection : [];
        if (!add.length) onSelect([]);
        capture(e);
        setDrag({ kind: 'marquee', start: p, at: p, add });
    }

    function startGuide(e: RPointerEvent, axis: 'xs' | 'ys', index: number) {
        e.stopPropagation();
        capture(e);
        setDrag({ kind: 'guide', axis, index });
    }

    function capture(e: RPointerEvent) {
        layer.current!.setPointerCapture(e.pointerId);
    }

    function pointerMove(e: RPointerEvent) {
        if (!drag) return;
        const p = point(e);
        if (drag.kind === 'marquee') {
            setDrag({ ...drag, at: p });
            return;
        }
        if (drag.kind === 'guide') {
            const v = Math.round(drag.axis === 'xs' ? p.x : p.y);
            const g = { ...settings.guides, [drag.axis]: settings.guides[drag.axis].map((x, i) => (i === drag.index ? v : x)) };
            onGuides(g);
            return;
        }
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        const lines = linesWithout(drag.kind === 'move' ? drag.names : [drag.name]);
        let next: Record<string, Box>;
        let shown: Lines;
        if (drag.kind === 'move') {
            const around = boundsOf(Object.values(drag.from));
            const s = snapMove({ ...around, x: around.x + dx, y: around.y + dy }, lines, snapOpts(e.altKey));
            const mx = s.box.x - around.x, my = s.box.y - around.y;
            next = {};
            for (const [n, b] of Object.entries(drag.from)) next[n] = { ...b, x: b.x + mx, y: b.y + my };
            shown = s.shown;
        } else {
            const f = drag.from, h = drag.handle;
            const raw = {
                x: f.x + (h.includes('w') ? dx : 0), y: f.y + (h.includes('n') ? dy : 0),
                w: f.w + (h.includes('e') ? dx : h.includes('w') ? -dx : 0), h: f.h + (h.includes('s') ? dy : h.includes('n') ? -dy : 0),
            };
            const s = snapResize(raw, h, lines, snapOpts(e.altKey));
            next = { [drag.name]: s.box };
            shown = s.shown;
        }
        const from = drag.kind === 'move' ? drag.from : { [drag.name]: drag.from };
        const changed = Object.keys(next).some((n) => (['x', 'y', 'w', 'h'] as const).some((k) => next[n][k] !== from[n][k]));
        const op: Op | null = changed ? { type: 'setBoxes', screen: screen.name, boxes: next } : null;
        setDrag({ ...drag, shown, op });
        setBoxes(next);
        onDrag(op);
    }

    function pointerUp() {
        if (!drag) return;
        if (drag.kind === 'marquee') {
            const r = { x: Math.min(drag.start.x, drag.at.x), y: Math.min(drag.start.y, drag.at.y),
                w: Math.abs(drag.at.x - drag.start.x), h: Math.abs(drag.at.y - drag.start.y) };
            if (r.w > 2 || r.h > 2) {
                const hit = screen.components.filter((c) => !c.boxless).filter((c) => overlaps(r, { ...boxOf(c), w: Math.max(c.w, 1), h: Math.max(c.h, 1) })).map((c) => c.name);
                onSelect([...new Set(drag.add.concat(hit))]);
            }
        } else if (drag.kind !== 'guide' && drag.op) {
            onEdit(drag.op);
        }
        setDrag(null);
        setBoxes(null);
        onDrag(null);
    }

    function drop(e: DragEvent) {
        const type = e.dataTransfer.getData(WIDGET_DRAG_TYPE);
        const wd = type && widget(type);
        if (!wd) return;
        e.preventDefault();
        const p = point(e);
        // the widget's centre where it was dropped, snapped, inside the screen
        const raw = { x: p.x - wd.size.w / 2, y: p.y - wd.size.h / 2, w: wd.size.w, h: wd.size.h };
        const b = snapMove(raw, linesWithout([]), snapOpts(e.altKey)).box;
        const x = Math.max(0, Math.min(design.w - b.w, b.x)), y = Math.max(0, Math.min(design.h - b.h, b.y));
        const name = newElementName(screen, type);
        if (onEdit({ type: 'addElement', screen: screen.name, widget: type, name, x, y })) onSelect([name]);
    }

    // a guide dragged off the screen is removed
    useEffect(() => {
        if (drag) return;
        const keep = (v: number, max: number) => v >= 0 && v <= max;
        const xs = settings.guides.xs.filter((v) => keep(v, design.w)), ys = settings.guides.ys.filter((v) => keep(v, design.h));
        if (xs.length !== settings.guides.xs.length || ys.length !== settings.guides.ys.length) onGuides({ xs, ys });
    }, [drag, settings.guides, design, onGuides]);

    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    const place = (b: Box) => ({ left: pct(b.x, design.w), top: pct(b.y, design.h), width: pct(b.w, design.w), height: pct(b.h, design.h) });
    const single = selection.length === 1 ? selection[0] : null;
    const shown = drag && (drag.kind === 'move' || drag.kind === 'resize') ? drag.shown : null;

    return (
        <ContextMenu>
        <ContextMenuTrigger render={<div className="canvas-wrap" />}>
            {children}
            <div ref={layer} className="canvas-layer" data-canvas="" onPointerDown={startMarquee} onPointerMove={pointerMove}
                onPointerUp={pointerUp} onPointerCancel={pointerUp}
                onDragOver={(e) => { if (e.dataTransfer.types.includes(WIDGET_DRAG_TYPE)) e.preventDefault(); }} onDrop={drop}>
                {rings && <div className="screen-margin" style={place({ x: RING_MARGIN, y: RING_MARGIN, w: design.w - 2 * RING_MARGIN, h: design.h - 2 * RING_MARGIN })} />}
                {screen.components.filter((c) => !c.boxless).map((c) => {
                    const b = (boxes && boxes[c.name]) || boxOf(c);
                    const sel = selection.includes(c.name);
                    return (
                        <div key={c.name}>
                            {rings && <div className="ring-margin" style={place({ x: b.x - RING_MARGIN, y: b.y - RING_MARGIN, w: b.w + 2 * RING_MARGIN, h: b.h + 2 * RING_MARGIN })} />}
                            <div className={'element' + (sel ? ' selected' : '')} data-canvas-element={c.name} title={c.name}
                                style={{ ...place(b), minWidth: 6, minHeight: 6 }} onPointerDown={(e) => startMove(e, c.name)}>
                                {single === c.name && HANDLES.map((h) => (
                                    <span key={h} className={'handle ' + h} onPointerDown={(e) => startResize(e, c.name, h)} />
                                ))}
                            </div>
                        </div>
                    );
                })}
                {settings.guides.xs.map((v, i) => (
                    <div key={'gx' + i} className="guide v" style={{ left: pct(v, design.w) }} title="Guide: drag to move, double-click or drag off to remove"
                        onPointerDown={(e) => startGuide(e, 'xs', i)}
                        onDoubleClick={() => onGuides({ ...settings.guides, xs: settings.guides.xs.filter((_, j) => j !== i) })} />
                ))}
                {settings.guides.ys.map((v, i) => (
                    <div key={'gy' + i} className="guide h" style={{ top: pct(v, design.h) }} title="Guide: drag to move, double-click or drag off to remove"
                        onPointerDown={(e) => startGuide(e, 'ys', i)}
                        onDoubleClick={() => onGuides({ ...settings.guides, ys: settings.guides.ys.filter((_, j) => j !== i) })} />
                ))}
                {shown && shown.xs.map((v) => <div key={'sx' + v} className="snap v" style={{ left: pct(v, design.w) }} />)}
                {shown && shown.ys.map((v) => <div key={'sy' + v} className="snap h" style={{ top: pct(v, design.h) }} />)}
                {drag && drag.kind === 'marquee' && (
                    <div className="marquee" style={place({ x: Math.min(drag.start.x, drag.at.x), y: Math.min(drag.start.y, drag.at.y),
                        w: Math.abs(drag.at.x - drag.start.x), h: Math.abs(drag.at.y - drag.start.y) })} />
                )}
            </div>
        </ContextMenuTrigger>
        <CanvasMenu />
        </ContextMenu>
    );
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

/** The canvas's right-click menu: the editing and stacking commands on the selection. */
function CanvasMenu() {
    const store = useEditorStore();
    const any = useEditor((s) => s.selection.length > 0);
    const clip = useEditor((s) => s.clipboard !== null);
    const stackable = useEditor(stackableOf);
    return (
        <ContextMenuContent className="w-56" data-canvas-menu="">
            <ContextMenuItem disabled={!any} onClick={() => copy(store)}>Copy <ContextMenuShortcut>{MOD}C</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuItem disabled={!any} onClick={() => cut(store)}>Cut <ContextMenuShortcut>{MOD}X</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuItem disabled={!clip} onClick={() => paste(store)}>Paste <ContextMenuShortcut>{MOD}V</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuItem disabled={!any} onClick={() => duplicate(store)}>Duplicate <ContextMenuShortcut>{MOD}D</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuItem disabled={!any} variant="destructive" onClick={() => deleteSelection(store)}>Delete <ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuSeparator />
            {STACKING.map((c, i) => (
                <ContextMenuItem key={c.place} disabled={stackable[i] !== '1'} data-canvas-stack={c.hook} onClick={() => stack(store, c.place)}>
                    {c.label} <ContextMenuShortcut>{MOD}{c.keys}</ContextMenuShortcut>
                </ContextMenuItem>
            ))}
        </ContextMenuContent>
    );
}
