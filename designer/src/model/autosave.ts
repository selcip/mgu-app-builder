// Autosave: the open design (screen file and images) kept in browser storage, so a refresh or a closed tab
// doesn't lose it. Storage sits behind DesignStore; the Designer uses IndexedDB, tests use memoryStore().
import type { ClusterLayout, Doc, ScreenFile } from './core.ts';
import { layoutDocument, layoutProblem } from './ops/layout.ts';
import { screenFileProblem } from './zip.ts';

/** What is kept: the screen file and its PNGs, as structured-cloneable data. */
export interface StoredDesign {
    /** Absent in copies kept before cluster layouts: a screen file. */
    kind?: 'screen-file' | 'cluster-layout';
    /** The screen file, or the cluster layout's file. */
    file: unknown;
    images: Record<string, Uint8Array>;
}

/** Where the autosaved copy lives. read() resolves to undefined when nothing is stored. */
export interface DesignStore {
    read(): Promise<StoredDesign | undefined>;
    write(design: StoredDesign): Promise<void>;
}

/** A store in memory, for tests. Writes keep a copy, as browser storage does. */
export function memoryStore(): DesignStore {
    let kept: StoredDesign | undefined;
    return {
        async read() { return kept && structuredClone(kept); },
        async write(design) { kept = structuredClone(design); },
    };
}

export interface Autosave {
    /** Keeps `doc` as the stored copy. Resolves to null when kept, or to a message saying why it wasn't. */
    save(doc: Doc): Promise<string | null>;
    /** The stored design, if there is one. */
    restore(): Promise<{ doc: Doc | null; problem: string | null }>;
}

function reason(err: unknown): string {
    const e = err as { name?: string; message?: string } | null;
    if (e && e.name === 'QuotaExceededError') return 'the browser’s storage is full.';
    const m = (e && e.message) || String(err);
    return /[.!?]$/.test(m) ? m : m + '.';
}

export function autosave(store: DesignStore): Autosave {
    return {
        async save(doc) {
            try {
                await store.write(doc.kind === 'cluster-layout'
                    ? { kind: 'cluster-layout', file: doc.layout, images: {} }
                    : { kind: 'screen-file', file: doc.file, images: { ...doc.images } });
                return null;
            } catch (err) {
                return `Autosave failed: ${reason(err)} Your edits are still here; download the design to keep them.`;
            }
        },
        async restore() {
            let kept: StoredDesign | undefined;
            try {
                kept = await store.read();
            } catch (err) {
                return { doc: null, problem: `The autosaved design can’t be read: ${reason(err)}` };
            }
            if (!kept) return { doc: null, problem: null };
            if (kept.kind === 'cluster-layout') {
                const bad = layoutProblem(kept.file);
                if (bad) return { doc: null, problem: `The autosaved design can’t be restored: ${bad}` };
                return { doc: layoutDocument(kept.file as ClusterLayout), problem: null };
            }
            const problem = screenFileProblem(kept.file);
            const images = kept.images;
            const imagesOk = !!images && typeof images === 'object' && Object.values(images).every((b) => b instanceof Uint8Array);
            if (problem || !imagesOk) {
                return { doc: null, problem: `The autosaved design can’t be restored: ${problem || 'its images are damaged.'}` };
            }
            return { doc: { file: kept.file as ScreenFile, images }, problem: null };
        },
    };
}
