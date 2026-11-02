// Reads an uploaded design zip: screens.json at the root (or inside one top folder) and its PNGs under images/.
import { unzipSync, strFromU8 } from 'fflate';
import type { ScreenFile } from './screenFile';

export interface Design {
    file: ScreenFile;
    images: Record<string, Uint8Array>;   // 'images/x.png' -> bytes
}

export function readDesignZip(bytes: Uint8Array): Design {
    let entries: Record<string, Uint8Array>;
    try { entries = unzipSync(bytes); } catch { throw new Error('Not a zip file.'); }
    const at = Object.keys(entries).find((p) => /^([^/]+\/)?screens\.json$/.test(p));
    if (!at) throw new Error('The zip has no screens.json at its root.');
    const base = at.slice(0, at.length - 'screens.json'.length);
    let file: ScreenFile;
    try { file = JSON.parse(strFromU8(entries[at])); } catch (e) { throw new Error(`screens.json is not JSON: ${(e as Error).message}`); }
    if (!file || !Array.isArray(file.screens) || !file.screens.length) throw new Error('screens.json has no screens.');
    const images: Record<string, Uint8Array> = {};
    for (const p of Object.keys(entries)) {
        const rel = p.slice(base.length);
        if (p.startsWith(base) && /^images\/.+\.png$/i.test(rel)) images[rel] = entries[p];
    }
    return { file, images };
}
