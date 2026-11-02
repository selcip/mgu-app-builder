// The property panel: exactly the selected element's widget options, from the widget catalog, each with the input
// its kind needs. Every change goes to the document model as a setOption operation.
import { useEffect, useState, type ReactNode } from 'react';
import { COLOURS, ICONS, widget, type WidgetOption } from './catalog.ts';
import type { Element } from './model/index.ts';

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

interface Props {
    element: Element;
    onRename(name: string): void;
    onDelete(): void;
    onOption(key: string, value: unknown): void;
    /** The input for a text option (languages); a plain text input when not given. */
    renderText?(option: WidgetOption, value: unknown): ReactNode;
}

export function PropertyPanel({ element, onRename, onDelete, onOption, renderText }: Props) {
    const wd = widget(element.gpu);
    const opts = element.opts || {};
    return (
        <div className="properties" data-properties={element.gpu}>
            <h2>{wd ? wd.label : element.gpu}</h2>
            <label>Name <CommitInput value={element.name} onCommit={onRename} /></label>
            <button onClick={onDelete}>Delete element</button>
            {!wd && <p className="hint">The kit can’t draw a “{element.gpu}”; its options can’t be edited here.</p>}
            {wd && wd.options.map((o) => (
                <div className="option" key={o.key} data-option={o.key}>
                    <label>
                        <span>{o.label}</span>
                        {o.kind === 'text' && renderText
                            ? renderText(o, o.key in opts ? opts[o.key] : o.default)
                            : <OptionInput option={o} value={o.key in opts ? opts[o.key] : o.default} onChange={(v) => onOption(o.key, v)} />}
                    </label>
                </div>
            ))}
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
            return (
                <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
                    <option value="">(none)</option>
                    {ICONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
            );
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
