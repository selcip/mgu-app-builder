// Every operation the document model knows: each module's handlers, merged. A new group of operations is a new
// module under ops/ and one line in each list below.
import type { OpsOf } from './core.ts';
import { screenOps } from './ops/screens.ts';
import { elementOps } from './ops/elements.ts';

export const HANDLERS = {
    ...screenOps,
    ...elementOps,
};

/** An edit to the document: `{ type: 'addScreen', name: 'home' }`, `{ type: 'setOption', ... }`, ... */
export type Op = OpsOf<typeof HANDLERS>;
