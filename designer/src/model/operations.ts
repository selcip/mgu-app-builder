// Every operation the document model knows: each module's handlers, merged. A new group of operations is a new
// module under ops/ and one line in each list below.
import type { OpsOf } from './core.ts';
import { screenOps } from './ops/screens.ts';
import { elementOps } from './ops/elements.ts';
import { canvasOps } from './ops/canvas.ts';
import { rowOps } from './ops/rows.ts';
import { languageOps } from './ops/languages.ts';
import { imageOps } from './ops/images.ts';

export const HANDLERS = {
    ...screenOps,
    ...elementOps,
    ...canvasOps,
    ...rowOps,
    ...languageOps,
    ...imageOps,
};

/** An edit to the document: `{ type: 'addScreen', name: 'home' }`, `{ type: 'setOption', ... }`, ... */
export type Op = OpsOf<typeof HANDLERS>;
