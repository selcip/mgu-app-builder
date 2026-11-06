// The car's view on the cluster canvas: the toggle, the masks over what the driver cannot see (the hood over the top
// corners, BMW's gear box, the seat-belt light) and the warnings per element. The geometry and the reasons are the
// engine's own (cluster.visible). The masks are an SVG layer above the engine's canvas, not drawn into it, so they
// are not in the saved file and not in the engine's frames. Warnings follow the edit being dragged, live.
import { useMemo } from 'react';
import cluster from 'virtual:cluster-engine';
import { apply } from '../model/index.ts';
import { masksOf, warningsOf } from '../model/visibility.ts';
import { useEditor } from '../store/react.tsx';

const [W, H] = cluster.TARGETS.panel;
const ORANGE = '#ff8c1a';
const MASKS = masksOf(cluster.visible);

/** The reasons per widget id for the layout as it is now (a drag in progress applied), [] when none are hidden. */
export function useWarnings(): Record<string, string[]> {
    const doc = useEditor((s) => s.history.present);
    const dragOp = useEditor((s) => s.dragOp);
    return useMemo(() => {
        let d = doc;
        if (dragOp) { try { d = apply(doc, dragOp); } catch { /* the drag is refused: show the layout as it is */ } }
        return d.kind === 'cluster-layout' ? warningsOf(d.layout, cluster.visible) : {};
    }, [doc, dragOp]);
}

/** The warnings of one element, for the element list and the inspector. */
export function useElementWarnings(name: string): string[] {
    return useWarnings()[name] || [];
}

const label = (text: string, x: number, y: number) => (
    <g>
        <rect x={x} y={y} width={text.length * 7.4 + 8} height={16} fill="rgba(0,0,0,.7)" />
        <text x={x + 4} y={y + 12} fill={ORANGE} fontSize={12} fontFamily="ui-monospace, Menlo, monospace">{text}</text>
    </g>
);

export function CarViewMasks() {
    const m = MASKS;
    return (
        <svg data-car-view="" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            <polygon data-car-mask="hood" points={m.hood.map((p) => p.join(',')).join(' ')} fill="rgba(8,8,10,.78)" />
            <polyline points={m.hood.slice(1, -1).map((p) => p.join(',')).join(' ')} fill="none" stroke={ORANGE} strokeWidth={1.5} />
            {label('hood (hidden above the line)', 150, 60)}
            <rect data-car-mask="gear-box" x={m.gearBox.x} y={m.gearBox.y} width={m.gearBox.w} height={m.gearBox.h} fill="#000" stroke={ORANGE} />
            {label('BMW gear box', m.gearBox.x + 2, m.gearBox.y + 2)}
            <rect data-car-mask="belt" x={m.belt.x} y={m.belt.y} width={m.belt.w} height={m.belt.h} fill="rgba(232,55,44,.55)" stroke={ORANGE} />
            {label('belt light', m.belt.x - 10, m.belt.y - 18)}
        </svg>
    );
}

export function CarViewToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={on} data-car-view-toggle="" onClick={() => onChange(!on)}
            title="What the driver sees: the hood hides the top corners of the cluster, and BMW draws its gear box and belt light over it. Measured from car photos."
            className="absolute right-3 top-3 z-20 rounded-md border bg-card px-2 py-1 text-xs shadow aria-checked:border-orange-400 aria-checked:text-orange-300">
            Car’s view
        </button>
    );
}

/** A mark for an element that is under the hood, the gear box or the belt light; the reasons are its title. */
export function WarningMark({ name }: { name: string }) {
    const w = useElementWarnings(name);
    if (!w.length) return null;
    return <span data-warning={name} role="img" aria-label={`Warning: ${w.join('; ')}`} title={w.join('\n')} className="flex-none text-amber-400">⚠</span>;
}
