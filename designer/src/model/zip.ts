// The design zip: screens.json at the root (or inside one top folder) and its PNGs under images/. Upload reads and
// checks it into a document; download writes the document back. A file comes back as it went in: nothing is added
// to an unedited file, so Store screen files import and download unchanged.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SCHEMA, type Doc, type ScreenFile } from './core.ts';

/** An upload was refused: not a zip, no screens.json, not JSON or not a screen file this Designer reads. */
export class ImportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImportError';
    }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function dupe(names: string[]): string | undefined {
    return names.find((n, i) => names.indexOf(n) !== i);
}

/** Why `f` isn't a screen file this Designer can open, or null when it is one. */
export function screenFileProblem(f: unknown): string | null {
    if (!isObject(f)) return 'screens.json is not a screen file (no screens).';
    if (f.schema !== undefined && f.schema !== SCHEMA) {
        return `screens.json uses schema ${JSON.stringify(f.schema)}; this Designer reads schema ${SCHEMA} and Store screen files.`;
    }
    if (!Array.isArray(f.screens) || !f.screens.length) return 'screens.json has no screens.';
    for (const [i, s] of f.screens.entries()) {
        if (!isObject(s) || typeof s.name !== 'string' || !s.name) return `Screen ${i + 1} in screens.json has no name.`;
        if (s.components !== undefined && !Array.isArray(s.components)) return `Screen "${s.name}" has no list of elements.`;
        const els = (s.components || []) as unknown[];
        for (const [j, e] of els.entries()) {
            if (!isObject(e) || typeof e.name !== 'string' || typeof e.gpu !== 'string') {
                return `Element ${j + 1} on screen "${s.name}" needs a name and a widget (gpu).`;
            }
        }
        const twice = dupe(els.map((e) => (e as { name: string }).name));
        if (twice !== undefined) return `Screen "${s.name}" names element "${twice}" more than once.`;
    }
    const twice = dupe(f.screens.map((s: { name: string }) => s.name));
    if (twice !== undefined) return `screens.json names screen "${twice}" more than once.`;
    if (f.first !== undefined && !f.screens.some((s: { name: string }) => s.name === f.first)) {
        return `The first screen "${String(f.first)}" is not in screens.json.`;
    }
    return null;
}

/** Reads a parsed screen file into a document (no images), refusing it with ImportError when it isn't valid. */
export function importScreenFile(f: unknown, images: Record<string, Uint8Array> = {}): Doc {
    const problem = screenFileProblem(f);
    if (problem) throw new ImportError(problem);
    return { file: f as ScreenFile, images };
}

export function importZip(bytes: Uint8Array): Doc {
    let entries: Record<string, Uint8Array>;
    try { entries = unzipSync(bytes); } catch { throw new ImportError('Not a zip file.'); }
    const at = Object.keys(entries).find((p) => /^([^/]+\/)?screens\.json$/.test(p));
    if (!at) throw new ImportError('The zip has no screens.json at its root.');
    const base = at.slice(0, at.length - 'screens.json'.length);
    let file: unknown;
    try { file = JSON.parse(strFromU8(entries[at])); } catch (e) { throw new ImportError(`screens.json is not JSON: ${(e as Error).message}`); }
    const images: Record<string, Uint8Array> = {};
    for (const p of Object.keys(entries).sort()) {
        const rel = p.slice(base.length);
        if (p.startsWith(base) && /^images\/.+\.png$/i.test(rel)) images[rel] = entries[p];
    }
    return importScreenFile(file, images);
}

// a fixed date, so the same design always downloads as the same bytes
const MTIME = new Date(2020, 0, 1);

export function exportZip(doc: Doc): Uint8Array {
    const files: Record<string, Uint8Array> = { 'screens.json': strToU8(JSON.stringify(doc.file, null, 2) + '\n') };
    for (const p of Object.keys(doc.images).sort()) files[p] = doc.images[p];
    return zipSync(files, { mtime: MTIME });
}
