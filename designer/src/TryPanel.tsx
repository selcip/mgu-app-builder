// Trying the app in the preview: arrow keys and Enter stand in for the iDrive controller, clicks for taps, Esc for
// BACK. The preview follows navigation links and BACK through the screens; what the runtime reports (actions, screen
// changes, leaving the app) is listed as the app's code would receive it.
import type { Action, ScreenChange } from './preview';

/** One thing the runtime reported while trying. */
export type Report = { action: Action } | { change: ScreenChange } | { leave: string };

const quote = (v: unknown) => JSON.stringify(v).replace(/^"(.*)"$/, "'$1'");

function ReportItem({ r }: { r: Report }) {
    if ('action' in r) {
        const a = r.action;
        return (
            <li data-action={a.action}>
                <code>{`{ screen: '${a.screen}', element: '${a.element}', action: '${a.action}'`
                    + ('value' in a ? `, value: ${quote(a.value)}` : '') + ' }'}</code>
            </li>
        );
    }
    if ('change' in r) {
        const c = r.change;
        return (
            <li data-screen-change={c.screen} className="screen-change">
                <code>{`screen: { screen: '${c.screen}', from: ${c.from === null ? 'null' : `'${c.from}'`}, by: '${c.by}' }`}</code>
            </li>
        );
    }
    return (
        <li data-leave={r.leave} className="leave">
            <code>{`leave: { screen: '${r.leave}' }`}</code> BACK on the first screen: the driver leaves the app
        </li>
    );
}

export function TryPanel(props: { trying: boolean; onTrying: (on: boolean) => void; reports: Report[]; onClear: () => void }) {
    return (
        <div className="try-panel">
            <label>
                <input type="checkbox" checked={props.trying} onChange={(e) => props.onTrying(e.target.checked)} />{' '}
                Try it: ← → (or ↑ ↓) move the highlight, Enter selects, Esc (or Backspace) is BACK, a click taps
            </label>
            {props.reports.length > 0 && <button onClick={props.onClear}>Clear</button>}
            <ol className="actions" aria-label="Reported to your code">{props.reports.map((r, i) => <ReportItem key={i} r={r} />)}</ol>
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
