// The document model's shared ground: the screen file's shape, the document, and what every operation module uses.
// No React, no browser APIs: the model runs in Node's tests as it runs in the Designer.

/** One element: a widget placed on a screen. The file's `components` key is the legacy spelling of elements. */
export interface Element {
    name: string;
    rtype?: string;
    gpu: string;                        // the widget (catalog type)
    x: number;
    y: number;
    w: number;
    h: number;
    opts: Record<string, unknown>;
    onTap?: string;
    [key: string]: unknown;             // anything else a Store file carries, kept as it is
}

export interface Screen {
    name: string;
    kind?: string;
    title?: unknown;
    theme?: string;
    bg?: string;
    components: Element[];
    focus?: string[];                   // explicit focus order (element names); absent: reading order
    nav?: Record<string, string>;       // action name -> screen name
    [key: string]: unknown;
}

/** The screen file (ADR-0001): the Store's screen format plus schema, languages, first, focus and nav. */
export interface ScreenFile {
    schema?: number;
    languages?: string[];
    first?: string;
    design?: { w: number; h: number };
    screens: Screen[];
    [key: string]: unknown;
}

/** What the Designer has open: the screen file and its PNGs ('images/x.png' -> bytes). */
export interface Doc {
    readonly file: ScreenFile;
    readonly images: Readonly<Record<string, Uint8Array>>;
}

/** A draft of the document that an operation changes in place; apply() hands each operation a fresh copy. */
export interface Draft {
    file: ScreenFile;
    images: Record<string, Uint8Array>;
}

export const SCHEMA = 1;
export const DESIGN = { w: 1796, h: 632 };      // iDrive 7, embedded in the HMI page

/** An operation was refused (invalid name, unknown screen, ...); the document is unchanged. */
export class EditError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EditError';
    }
}

/**
 * An operation handler: checks its arguments against the draft (throwing EditError to refuse) and changes the
 * draft in place. An operation is `{ type: <handler name>, ...args }`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler<A = any> = (d: Draft, args: A) => void;

/** The operation union of a set of handlers: `{ type: 'addScreen', name?: string } | ...`. */
export type OpsOf<H extends Record<string, Handler>> = {
    [K in keyof H & string]: { type: K } & Parameters<H[K]>[1]
}[keyof H & string];

export function screenOf(d: { file: ScreenFile }, name: string): Screen {
    const s = d.file.screens.find((x) => x.name === name);
    if (!s) throw new EditError(`There is no screen "${name}".`);
    if (!s.components) s.components = [];       // a hand-written empty screen may leave its elements out
    return s;
}

export function elementOf(s: Screen, name: string): Element {
    const e = s.components.find((x) => x.name === name);
    if (!e) throw new EditError(`Screen "${s.name}" has no element "${name}".`);
    return e;
}

/** A name for something new: `base` followed by the smallest number from 1 not taken (button1, button2, ...). */
export function uniqueName(base: string, taken: Iterable<string>): string {
    const t = new Set(taken);
    for (let n = 1; ; n++) if (!t.has(base + n)) return base + n;
}

/** Checks a name given by the app author: not empty, not taken. */
export function checkName(name: unknown, taken: Iterable<string>, what: 'screen' | 'element'): string {
    const What = what === 'screen' ? 'A screen' : 'An element';
    if (typeof name !== 'string' || !name.trim()) throw new EditError(`${What} needs a name.`);
    if (name !== name.trim()) throw new EditError(`${What} name can’t start or end with spaces.`);
    for (const x of taken) {
        if (x !== name) continue;
        throw new EditError(what === 'screen' ? `A screen named "${name}" already exists.` : `This screen already has an element named "${name}".`);
    }
    return name;
}
