// The focus order drawn over the canvas: each element in it numbered at its top-left corner, in the order the
// iDrive controller moves through them (the runtime's order: an explicit list, else reading order).
import { focusOrderOf, type Screen } from './model/index.ts';

export function FocusOverlay({ screen }: { screen: Screen }) {
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
