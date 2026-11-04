// The property panel: exactly the selected element's widget options, from the widget catalog, each with the input
// its kind needs. Every change goes to the document model as an operation (setOption, setText, rows, pictures).
import { Trash2 } from 'lucide-react';
import { COLOURS, widget, type WidgetOption } from '../../catalog.ts';
import { imagePathFor, rowsOf } from '../../model/index.ts';
import { IconPicker } from './IconPicker';
import { TextInput } from './Languages';
import { PictureInput } from './Pictures';
import { RowsEditor } from './RowsEditor';
import { CommitInput } from '@/components/designer/CommitInput';
import { Button } from '@/components/ui/button';
import { Hint, Row, Section, checkboxClass, selectClass } from '@/components/designer/form';
import { docOf, elementOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

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
    const valueOf = (o: WidgetOption) => (o.key in opts ? opts[o.key] : o.default);
    return (
        <Section key={element.name} title={wd ? wd.label : element.gpu} data-properties={element.gpu}
            actions={<Button variant="ghost" size="icon-xs" title="Delete element" data-delete-element=""
                onClick={() => edit({ type: 'deleteElement', ...at })}><Trash2 /></Button>}>
            <Row label="Name"><CommitInput value={element.name} onCommit={(name) => edit({ type: 'renameElement', ...at, name })} /></Row>
            {!wd && <Hint>The kit can’t draw a “{element.gpu}”; its options can’t be edited here.</Hint>}
            {wd && wd.options.map((o) => (o.kind === 'rows' && rowsOf(element) ? (
                <div className="mb-2 flex flex-col gap-1 text-xs" key={o.key} data-option={o.key}>
                    <span className="text-muted-foreground">{o.label}</span>
                    <RowsEditor element={element} onEdit={(e) => edit({ ...e, ...at })} />
                </div>
            ) : (
                <div key={o.key} data-option={o.key}>
                    <Row label={o.label}>
                        {o.kind === 'text'
                            ? <TextInput value={valueOf(o)} onCommit={(value, language) => edit({ type: 'setText', ...at, key: o.key, language, value })} />
                            : o.kind === 'image'
                            ? <PictureInput value={String(valueOf(o))} images={images}
                                onChange={(v) => edit({ type: 'setOption', ...at, key: o.key, value: v })}
                                onUpload={(n, bytes) => edit({ type: 'uploadPicture', ...at, key: o.key, path: imagePathFor(n), bytes })} />
                            : <OptionInput option={o} value={valueOf(o)} onChange={(value) => edit({ type: 'setOption', ...at, key: o.key, value })} />}
                    </Row>
                </div>
            )))}
        </Section>
    );
}

function OptionInput({ option: o, value, onChange }: { option: WidgetOption; value: unknown; onChange: (v: unknown) => void }) {
    switch (o.kind) {
        case 'boolean':
            return <span><input type="checkbox" className={checkboxClass} checked={!!value} onChange={(e) => onChange(e.target.checked)} /></span>;
        case 'number':
            return (
                <CommitInput type="number" step={o.integer ? '1' : 'any'} value={String(value)}
                    onCommit={(v) => { const n = Number(v); if (v.trim() !== '' && isFinite(n)) onChange(n); }} />
            );
        case 'choice':
            return (
                <select className={selectClass} value={String(value)} onChange={(e) => onChange(e.target.value)}>
                    {o.choices!.map((c) => <option key={c} value={c}>{c === '' ? '(none)' : c}</option>)}
                </select>
            );
        case 'icon':
            return <IconPicker value={String(value)} onChange={onChange} />;
        case 'colour':
            return <ColourInput value={String(value)} onChange={onChange} />;
        case 'rows':
            if (typeof value !== 'string') return <code className="truncate text-xs text-muted-foreground">{JSON.stringify(value)}</code>;
            return <CommitInput multiline value={value} onCommit={onChange} />;
        case 'text':
            if (typeof value !== 'string') return <code className="truncate text-xs text-muted-foreground">{JSON.stringify(value)}</code>;
            return <CommitInput value={value} onCommit={onChange} />;
        case 'image':
            return <CommitInput value={String(value)} onCommit={onChange} />;
    }
}

/** A theme colour (follows the theme), a colour of the app author's own, or the widget's own colour. */
function ColourInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const own = value.startsWith('#');
    return (
        <span className="flex min-w-0 gap-1">
            <select className={selectClass} value={own ? '#' : value} onChange={(e) => onChange(e.target.value === '#' ? '#ffffff' : e.target.value)}>
                <option value="">(widget’s own)</option>
                {COLOURS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="#">custom…</option>
            </select>
            {own && <input type="color" className="h-7 w-8 flex-none cursor-pointer rounded border border-input bg-transparent" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value)} />}
        </span>
    );
}
