// The screen's focus order: reorder, leave elements out, take them back in, or go back to reading order. Every
// change is a document-model operation.
import { focusOrderOf, type Op, type Screen } from './model/index.ts';

export function FocusPanel({ screen, edit }: { screen: Screen; edit: (op: Op) => unknown }) {
    const order = focusOrderOf(screen);
    const out = screen.components.map((c) => c.name).filter((n) => !order.includes(n));
    const s = screen.name;
    return (
        <div className="focus-panel" data-focus-panel="">
            <h2>Focus order {Array.isArray(screen.focus) ? '(custom)' : '(reading order)'}</h2>
            {order.length === 0 && <p className="hint">Nothing takes focus on this screen.</p>}
            <ol>{order.map((n, i) => (
                <li key={n} data-focus-item={n}>
                    <span>{n}</span>
                    <button title="Earlier" disabled={i === 0} onClick={() => edit({ type: 'moveInFocus', screen: s, element: n, to: i - 1 })}>↑</button>
                    <button title="Later" disabled={i === order.length - 1} onClick={() => edit({ type: 'moveInFocus', screen: s, element: n, to: i + 1 })}>↓</button>
                    <button title="Leave out of the focus order" onClick={() => edit({ type: 'excludeFromFocus', screen: s, element: n })}>✕</button>
                </li>
            ))}</ol>
            {out.length > 0 && <>
                <h2>Not in focus</h2>
                <ul>{out.map((n) => (
                    <li key={n} data-focus-out={n}>
                        <span>{n}</span>
                        <button title="Add at the end of the focus order" onClick={() => edit({ type: 'includeInFocus', screen: s, element: n })}>Add</button>
                    </li>
                ))}</ul>
            </>}
            {Array.isArray(screen.focus) && (
                <button data-reset-focus="" onClick={() => edit({ type: 'resetFocusOrder', screen: s })}>Back to reading order</button>
            )}
        </div>
    );
}
