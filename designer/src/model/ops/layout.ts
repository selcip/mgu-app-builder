// The cluster layout (ADR 0004): reading the apps repo's layout file into a document, writing it back as it is,
// and the operations that edit it. Editing the layout's widgets arrives with the cluster widget catalog.
import { EditError, type ClusterLayout, type LayoutDoc } from '../core.ts';

/** Where a layout is drawn. The file's `target` is a field from the start; only the cluster is exposed so far. */
export type Target = 'cluster' | 'hud';

export const TARGETS: readonly Target[] = ['cluster', 'hud'];
/** The targets the Designer offers: the HUD (800x480) is a later spec that needs no model change. */
export const EXPOSED_TARGETS: readonly Target[] = ['cluster'];

const SCHEMA_VERSION = 2;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Why `f` isn't a cluster layout this Designer opens, or null when it is one. */
export function layoutProblem(f: unknown): string | null {
    if (!isObject(f)) return 'This is not a cluster layout (it is not an object).';
    if (f.schemaVersion !== SCHEMA_VERSION) {
        return `This cluster layout has schemaVersion ${JSON.stringify(f.schemaVersion)}; the Designer reads schemaVersion ${SCHEMA_VERSION}.`;
    }
    if (typeof f.name !== 'string' || !f.name.trim()) return 'This cluster layout has no name.';
    if (!Array.isArray(f.widgets)) return 'This cluster layout has no widgets list.';
    if (f.target !== undefined) {
        if (!TARGETS.includes(f.target as Target)) return `This cluster layout has an unknown target ${JSON.stringify(f.target)}.`;
        if (!EXPOSED_TARGETS.includes(f.target as Target)) return `This layout is for the ${String(f.target)}; the Designer designs the cluster only for now.`;
    }
    return null;
}

/** A cluster layout as a document. The file is kept as parsed: nothing is added, so it saves as it was opened. */
export function layoutDocument(layout: ClusterLayout): LayoutDoc {
    return { kind: 'cluster-layout', layout, images: {} };
}

/** The layout's target; a file without one is for the cluster. */
export function targetOf(doc: LayoutDoc): Target {
    return (doc.layout.target as Target | undefined) || 'cluster';
}

/** The layout as a file's text: two-space indented JSON, the keys in the order the file had. */
export function exportClusterLayout(doc: LayoutDoc): string {
    return JSON.stringify(doc.layout, null, 2) + '\n';
}

/** The file name a download gets: the layout's name, minus characters a file name can't have. */
export function layoutFileName(doc: LayoutDoc): string {
    const base = doc.layout.name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
    return (base || 'layout') + '.json';
}

/** A draft of an open cluster layout, which its operations change in place. */
export interface LayoutDraft {
    layout: ClusterLayout;
}

export const layoutOps = {
    /** Names the layout. */
    renameLayout(d: LayoutDraft, a: { name: string }) {
        if (typeof a.name !== 'string' || !a.name.trim()) throw new EditError('A cluster layout needs a name.');
        if (a.name !== a.name.trim()) throw new EditError('A cluster layout name can’t start or end with spaces.');
        d.layout.name = a.name;
    },
};
