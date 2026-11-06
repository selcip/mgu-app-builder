// The inspector's "Boxes" section for a boxes widget (the GT3 frame) or one of its boxes: how many it holds of what
// the engine draws, and Add box. A refusal (past the limit) shows as the editor's problem.
import { Plus } from 'lucide-react';
import { MAX_BOXES, newBoxId } from '../../model/index.ts';
import type { Element } from '../../model/index.ts';
import { Button } from '@/components/ui/button';
import { Hint, Row, Section } from '@/components/designer/form';
import { layoutOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

export function BoxesSection({ element }: { element: Element }) {
    const layout = useEditor(layoutOf);
    const { edit, select } = useActions();
    const widgetId = typeof element.parent === 'string' ? element.parent : element.gpu === 'boxes' ? element.name : null;
    const widget = layout && widgetId !== null ? layout.widgets.find((w) => (w as { id?: unknown })?.id === widgetId) as Record<string, unknown> | undefined : undefined;
    if (!widget) return null;
    const count = Array.isArray(widget.boxes) ? widget.boxes.length : 0;
    function add() {
        const id = newBoxId(widget!);
        if (edit({ type: 'addBox', widget: widgetId!, id })) select([`${widgetId}/${id}`]);
    }
    return (
        <Section title="Boxes" data-boxes={widgetId}
            actions={<Button variant="ghost" size="icon-xs" title="Add box" aria-label="Add box" data-add-box="" onClick={add}><Plus /></Button>}>
            <Row label="In use"><span data-box-count="">{count} of {MAX_BOXES}</span></Row>
            {count >= MAX_BOXES && <Hint>The engine draws at most {MAX_BOXES} boxes in one widget.</Hint>}
        </Section>
    );
}
