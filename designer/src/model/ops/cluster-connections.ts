// The connection an element's layer goes to (the widget's "conn" field, 0..3; 0 the app's own and the default, so
// the key is left out for it). Each connection has its own 8 layers on the car (the Layer budget shows them).
import { EditError, type ClusterLayout } from '../core.ts';

/** How many connections a layout may ask for: the widget's conn is 0 .. CONNECTIONS - 1. */
export const CONNECTIONS = 4;

/** An element's connection, 0-based. */
export function connOf(widget: unknown): number {
    const n = widget && typeof widget === 'object' ? (widget as { conn?: unknown }).conn : undefined;
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(CONNECTIONS - 1, Math.floor(n))) : 0;
}

export const clusterConnectionOps = {
    /** Puts the named element on connection `conn` (0..3). */
    setConn(d: { layout: ClusterLayout }, a: { element: string; conn: number }) {
        if (typeof a.conn !== 'number' || !Number.isInteger(a.conn) || a.conn < 0 || a.conn >= CONNECTIONS) {
            throw new EditError(`The connection must be a whole number from 0 to ${CONNECTIONS - 1}.`);
        }
        const w = d.layout.widgets.find((x) => !!x && typeof x === 'object' && (x as { id?: unknown }).id === a.element) as Record<string, unknown> | undefined;
        if (!w) throw new EditError(`The layout has no element "${a.element}".`);
        if (a.conn === 0) delete w.conn; else w.conn = a.conn;
    },
};
