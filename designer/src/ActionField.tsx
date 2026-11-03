// The action the selected element reports when the driver selects it: its name unless the app author names another.
import { actionOf } from './model/index.ts';
import { CommitInput } from './PropertyPanel';
import { elementOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';

export function ActionField() {
    const screen = useEditor((s) => s.selected);
    const element = useEditor(elementOf);
    const { edit } = useActions();
    if (!element) return null;
    return (
        <label className="action-field" data-action-field="">
            Action <small>(reported to your code; empty = the element’s name)</small>
            <CommitInput value={actionOf(element)}
                onCommit={(v) => edit({ type: 'setAction', screen, element: element.name, action: v.trim() })} />
        </label>
    );
}
