// Language operations: the screen file's languages (the first is the default, the one plain texts are written in)
// and texts entered per language. A text is a plain string or a map of language code to string (model/texts.ts).
import { widget } from '../../catalog.ts';
import { EditError, elementOf, screenOf, type Draft } from '../core.ts';
import { isTextMap, languagesOf, textIn, type TextMap } from '../texts.ts';

const CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** `v` with its text in `language` set to `text`; '' in a language other than the default removes it (missing). */
function withText(v: unknown, languages: string[], language: string, text: string): string | TextMap {
    if (languages.length < 2) return text;
    const def = languages[0];
    const map: TextMap = isTextMap(v, languages) ? { ...v } : { [def]: typeof v === 'string' ? v : '' };
    if (text === '' && language !== def) delete map[language];
    else map[language] = text;
    return plainIfDefaultOnly(map, def);
}

/** A map holding the default language's text only is written as the plain string it is. */
function plainIfDefaultOnly(map: TextMap, def: string): string | TextMap {
    const keys = Object.keys(map);
    return keys.length === 1 && keys[0] === def ? map[def] : map;
}

/** Every text of the draft, to rewrite: screen titles and maps in elements' options. */
function eachText(d: Draft, f: (v: unknown) => unknown) {
    for (const s of d.file.screens) {
        if (s.title !== undefined) s.title = f(s.title);
        for (const e of s.components || []) {
            if (!e.opts) continue;
            for (const k of Object.keys(e.opts)) e.opts[k] = f(e.opts[k]);
        }
    }
}

export const languageOps = {
    /** Adds a language (a code such as `de` or `zh-CN`). The first one added is the default. */
    addLanguage(d: Draft, a: { code: string }) {
        if (typeof a.code !== 'string' || !CODE.test(a.code)) {
            throw new EditError(`"${String(a.code)}" is not a language code (such as en, de or zh-CN).`);
        }
        const langs = languagesOf(d.file);
        if (langs.includes(a.code)) throw new EditError(`The screen file already has the language ${a.code}.`);
        d.file.languages = langs.concat([a.code]);
    },

    /**
     * Removes a language and its texts. The next language becomes the default if it was the default; with one
     * language left, every text is the plain string of its text in that language.
     */
    removeLanguage(d: Draft, a: { code: string }) {
        const langs = languagesOf(d.file);
        if (!langs.includes(a.code)) throw new EditError(`The screen file has no language ${a.code}.`);
        const left = langs.filter((l) => l !== a.code);
        eachText(d, (v) => {
            if (!isTextMap(v, langs)) return v;
            if (!left.length) return textIn(v, langs, a.code);
            const map: TextMap = { ...v };
            delete map[a.code];
            if (left.length < 2) return textIn(map, left, left[0]);
            return plainIfDefaultOnly(map, left[0]);
        });
        if (left.length) d.file.languages = left;
        else delete d.file.languages;
    },

    /**
     * Sets a text in one language: an element's text option (`element`, `key`) or, without `element`, the screen's
     * title. `language` defaults to the default language; a file with one language or none keeps plain strings.
     */
    setText(d: Draft, a: { screen: string; element?: string; key?: string; language?: string; value: string }) {
        const langs = languagesOf(d.file);
        const language = a.language === undefined ? langs[0] : a.language;
        if (language !== undefined && !langs.includes(language)) throw new EditError(`The screen file has no language ${language}.`);
        if (typeof a.value !== 'string') throw new EditError('A text must be text.');
        const s = screenOf(d, a.screen);
        if (a.element === undefined) {
            s.title = withText(s.title, langs, language as string, a.value);
            return;
        }
        const e = elementOf(s, a.element);
        const wd = widget(e.gpu);
        const o = wd && wd.options.find((x) => x.key === a.key);
        if (!o) throw new EditError(`Element "${e.name}" has no option "${String(a.key)}".`);
        if (o.kind !== 'text') throw new EditError(`${o.label} (${o.key}) is not a text.`);
        if (!e.opts) e.opts = {};
        e.opts[o.key] = withText(o.key in e.opts ? e.opts[o.key] : o.default, langs, language as string, a.value);
    },
};
