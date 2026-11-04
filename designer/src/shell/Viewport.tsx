// The canvas area: the HMI page drawn at the view's zoom and position, over an empty backdrop.
//   pan: Space + drag, middle-mouse drag, or the wheel (Shift + wheel: sideways)
//   zoom: Ctrl/Cmd + wheel (about the pointer), Ctrl/Cmd + = and -, Ctrl/Cmd + 0 for 100 %, Shift + 1 to fit
// Pointer positions on the page are converted from its on-screen box, so editing and trying work at any zoom.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { wheelZoom } from './view.ts';
import { useActions, useEditor, useEditorStore } from '../store/react.tsx';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function Viewport({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
    const view = useEditor((s) => s.view);
    const store = useEditorStore();
    const { setMeasure, setView, zoomTo, zoomStep, zoomToFit, panBy } = useActions();
    const box = useRef<HTMLDivElement>(null);
    const page = useRef<HTMLDivElement>(null);
    const [space, setSpace] = useState(false);
    const [pan, setPan] = useState<{ id: number; x: number; y: number; vx: number; vy: number } | null>(null);

    // measure the canvas and the page (unzoomed) whenever either changes size
    useLayoutEffect(() => {
        const measure = () => {
            if (!box.current || !page.current) return;
            setMeasure({ w: box.current.clientWidth, h: box.current.clientHeight }, { w: page.current.offsetWidth, h: page.current.offsetHeight });
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (box.current) ro.observe(box.current);
        if (page.current) ro.observe(page.current);
        return () => ro.disconnect();
    }, [setMeasure]);

    // the wheel pans, Ctrl + wheel zooms; a native listener, since React's wheel listener can't prevent scrolling
    useEffect(() => {
        const el = box.current!;
        const wheel = (e: WheelEvent) => {
            e.preventDefault();
            const v = store.getState().view;
            if (!v) return;
            if (e.ctrlKey || e.metaKey) {
                const r = el.getBoundingClientRect();
                zoomTo(wheelZoom(v.zoom, e.deltaY), { x: e.clientX - r.left, y: e.clientY - r.top });
            } else {
                panBy(-(e.shiftKey ? e.deltaY : e.deltaX), e.shiftKey ? 0 : -e.deltaY);
            }
        };
        el.addEventListener('wheel', wheel, { passive: false });
        return () => el.removeEventListener('wheel', wheel);
    }, [store, zoomTo, panBy]);

    // keys: Space held to pan, and the zoom shortcuts (not while typing in a field)
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (typing(e.target)) return;
            const mod = e.ctrlKey || e.metaKey;
            if (e.code === 'Space' && !mod) {
                if (store.getState().trying || e.defaultPrevented) return;      // trying: Space is the controller's press
                e.preventDefault(); if (!e.repeat) setSpace(true); return;
            }
            let done = true;
            if (mod && e.key === '0') zoomTo(1);
            else if (mod && (e.key === '=' || e.key === '+')) zoomStep(1);
            else if (mod && e.key === '-') zoomStep(-1);
            else if (!mod && e.shiftKey && e.code === 'Digit1') zoomToFit();
            else done = false;
            if (done) e.preventDefault();
        };
        const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
        const blur = () => setSpace(false);
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', blur);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', blur);
        };
    }, [store, zoomTo, zoomStep, zoomToFit]);

    // panning by dragging: the middle button, or the left one while Space is held; nothing under it sees the drag
    function startPan(e: PointerEvent<HTMLDivElement>) {
        const v = store.getState().view;
        if (!v || !(e.button === 1 || (e.button === 0 && space))) return;
        e.preventDefault();
        e.stopPropagation();
        box.current!.setPointerCapture(e.pointerId);
        setPan({ id: e.pointerId, x: e.clientX, y: e.clientY, vx: v.x, vy: v.y });
    }
    function movePan(e: PointerEvent<HTMLDivElement>) {
        if (!pan || e.pointerId !== pan.id) return;
        const v = store.getState().view!;
        setView({ ...v, x: pan.vx + e.clientX - pan.x, y: pan.vy + e.clientY - pan.y });
    }
    function endPan(e: PointerEvent<HTMLDivElement>) {
        if (pan && e.pointerId === pan.id) setPan(null);
    }

    return (
        <div ref={box} data-viewport="" data-zoom={view ? view.zoom : undefined}
            className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/60"
            onPointerDownCapture={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}
            onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
            onScroll={(e) => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}>{/* focusing inside must not scroll it */}
            <div ref={page} className="absolute left-0 top-0 origin-top-left"
                style={{
                    transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` : undefined,
                    visibility: view ? undefined : 'hidden',
                }}>
                {children}
            </div>
            {(space || pan) && <div className="absolute inset-0 z-10" style={{ cursor: pan ? 'grabbing' : 'grab' }} />}
            {overlay}
        </div>
    );
}
