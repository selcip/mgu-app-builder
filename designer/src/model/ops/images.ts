// Image operations: the app author's PNGs, kept under images/ beside the screen file and named by that relative path
// in elements' picture options. The runtime reads them from there (mgu_pictures.js), on the head unit and in the
// preview. Also: which images the design uses (the download leaves out the rest) and which it names but lacks.
import { EditError, type Doc, type Draft, type ScreenFile } from '../core.ts';
import { elementOps } from './elements.ts';

const PATH = /^images\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/;
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX = 1024;       // the kit's largest picture, px a side (kit_record.js makeImage)

/** Where an uploaded file goes: `images/` + its file name, reduced to letters, digits, `.`, `_` and `-`. */
export function imagePathFor(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() || '';
    const stem = base.replace(/\.png$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '');
    return `images/${stem || 'image'}.png`;
}

/** Whether `v` names a picture of the design by path ('images/logo.png'), as the runtime reads it. */
export function isImagePath(v: unknown): v is string {
    return typeof v === 'string' && /^images\/.+\.png$/i.test(v);
}

function checkPng(path: string, bytes: Uint8Array) {
    if (!PATH.test(path)) throw new EditError(`An image is kept as images/<name>.png (not "${path}").`);
    if (!(bytes instanceof Uint8Array) || bytes.length < 24 || SIGNATURE.some((b, i) => bytes[i] !== b)) {
        throw new EditError(`${path} is not a PNG file.`);
    }
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const w = dv.getUint32(16), h = dv.getUint32(20);
    if (w < 1 || h < 1 || w > MAX || h > MAX) {
        throw new EditError(`${path} is ${w} × ${h} px; the head unit draws pictures up to ${MAX} × ${MAX} px.`);
    }
}

/** A picture option of an element that names an image by path. */
export interface ImageUse {
    screen: string;
    element: string;
    key: string;
    path: string;
}

/** Every element option naming an image by path, in screen and element order. */
export function imageUses(file: ScreenFile): ImageUse[] {
    const uses: ImageUse[] = [];
    for (const s of file.screens) {
        for (const e of s.components || []) {
            for (const [key, v] of Object.entries(e.opts || {})) {
                if (isImagePath(v)) uses.push({ screen: s.name, element: e.name, key, path: v });
            }
        }
    }
    return uses;
}

/** The images some element uses: what the download keeps. */
export function usedImages(doc: Doc): string[] {
    const used = new Set(imageUses(doc.file).map((u) => u.path));
    return Object.keys(doc.images).filter((p) => used.has(p)).sort();
}

/** Pictures elements name that the design doesn't have: the head unit would draw an empty frame for them. */
export function missingImages(doc: Doc): ImageUse[] {
    return imageUses(doc.file).filter((u) => !(u.path in doc.images));
}

export const imageOps = {
    /** Keeps a PNG at `path` (images/<name>.png); one already there is replaced. */
    addImage(d: Draft, a: { path: string; bytes: Uint8Array }) {
        checkPng(a.path, a.bytes);
        d.images[a.path] = a.bytes;
    },

    /** Removes an image no element uses. */
    removeImage(d: Draft, a: { path: string }) {
        if (!(a.path in d.images)) throw new EditError(`There is no image ${a.path}.`);
        const users = imageUses(d.file).filter((u) => u.path === a.path);
        if (users.length) {
            throw new EditError(`${a.path} is used by ${users.map((u) => `${u.screen} / ${u.element}`).join(', ')}.`);
        }
        delete d.images[a.path];
    },

    /** Keeps an uploaded PNG and shows it in an element's picture option: one edit. */
    uploadPicture(d: Draft, a: { screen: string; element: string; key: string; path: string; bytes: Uint8Array }) {
        imageOps.addImage(d, a);
        elementOps.setOption(d, { screen: a.screen, element: a.element, key: a.key, value: a.path });
    },
};
