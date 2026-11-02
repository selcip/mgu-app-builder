// Texts in languages: a text (a text option or a screen's title) is a plain string or a map of language code to
// string. The screen file's `languages` lists its languages, the first being the default: a plain string is text in
// the default language, and a text missing in a language falls back to it. The same rule as the runtime's
// (runtime/mgu_text.js), which draws them.
import { widget } from '../catalog.ts';
import type { ScreenFile } from './core.ts';

export type TextMap = Record<string, string>;

export function languagesOf(file: ScreenFile): string[] {
    return Array.isArray(file.languages) ? file.languages.filter((l) => typeof l === 'string') : [];
}

/** Whether `v` is a text map of a file with `languages`: an object of strings keyed by at least one of them. */
export function isTextMap(v: unknown, languages: readonly string[]): v is TextMap {
    if (!v || typeof v !== 'object' || Array.isArray(v) || !languages.length) return false;
    const entries = Object.entries(v);
    return entries.every(([, x]) => typeof x === 'string') && entries.some(([k]) => languages.includes(k));
}

/** A text in `language`: its own, else the default language's (else the first there is), else ''. */
export function textIn(v: unknown, languages: readonly string[], language: string): string {
    if (typeof v === 'string') return v;
    if (!isTextMap(v, languages)) return '';
    if (typeof v[language] === 'string') return v[language];
    for (const l of languages) if (typeof v[l] === 'string') return v[l];
    return '';
}

/** Whether a text has its own wording in `language` (a plain string has one in the default language only). */
export function hasText(v: unknown, languages: readonly string[], language: string): boolean {
    if (typeof v === 'string') return language === languages[0] || !languages.length;
    return isTextMap(v, languages) && typeof v[language] === 'string' && v[language] !== '';
}

/** Where a text lives: a screen's title (no element), or an element's text option. */
export interface TextPlace {
    screen: string;
    element?: string;
    key: string;            // 'title' for a screen's title
    value: unknown;
}

/** Every text of the screen file the app author entered: screen titles and elements' text options, in file order. */
export function textsOf(file: ScreenFile): TextPlace[] {
    const out: TextPlace[] = [];
    for (const s of file.screens) {
        if (s.title !== undefined && s.title !== '') out.push({ screen: s.name, key: 'title', value: s.title });
        for (const e of s.components || []) {
            const wd = widget(e.gpu);
            if (!wd || !e.opts) continue;
            for (const o of wd.options) {
                if (o.kind !== 'text' || !(o.key in e.opts)) continue;
                const v = e.opts[o.key];
                if (v === '' || (typeof v !== 'string' && !isTextMap(v, languagesOf(file)))) continue;
                out.push({ screen: s.name, element: e.name, key: o.key, value: v });
            }
        }
    }
    return out;
}

const WORDS = /\p{L}/u;     // a text without letters (a unit such as °, a number) needs no translation

/**
 * The texts missing a translation, each with the languages it is missing in (shown in the default language there).
 * Texts without letters (°, %, 12) are never missing.
 */
export function missingTranslations(file: ScreenFile): (TextPlace & { missing: string[] })[] {
    const langs = languagesOf(file);
    if (langs.length < 2) return [];
    const out: (TextPlace & { missing: string[] })[] = [];
    for (const t of textsOf(file)) {
        if (typeof t.value === 'string' && !WORDS.test(t.value)) continue;
        const missing = langs.filter((l) => !hasText(t.value, langs, l));
        if (missing.length) out.push(Object.assign({}, t, { missing }));
    }
    return out;
}
