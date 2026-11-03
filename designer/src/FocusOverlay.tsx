// The focus order drawn over the canvas: each element in it numbered at its top-left corner, in the order the
// iDrive controller moves through them (the runtime's order: an explicit list, else reading order).
import { focusOrderOf } from './model/index.ts';
import { screenOf } from './store/editor.ts';
import { useEditor } from './store/react.tsx';

export function FocusOverlay() {
    const screen = useEditor(screenOf);
    const order = focusOrderOf(screen);
    return (
        <div className="focus-overlay" aria-label="Focus order">
            {order.map((name, i) => {
                const c = screen.components.find((x) => x.name === name)!;
                return (
                    <span key={name} className="focus-badge" data-focus={name} style={{ left: c.x, top: c.y }}
                        title={`${i + 1}: ${name}`}>{i + 1}</span>
                );
            })}
        </div>
    );
}
