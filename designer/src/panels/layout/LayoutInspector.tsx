// The right panel while a cluster layout is open: the selected element's name (the widget's id), its widget kind and
// its box, with the same Arrange section as for screens (box fields, align, distribute). What the widget's options
// are comes with the cluster widget catalog.
import { Arrange } from '../inspector/Arrange';
import { Hint, Row, Section } from '@/components/designer/form';
import { screenOf } from '../../store/editor.ts';
import { useEditor } from '../../store/react.tsx';

export function LayoutInspector() {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const sel = screen.components.filter((c) => selection.includes(c.name));
    const one = sel.length === 1 ? sel[0] : undefined;
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
            {sel.length > 0 && !(one && one.boxless) && <Arrange />}
        </div>
    );
}
