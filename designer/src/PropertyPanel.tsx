// The property panel: exactly the selected element's widget options, from the widget catalog, each with the input
// its kind needs. Every change goes to the document model as an operation (setOption, setText, rows, pictures).
import { useEffect, useState } from 'react';
import { COLOURS, widget, type WidgetOption } from './catalog.ts';
import { imagePathFor, rowsOf } from './model/index.ts';
import { IconPicker } from './IconPicker';
import { TextInput } from './Languages';
import { PictureInput } from './Pictures';
import { RowsEditor } from './RowsEditor';
import { docOf, elementOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';

/** A text input that commits on Enter or when it loses focus (one edit, not one per keystroke). */
export function CommitInput(props: { value: string; onCommit: (v: string) => void; type?: string; step?: string; multiline?: boolean; placeholder?: string }) {
    const [v, setV] = useState(props.value);
    useEffect(() => setV(props.value), [props.value]);
    const commit = () => { if (v !== props.value) props.onCommit(v); };
    if (props.multiline) {
        return <textarea value={v} rows={5} onChange={(e) => setV(e.target.value)} onBlur={commit} />;
    }
    return (
        <input type={props.type || 'text'} step={props.step} value={v} placeholder={props.placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setV(props.value); }} />
    );
}

/** The selected element's name and options (nothing when none or several are selected). */
export function PropertyPanel() {
    const screen = useEditor((s) => s.selected);
    const element = useEditor(elementOf);
    const images = useEditor((s) => docOf(s).images);
    const { edit } = useActions();
    if (!element) return null;
    const at = { screen, element: element.name };
    const wd = widget(element.gpu);
    const opts = element.opts || {};
    return (
        <div className="properties" data-properties={element.gpu}>
            <h2>{wd ? wd.label : element.gpu}</h2>
            <label>Name <CommitInput value={element.name} onCommit={(name) => edit({ type: 'renameElement', ...at, name })} /></label>
            <button onClick={() => edit({ type: 'deleteElement', ...at })}>Delete element</button>
            {!wd && <p className="hint">The kit can’t draw a “{element.gpu}”; its options can’t be edited here.</p>}
            {wd && wd.options.map((o) => (o.kind === 'rows' && rowsOf(element) ? (
                <div className="option rows" key={o.key} data-option={o.key}>
                    <span>{o.label}</span>
                    <RowsEditor element={element} onEdit={(e) => edit({ ...e, ...at })} />
                </div>
            ) : (
                <div className="option" key={o.key} data-option={o.key}>
                    <label>
                        <span>{o.label}</span>
                        {o.kind === 'text'
                            ? <TextInput value={o.key in opts ? opts[o.key] : o.default}
                                onCommit={(value, language) => edit({ type: 'setText', ...at, key: o.key, language, value })} />
                            : o.kind === 'image'
                            ? <PictureInput value={String(o.key in opts ? opts[o.key] : o.default)} images={images}
                                onChange={(v) => edit({ type: 'setOption', ...at, key: o.key, value: v })}
                                onUpload={(n, bytes) => edit({ type: 'uploadPicture', ...at, key: o.key, path: imagePathFor(n), bytes })} />
                            : <OptionInput option={o} value={o.key in opts ? opts[o.key] : o.default}
                                onChange={(value) => edit({ type: 'setOption', ...at, key: o.key, value })} />}
                    </label>
                </div>
            )))}
        </div>
    );
}

function OptionInput({ option: o, value, onChange }: { option: WidgetOption; value: unknown; onChange: (v: unknown) => void }) {
    switch (o.kind) {
        case 'boolean':
            return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
        case 'number':
            return (
                <CommitInput type="number" step={o.integer ? '1' : 'any'} value={String(value)}
                    onCommit={(v) => { const n = Number(v); if (v.trim() !== '' && isFinite(n)) onChange(n); }} />
            );
        case 'choice':
            return (
                <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
                    {o.choices!.map((c) => <option key={c} value={c}>{c === '' ? '(none)' : c}</option>)}
                </select>
            );
        case 'icon':
            return <IconPicker value={String(value)} onChange={onChange} />;
        case 'colour':
            return <ColourInput value={String(value)} onChange={onChange} />;
        case 'rows':
            if (typeof value !== 'string') return <code className="hint">{JSON.stringify(value)}</code>;
            return <CommitInput multiline value={value} onCommit={onChange} />;
        case 'text':
            if (typeof value !== 'string') return <code className="hint">{JSON.stringify(value)}</code>;
            return <CommitInput value={value} onCommit={onChange} />;
        case 'image':
            return <CommitInput value={String(value)} onCommit={onChange} />;
    }
}

/** A theme colour (follows the theme), a colour of the app author's own, or the widget's own colour. */
function ColourInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const own = value.startsWith('#');
    return (
        <span className="colour">
            <select value={own ? '#' : value} onChange={(e) => onChange(e.target.value === '#' ? '#ffffff' : e.target.value)}>
                <option value="">(widget’s own)</option>
                {COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="#">custom…</option>
            </select>
            {own && <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} />}
        </span>
    );
}
