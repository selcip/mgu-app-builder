// Languages in the Designer: the switcher (the language the canvas previews and the text inputs edit), adding and
// removing languages, a text input that edits the shown language, and the list of texts to look at: translations
// missing, and characters the kit's fonts can't draw (the head unit shows '?' for them).
import { useState } from 'react';
import {
    hasText, languagesOf, missingTranslations, textIn, textsOf, type ScreenFile, type TextPlace,
} from '../../model/index.ts';
import { fileOf, languageOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';
import { undrawable } from '../../preview';
import { CommitInput } from '@/components/designer/CommitInput';
import { Languages, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Hint, Section, listRowClass, selectClass } from '@/components/designer/form';

/** The screen file's languages: the default (the first added) and the others; add or remove them. */
export function LanguageSwitcher() {
    const file = useEditor(fileOf);
    const language = useEditor(languageOf);
    const { edit, pick } = useActions();
    const langs = languagesOf(file);
    const [code, setCode] = useState('');
    const add = () => {
        const c = code.trim();
        if (!c) return;
        if (edit({ type: 'addLanguage', code: c })) {
            setCode('');
            pick(c);
        }
    };
    return (
        <Section title="Languages" data-languages="">
            {langs.length === 0 && <Hint className="mb-2">Texts have no language yet. The first language added is the default: the one your texts are written in.</Hint>}
            <ul className="m-0 mb-2 flex list-none flex-col gap-0.5 p-0">{langs.map((l, i) => (
                <li key={l}>
                    <div aria-current={l === language} className={listRowClass}>
                        <button className="flex-1 truncate text-left" title="Show and edit the texts in this language" onClick={() => pick(l)}>
                            {l}{i === 0 ? <span className="text-muted-foreground"> (default)</span> : ''}
                        </button>
                        <Button variant="ghost" size="icon-xs" title={`Remove ${l} and its texts`} onClick={() => edit({ type: 'removeLanguage', code: l })}><X /></Button>
                    </div>
                </li>
            ))}</ul>
            <div className="flex gap-1">
                <Input className="h-7 rounded-md px-2 text-xs md:text-xs" placeholder={langs.length ? 'de, zh-CN…' : 'en…'} value={code}
                    onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                    title="A language code such as de or zh-CN" />
                <Button variant="outline" size="sm" onClick={add}>Add</Button>
            </div>
        </Section>
    );
}

/** The language the canvas shows and the text inputs edit, for the toolbar; only when there is more than one. */
export function ShownLanguage() {
    const file = useEditor(fileOf);
    const language = useEditor(languageOf);
    const { pick } = useActions();
    const langs = languagesOf(file);
    if (langs.length < 2) return null;
    return (
        <label className="flex items-center gap-1.5 text-muted-foreground">
            <Languages className="size-3.5" aria-label="Language shown" />
            <select data-language-switcher="" className={selectClass + ' w-auto'} value={language || ''} onChange={(e) => pick(e.target.value)}>
                {langs.map((l, i) => <option key={l} value={l}>{l}{i === 0 ? ' (default)' : ''}</option>)}
            </select>
        </label>
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
        <span className="flex min-w-0 flex-col gap-0.5" data-missing={own ? undefined : ''}>
            <CommitInput value={own ? text : ''} onCommit={(v) => props.onCommit(v, language || undefined)} placeholder={own ? undefined : text}
                className={own ? undefined : 'placeholder:italic'} />
            {!own && <small className="text-[0.7rem] text-muted-foreground">Missing in {lang}: shows the default language’s text.</small>}
            {bad.length > 0 && <small className="text-[0.7rem] text-amber-400">Draws {bad.join(' ')} as “?”</small>}
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
            <button className={listRowClass + ' h-auto min-h-7 py-1' + (i.kind === 'undrawable' ? ' border-l-2 border-amber-400' : '')}
                onClick={() => goTo(i.place.screen, i.place.element === undefined ? null : i.place.element, i.language)}>
                {where(i.place)}{i.language ? ` (${i.language})` : ''}
                {i.kind === 'undrawable' && <> — draws <b>{i.chars!.join(' ')}</b> as “?”</>}
            </button>
        </li>
    );
    return (
        <>
            {missing.length > 0 && (
                <Section title={`Missing translations (${missing.length})`}>
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0" data-missing-translations="">{missing.map(item)}</ul>
                </Section>
            )}
            {bad.length > 0 && (
                <Section title={<span className="text-amber-400">Characters the head unit can’t draw ({bad.length})</span>}>
                    <Hint className="mb-1.5">The kit’s fonts have ASCII, ° · × – — … → and, in Chinese, Chinese.</Hint>
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0" data-undrawable-texts="">{bad.map(item)}</ul>
                </Section>
            )}
        </>
    );
}
