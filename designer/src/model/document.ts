// The document: a new screen file, and apply(), the single entry point every edit goes through.
import { DEFAULT_THEME } from '../catalog.ts';
import { DESIGN, EditError, SCHEMA, type ClusterLayout, type Doc, type Draft, type ScreenDoc } from './core.ts';
import { HANDLERS, LAYOUT_HANDLERS, type Op } from './operations.ts';
import { blankScreen } from './ops/screens.ts';

export function newDocument(): ScreenDoc {
    return {
        file: { schema: SCHEMA, first: 'main', design: { ...DESIGN }, screens: [blankScreen('main', 'Main', DEFAULT_THEME)] },
        images: {},
    };
}

/**
 * Applies one operation and returns the new document; `doc` itself is never changed, so documents can be kept
 * for undo. Throws EditError when the operation is refused. An edited file is a schema 1 screen file.
 */
export function apply(doc: Doc, op: Op): Doc {
    const type = op && op.type;
    if (doc.kind === 'cluster-layout') {
        const lh = (LAYOUT_HANDLERS as Record<string, (d: { layout: ClusterLayout }, a: unknown) => void>)[type];
        if (!lh || !Object.prototype.hasOwnProperty.call(LAYOUT_HANDLERS, type)) {
            throw new EditError(`${JSON.stringify(type)} is not an operation on a cluster layout.`);
        }
        const l = { layout: structuredClone(doc.layout) };
        lh(l, op);
        return { kind: 'cluster-layout', layout: l.layout, images: doc.images };
    }
    const handler = Object.prototype.hasOwnProperty.call(HANDLERS, type)
        ? (HANDLERS as Record<string, (d: Draft, a: unknown) => void>)[type] : undefined;
    if (!handler) throw new EditError(`Unknown operation ${JSON.stringify(type)}.`);
    const d: Draft = { file: structuredClone(doc.file), images: { ...doc.images } };
    handler(d, op);
    if (d.file.schema === undefined) d.file = { schema: SCHEMA, ...d.file };
    return d;
}
