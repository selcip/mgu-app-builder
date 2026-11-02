// Trying a screen in the preview: arrow keys and Enter stand in for the iDrive controller, clicks for taps; the
// actions the runtime reports are listed as the app's code would receive them.
import type { Action } from './preview';

export function TryPanel(props: { trying: boolean; onTrying: (on: boolean) => void; actions: Action[]; onClear: () => void }) {
    return (
        <div className="try-panel">
            <label>
                <input type="checkbox" checked={props.trying} onChange={(e) => props.onTrying(e.target.checked)} />{' '}
                Try it: ← → (or ↑ ↓) move the highlight, Enter selects, Esc is BACK, a click taps
            </label>
            {props.actions.length > 0 && <button onClick={props.onClear}>Clear</button>}
            <ol className="actions" aria-label="Actions reported">{props.actions.map((a, i) => (
                <li key={i} data-action={a.action}>
                    <code>{`{ screen: '${a.screen}', element: '${a.element}', action: '${a.action}'`
                        + ('value' in a ? `, value: ${JSON.stringify(a.value).replace(/^"(.*)"$/, "'$1'")}` : '') + ' }'}</code>
                </li>
            ))}</ol>
        </div>
    );
}

/** The controller input a key stands for in the preview, or null. */
export function controllerKey(key: string): 'left' | 'right' | 'press' | 'back' | null {
    switch (key) {
        case 'ArrowLeft': case 'ArrowUp': return 'left';
        case 'ArrowRight': case 'ArrowDown': return 'right';
        case 'Enter': case ' ': return 'press';
        case 'Backspace': case 'Escape': return 'back';
        default: return null;
    }
}
