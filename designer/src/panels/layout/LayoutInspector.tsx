// The right panel while a cluster layout is open: the selected element's name (the widget's id), its widget kind and
// its box, with the same Arrange section as for screens (box fields, align, distribute). What the widget's options
// are comes with the cluster widget catalog.
import { lockedNote } from '../../model/index.ts';
import { PalettePanel, WidgetOptions } from './WidgetOptions';
import { Arrange } from '../inspector/Arrange';
import { BoxesSection } from './BoxesSection';
import { Hint, Row, Section } from '@/components/designer/form';
import { useWarnings } from '../../canvas/CarView';
import { screenOf } from '../../store/editor.ts';
import { useEditor } from '../../store/react.tsx';

export function LayoutInspector() {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const sel = screen.components.filter((c) => selection.includes(c.name));
    const one = sel.length === 1 ? sel[0] : undefined;
    const warnings = useWarnings();
    return (
        <div data-layout-inspector="">
            {sel.length === 0 && <Hint>Select an element on the canvas or in the list.</Hint>}
            {one && (
                <Section title="Element" data-element-info={one.name}>
                    <Row label="Name"><span data-info="name" className="truncate">{one.name}</span></Row>
                    <Row label="Widget"><span data-info="kind" className="truncate">{one.gpu}</span></Row>
                    {Boolean(one.boxless) && <Hint>This element has no box (x, y, w, h) in the layout, so it can’t be moved or resized.</Hint>}
                </Section>
            )}
            {one && <BoxesSection element={one} />}
            {sel.some((c) => warnings[c.name]) && (
                <Section title="Warnings" data-warnings="">
                    {sel.filter((c) => warnings[c.name]).flatMap((c) => warnings[c.name].map((w) => (
                        <p key={c.name + w} data-warning-text={c.name} className="m-0 text-xs text-amber-400">{sel.length > 1 ? c.name + ': ' : ''}{w}</p>
                    )))}
                </Section>
            )}
            {one && Boolean(one.locked) && <LockedNote name={one.name} widget={one.widget as Record<string, unknown>} type={one.gpu} />}
            {one && !one.locked && <WidgetOptions name={one.name} widget={one.widget as Record<string, unknown>} />}
            {sel.length > 0 && !(one && one.boxless) && <Arrange />}
            <PalettePanel />
        </div>
    );
}

/** A locked element's note (what it draws and why it is locked) and its parameters, read-only exactly as the file has them. */
function LockedNote({ name, widget, type }: { name: string; widget: Record<string, unknown>; type: string }) {
    const { id: _id, type: _type, x: _x, y: _y, w: _w, h: _h, ...params } = widget;
    return (
        <Section title="Locked" data-locked-note={name}>
            <Hint>{lockedNote(type)}</Hint>
            <pre data-locked-params={name} aria-label="Parameters (read-only)" tabIndex={0}
                className="m-0 max-h-64 overflow-auto rounded bg-muted p-2 text-[0.7rem] leading-snug">{JSON.stringify(params, null, 1)}</pre>
        </Section>
    );
}
