// The connection of the selected element, in the layout inspector: the widget's conn field (0..3), one undo step.
// Each connection has its own 8 layers on the car (see the Layer budget).
import { CONNECTIONS, connOf } from '../../model/index.ts';
import { Row, Section, selectClass } from '@/components/designer/form';
import { layoutOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

export function ElementConnection({ element }: { element: string }) {
    const widget = useEditor((s) => layoutOf(s)?.widgets.find((w) => (w as { id?: unknown })?.id === element));
    const { edit } = useActions();
    if (!widget) return null;
    return (
        <Section title="Connection" data-element-connection={element}>
            <Row label="Layers go to">
                <select className={selectClass} value={connOf(widget)} aria-label="Connection"
                    onChange={(e) => edit({ type: 'setConn', element, conn: Number(e.target.value) })}>
                    {Array.from({ length: CONNECTIONS }, (_, i) => <option key={i} value={i}>{`Connection ${i + 1}`}{i === 0 ? ' (the app’s own)' : ''}</option>)}
                </select>
            </Row>
        </Section>
    );
}
