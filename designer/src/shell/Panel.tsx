// A panel's frame. Docked: a full-height column beside the canvas. Floating: over the canvas where it was dragged
// by its header, and collapsible to the header. Either way its inner edge drags to resize it, and its header has
// the dock/float toggle. Layouts are the store's (kept per browser); the area under the toolbar is measured here
// so a floating panel always stays inside it, also when the window shrinks.
import { createContext, useContext, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, PanelLeft, PanelRight, SquareArrowOutUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { clampPosition, floatingAt, type Area, type Side } from './panels.ts';
import { useActions, useEditor, useEditorStore } from '../store/react.tsx';

const AreaSize = createContext<Area>({ w: 0, h: 0 });

/** The area under the toolbar that holds the panels and the canvas; floating panels are placed in it. */
export function PanelArea({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLElement>(null);
    const [area, setArea] = useState<Area>({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const el = ref.current!;
        const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return (
        <main ref={ref} className="relative flex min-h-0 flex-1" data-panel-area="">
            <AreaSize.Provider value={area}>{children}</AreaSize.Provider>
        </main>
    );
}

type Drag = { kind: 'move'; id: number; px: number; py: number; x: number; y: number }
    | { kind: 'resize'; id: number; px: number; width: number; x: number };

export function Panel({ side, title, children, className }: {
    side: Side;
    title: string;
    children: ReactNode;
    className?: string;
}) {
    const layout = useEditor((s) => s.panels[side]);
    const hidden = useEditor((s) => s.panelsHidden);
    const store = useEditorStore();
    const { setPanel } = useActions();
    const area = useContext(AreaSize);
    const [drag, setDrag] = useState<Drag | null>(null);
    const floating = layout.mode === 'floating';
    const at = floating ? floatingAt(layout, side, area) : null;

    function toggleMode() {
        if (floating) setPanel(side, { mode: 'docked' });
        else setPanel(side, { mode: 'floating', collapsed: false });
    }

    function startMove(e: PointerEvent<HTMLDivElement>) {
        if (!floating || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'move', id: e.pointerId, px: e.clientX, py: e.clientY, x: at!.x, y: at!.y });
    }
    function startResize(e: PointerEvent<HTMLDivElement>) {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ kind: 'resize', id: e.pointerId, px: e.clientX, width: layout.width, x: at ? at.x : 0 });
    }
    function move(e: PointerEvent<HTMLDivElement>) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.px;
        if (drag.kind === 'move') {
            setPanel(side, clampPosition(drag.x + dx, drag.y + e.clientY - drag.py, layout.width, area));
        } else {
            // the inner edge follows the pointer; a floating right panel keeps its right edge where it is
            setPanel(side, { width: drag.width + (side === 'left' ? dx : -dx) });
            if (floating && side === 'right') {
                const w = store.getState().panels.right.width;
                setPanel(side, { x: drag.x + drag.width - w, y: at!.y });
            }
        }
    }
    const end = (e: PointerEvent<HTMLDivElement>) => { if (drag && e.pointerId === drag.id) setDrag(null); };

    if (hidden) return null;
    const collapsed = floating && layout.collapsed;
    return (
        <aside data-panel={side} data-panel-mode={layout.mode} data-collapsed={collapsed || undefined} aria-label={title}
            className={cn('flex min-h-0 flex-col bg-card text-card-foreground',
                floating
                    ? 'absolute z-30 rounded-lg border shadow-xl shadow-black/40'
                    : cn('relative flex-none', side === 'left' ? 'border-r' : 'border-l'),
                className)}
            style={floating
                ? { left: at!.x, top: at!.y, width: layout.width, maxHeight: Math.max(40, area.h - at!.y - 12) }
                : { width: layout.width }}>
            <div data-panel-header="" onPointerDown={startMove} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                className={cn('flex h-10 flex-none select-none items-center gap-1 px-3 text-xs font-medium text-muted-foreground',
                    !collapsed && 'border-b', floating && (drag && drag.kind === 'move' ? 'cursor-grabbing' : 'cursor-grab'))}>
                <span className="flex-1 truncate">{title}</span>
                {floating && (
                    <Button variant="ghost" size="icon-xs" data-panel-collapse="" aria-expanded={!collapsed}
                        title={collapsed ? 'Expand' : 'Collapse to the header'} onClick={() => setPanel(side, { collapsed: !collapsed })}>
                        {collapsed ? <ChevronDown /> : <ChevronUp />}
                    </Button>
                )}
                <Button variant="ghost" size="icon-xs" data-panel-float-toggle=""
                    title={floating ? 'Dock beside the canvas' : 'Float over the canvas'} onClick={toggleMode}>
                    {floating ? (side === 'left' ? <PanelLeft /> : <PanelRight />) : <SquareArrowOutUpRight />}
                </Button>
            </div>
            <div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3', collapsed && 'hidden')}>{children}</div>
            {!collapsed && (
                <div data-panel-resize="" title="Drag to resize" onPointerDown={startResize} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                    className={cn('absolute top-0 bottom-0 z-10 w-1.5 cursor-ew-resize hover:bg-ring/40', side === 'left' ? '-right-0.5' : '-left-0.5',
                        drag && drag.kind === 'resize' && 'bg-ring/60')} />
            )}
        </aside>
    );
}

/** Ctrl/Cmd + \ hides and shows both panels. */
export function usePanelKeys() {
    const { togglePanelsHidden } = useActions();
    useLayoutEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); togglePanelsHidden(); }
        };
        window.addEventListener('keydown', down);
        return () => window.removeEventListener('keydown', down);
    }, [togglePanelsHidden]);
}
