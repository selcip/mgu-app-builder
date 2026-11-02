// The document: a new screen file, and apply(), the single entry point every edit goes through.
import { DEFAULT_THEME } from '../catalog.ts';
import { DESIGN, EditError, SCHEMA, type Doc, type Draft } from './core.ts';
import { HANDLERS, type Op } from './operations.ts';
import { blankScreen } from './ops/screens.ts';

export function newDocument(): Doc {
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
    const handler = (HANDLERS as Record<string, (d: Draft, a: unknown) => void>)[op && op.type];
    if (!handler) throw new EditError(`Unknown operation ${JSON.stringify(op && op.type)}.`);
    const d: Draft = { file: structuredClone(doc.file), images: { ...doc.images } };
    handler(d, op);
    if (d.file.schema === undefined) d.file = { schema: SCHEMA, ...d.file };
    return d;
}
