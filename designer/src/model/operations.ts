// Every operation the document model knows: each module's handlers, merged. A new group of operations is a new
// module under ops/ and one line in each list below. Screen files and cluster layouts have operations of their own.
import type { OpsOf } from './core.ts';
import { screenOps } from './ops/screens.ts';
import { elementOps } from './ops/elements.ts';
import { canvasOps } from './ops/canvas.ts';
import { rowOps } from './ops/rows.ts';
import { languageOps } from './ops/languages.ts';
import { imageOps } from './ops/images.ts';
import { focusOps } from './ops/focus.ts';
import { navigationOps } from './ops/navigation.ts';
import { stackingOps } from './ops/stacking.ts';
import { layoutOps } from './ops/layout.ts';
import { clusterElementOps } from './ops/cluster-elements.ts';
import { clusterBoxOps } from './ops/cluster-boxes.ts';
import { clusterConditionOps } from './ops/cluster-conditions.ts';

/** The screen file's operations. */
export const HANDLERS = {
    ...screenOps,
    ...elementOps,
    ...canvasOps,
    ...rowOps,
    ...languageOps,
    ...imageOps,
    ...focusOps,
    ...navigationOps,
    ...stackingOps,
};

/** The cluster layout's operations. */
export const LAYOUT_HANDLERS = {
    ...layoutOps,
    ...clusterElementOps,
    ...clusterBoxOps,
    ...clusterConditionOps,
};

export type ScreenOp = OpsOf<typeof HANDLERS>;
export type LayoutOp = OpsOf<typeof LAYOUT_HANDLERS>;

/** An edit to the document: `{ type: 'addScreen', name: 'home' }`, `{ type: 'setOption', ... }`, `{ type: 'renameLayout', ... }` */
export type Op = ScreenOp | LayoutOp;
