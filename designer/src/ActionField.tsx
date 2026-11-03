// The action the selected element reports when the driver selects it: its name unless the app author names another.
import { actionOf, type Element, type Op } from './model/index.ts';
import { CommitInput } from './PropertyPanel';

export function ActionField({ screen, element, edit }: { screen: string; element: Element; edit: (op: Op) => unknown }) {
    return (
        <label className="action-field" data-action-field="">
            Action <small>(reported to your code; empty = the element’s name)</small>
            <CommitInput value={actionOf(element)}
                onCommit={(v) => edit({ type: 'setAction', screen, element: element.name, action: v.trim() })} />
        </label>
    );
}
