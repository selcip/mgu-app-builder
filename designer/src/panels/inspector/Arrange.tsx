// Arranging the selection: its exact box (one element), aligning (to each other, or one element to the screen) and
// distributing (three or more). Every change is one document-model operation.
import {
    AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter,
    AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, type LucideIcon,
} from 'lucide-react';
import type { Box, Edge } from '../../model/index.ts';
import { distribute, type Axis } from '../../canvas/arrange.ts';
import { CommitInput } from '../../PropertyPanel';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/designer/form';
import { screenOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

const ALIGN: { edge: Edge; label: string; icon: LucideIcon }[] = [
    { edge: 'left', label: 'Left', icon: AlignStartVertical }, { edge: 'centre', label: 'Centre', icon: AlignCenterVertical },
    { edge: 'right', label: 'Right', icon: AlignEndVertical }, { edge: 'top', label: 'Top', icon: AlignStartHorizontal },
    { edge: 'middle', label: 'Middle', icon: AlignCenterHorizontal }, { edge: 'bottom', label: 'Bottom', icon: AlignEndHorizontal },
];
const DISTRIBUTE: { axis: Axis; label: string; icon: LucideIcon }[] = [
    { axis: 'across', label: 'Distribute across, with equal gaps', icon: AlignHorizontalDistributeCenter },
    { axis: 'down', label: 'Distribute down, with equal gaps', icon: AlignVerticalDistributeCenter },
];

export function Arrange() {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const { edit } = useActions();
    const sel = selection.filter((n) => screen.components.some((c) => c.name === n));
    if (!sel.length) return null;
    const one = sel.length === 1 ? screen.components.find((c) => c.name === sel[0]) : undefined;
    const setBox = (k: keyof Box) => (v: string) => {
        const n = Number(v);
        if (one && v.trim() !== '' && isFinite(n)) edit({ type: 'setBoxes', screen: screen.name, boxes: { [one.name]: { [k]: Math.round(n) } } });
    };
    const spread = (axis: Axis) => {
        const boxes = distribute(screen, sel, axis);
        if (boxes) edit({ type: 'setBoxes', screen: screen.name, boxes });
    };
    return (
        <Section title={sel.length > 1 ? `${sel.length} elements` : 'Layout'} data-arrange="">
            <div className="mb-2 flex items-center gap-0.5" role="toolbar" aria-label="Align">
                {ALIGN.map((a) => (
                    <Button key={a.edge} variant="ghost" size="icon-sm" data-align={a.edge}
                        title={sel.length > 1 ? `Align ${a.label.toLowerCase()} edges/lines of the selection` : `Align to the screen's ${a.label.toLowerCase()}`}
                        onClick={() => edit({ type: 'alignElements', screen: screen.name, elements: sel, edge: a.edge })}>
                        <a.icon />
                    </Button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                {DISTRIBUTE.map((d) => (
                    <Button key={d.axis} variant="ghost" size="icon-sm" data-distribute={d.axis} disabled={sel.length < 3}
                        title={sel.length < 3 ? `${d.label} (select three or more)` : d.label} onClick={() => spread(d.axis)}>
                        <d.icon />
                    </Button>
                ))}
            </div>
            {one && (
                <div className="grid grid-cols-2 gap-1.5" data-box={one.name} key={one.name}>{/* afresh per element: no flash of the last one's box */}
                    {(['x', 'y', 'w', 'h'] as const).map((k) => (
                        <label key={k} className="flex items-center gap-1.5 text-xs">
                            <span className="w-3 text-muted-foreground">{k.toUpperCase()}</span>
                            <CommitInput type="number" step="1" value={String(one[k])} onCommit={setBox(k)} />
                        </label>
                    ))}
                </div>
            )}
        </Section>
    );
}
