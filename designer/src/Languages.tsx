// Languages in the Designer: the switcher (the language the canvas previews and the text inputs edit), adding and
// removing languages, a text input that edits the shown language, and the list of texts to look at: translations
// missing, and characters the kit's fonts can't draw (the head unit shows '?' for them).
import { useState } from 'react';
import {
    hasText, languagesOf, missingTranslations, textIn, textsOf, type ScreenFile, type TextPlace,
} from './model/index.ts';
import { fileOf, languageOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';
import { undrawable } from './preview';
import { CommitInput } from './PropertyPanel';

/** The header's language switcher, with adding and removing languages. */
export function LanguageSwitcher() {
    const file = useEditor(fileOf);
    const language = useEditor(languageOf);
    const { edit, pick: onLanguage } = useActions();
    const langs = languagesOf(file);
    const [code, setCode] = useState('');
    const add = () => {
        const c = code.trim();
        if (!c) return;
        if (edit({ type: 'addLanguage', code: c })) {
            setCode('');
            onLanguage(c);
        }
    };
    return (
        <span className="languages" data-languages="">
            {langs.length > 0 && (
                <label>
                    Language{' '}
                    <select data-language-switcher="" value={language || ''} onChange={(e) => onLanguage(e.target.value)}>
                        {langs.map((l, i) => <option key={l} value={l}>{l}{i === 0 ? ' (default)' : ''}</option>)}
                    </select>
                </label>
            )}
            {language && (
                <button title={`Remove ${language} and its texts`} onClick={() => edit({ type: 'removeLanguage', code: language })}>
                    Remove {language}
                </button>
            )}
            <input className="language-code" placeholder={langs.length ? 'de, zh-CN…' : 'texts’ language: en…'} value={code}
                size={9} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                title={langs.length ? 'A language code such as de or zh-CN' : 'The first language added is the default: the one your texts are written in'} />
            <button onClick={add}>Add language</button>
        </span>
    );
}

/**
 * A text in the shown language. A text missing in it shows the default language's as a placeholder (what the head
 * unit draws); entering one adds the translation, clearing it removes it.
 */
export function TextInput(props: { value: unknown; onCommit(text: string, language: string | undefined): void }) {
    const file = useEditor(fileOf);
    const language = useEditor(languageOf);
    const langs = languagesOf(file);
    const lang = language || '';
    const text = langs.length ? textIn(props.value, langs, lang) : typeof props.value === 'string' ? props.value : '';
    // a text without letters (°, empty) needs no translation: it is edited as the default language's
    const own = !langs.length || hasText(props.value, langs, lang) || !/\p{L}/u.test(text);
    const bad = undrawable(text, language);
    return (
        <span className="text-input" data-missing={own ? undefined : ''}>
            <CommitInput value={own ? text : ''} onCommit={(v) => props.onCommit(v, language || undefined)} placeholder={own ? undefined : text} />
            {!own && <small className="hint">Missing in {lang}: shows the default language’s text.</small>}
            {bad.length > 0 && <small className="warning">Draws {bad.join(' ')} as “?”</small>}
        </span>
    );
}

/** A text the app author should look at, and where it is. */
interface Issue {
    place: TextPlace;
    language: string | null;
    kind: 'missing' | 'undrawable';
    chars?: string[];
}

/** The texts missing a translation and the texts the kit's fonts can't draw in full. */
export function textIssues(file: ScreenFile): Issue[] {
    const langs = languagesOf(file);
    const out: Issue[] = [];
    for (const t of missingTranslations(file)) {
        for (const l of t.missing) out.push({ place: t, language: l, kind: 'missing' });
    }
    for (const t of textsOf(file)) {
        for (const l of langs.length ? langs : [null]) {
            if (l !== null && !hasText(t.value, langs, l)) continue;      // its fallback is checked in its own language
            const chars = undrawable(l === null ? String(t.value) : textIn(t.value, langs, l), l);
            if (chars.length) out.push({ place: t, language: l, kind: 'undrawable', chars });
        }
    }
    return out;
}

const where = (p: TextPlace) => p.element === undefined ? `${p.screen} › title` : `${p.screen} › ${p.element}.${p.key}`;

/** The list of texts to look at; selecting one shows its screen and element in its language. */
export function TextIssues() {
    const file = useEditor(fileOf);
    const { goTo } = useActions();
    const issues = textIssues(file);
    const missing = issues.filter((i) => i.kind === 'missing');
    const bad = issues.filter((i) => i.kind === 'undrawable');
    if (!issues.length) return null;
    const item = (i: Issue, n: number) => (
        <li key={n} data-text-issue={i.kind}>
            <button onClick={() => goTo(i.place.screen, i.place.element === undefined ? null : i.place.element, i.language)}>
                {where(i.place)}{i.language ? ` (${i.language})` : ''}
                {i.kind === 'undrawable' && <> — draws <b>{i.chars!.join(' ')}</b> as “?”</>}
            </button>
        </li>
    );
    return (
        <div className="text-issues">
            {missing.length > 0 && (
                <>
                    <h2>Missing translations ({missing.length})</h2>
                    <ul data-missing-translations="">{missing.map(item)}</ul>
                </>
            )}
            {bad.length > 0 && (
                <>
                    <h2 className="warning">Characters the head unit can’t draw ({bad.length})</h2>
                    <p className="hint">The kit’s fonts have ASCII, ° · × – — … → and, in Chinese, Chinese.</p>
                    <ul data-undrawable-texts="">{bad.map(item)}</ul>
                </>
            )}
        </div>
    );
}
