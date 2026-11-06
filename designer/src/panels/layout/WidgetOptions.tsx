// The options of the selected cluster element (ticket 06): one field per option of its widget in the cluster widget
// catalog, with the engine's default as the placeholder; the role picker over the layout's palette; for text a
// template editor with a token picker, the font list and the alignment. Every change is one edit(); a refusal shows
// the engine's reason in the toolbar and the fields go back to what the layout has. The palette itself is read-only
// (PalettePanel).
import { useState } from 'react';
import { CommitInput } from '@/components/designer/CommitInput';
import { Hint, Row, Section, checkboxClass, selectClass } from '@/components/designer/form';
import { engineChecks, type ClusterLayout } from '../../model/index.ts';
import {
    CLUSTER_FONTS, CLUSTER_ICONS, CLUSTER_SIGNALS, CLUSTER_TOKENS, clusterWidget, optionsOf, type ClusterOption,
} from '../../cluster-catalog.ts';
import { layoutOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

type Widget = Record<string, unknown>;
interface Role { role: string; rgba: number[] }

/** The palette of the open layout's theme, with each role's colour. */
function usePalette(layout: ClusterLayout | null): Role[] {
    return layout ? engineChecks().palette(layout.theme) : [];
}

const css = (rgba: number[]) => `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${(rgba[3] ?? 255) / 255})`;

export function WidgetOptions({ name, widget }: { name: string; widget: Widget }) {
    const type = String(widget.type);
    const t = clusterWidget(type);
    const layout = useEditor(layoutOf);
    const palette = usePalette(layout);
    const { edit } = useActions();
    const [nonce, setNonce] = useState(0);
    if (!t) return null;
    /** Sets an option; a refusal (the engine's reason shows in the toolbar) puts the fields back to what the layout has. */
    const set = (key: string, value: unknown) => {
        if (!edit({ type: 'setWidgetOption', element: name, key, value })) setNonce((n) => n + 1);
    };
    const isText = type === 'text' || type === 'atext' || type === 'badge';
    return (
        <Section title="Options" data-widget-options={name} key={nonce}>
            {optionsOf(type).map((op) => (
                <OptionField key={op.key} op={op} value={widget[op.key]} required={t.required.includes(op.key)} roles={palette} set={set} />
            ))}
            {isText && (
                <Row label="Add a token">
                    <select className={selectClass} data-token-picker="" value=""
                        onChange={(e) => { if (e.target.value) set('text', String(widget.text ?? '') + `{{${e.target.value}}}`); }}>
                        <option value="">Choose a token…</option>
                        {CLUSTER_TOKENS.map((k) => <option key={k.token} value={k.token}>{`{{${k.token}}}  ${k.label}`}</option>)}
                    </select>
                </Row>
            )}
        </Section>
    );
}

function OptionField({ op, value, required, roles, set }: {
    op: ClusterOption; value: unknown; required: boolean; roles: Role[]; set: (key: string, value: unknown) => void;
}) {
    const isSet = value !== undefined;
    const placeholder = op.default === undefined ? '' : String(op.default);
    const range = op.min !== undefined && op.max !== undefined ? `${op.min} to ${op.max}` : '';
    const hint = [range, op.hint].filter(Boolean).join('. ');
    const none = op.default !== undefined ? `Default (${placeholder})` : 'None';
    const pick = (list: readonly string[]) => {
        const all = isSet && typeof value === 'string' && !list.includes(value) ? [...list, value] : list;
        return (
            <select className={selectClass} value={isSet ? String(value) : ''} data-option={op.key}
                onChange={(e) => set(op.key, e.target.value === '' ? null : e.target.value)}>
                {!required && <option value="">{none}</option>}
                {all.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
        );
    };
    let control;
    switch (op.kind) {
        case 'int': case 'number':
            control = (
                <CommitInput type="number" step={op.kind === 'int' ? '1' : 'any'} value={isSet ? String(value) : ''} placeholder={placeholder}
                    onCommit={(v) => set(op.key, v.trim() === '' ? null : Number(v))} />
            );
            break;
        case 'boolean':
            control = (
                <input type="checkbox" className={checkboxClass} data-option={op.key} checked={isSet ? value === true : op.default === true}
                    onChange={(e) => set(op.key, e.target.checked)} />
            );
            break;
        case 'choice': control = pick(op.choices!); break;
        case 'font': control = pick(CLUSTER_FONTS); break;
        case 'icon': control = pick(CLUSTER_ICONS); break;
        case 'signal': control = pick(CLUSTER_SIGNALS); break;
        case 'role': {
            const shown = String(isSet ? value : op.default ?? '');
            const rgba = roles.find((r) => r.role === shown)?.rgba;
            control = (
                <span className="flex items-center gap-1.5">
                    {rgba && <span data-role-swatch={shown} className="size-4 flex-none rounded border border-border" style={{ background: css(rgba) }} />}
                    <select className={selectClass} value={isSet ? String(value) : ''} data-option={op.key} data-role-picker=""
                        onChange={(e) => set(op.key, e.target.value === '' ? null : e.target.value)}>
                        <option value="">{none}</option>
                        {roles.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
                    </select>
                </span>
            );
            break;
        }
        case 'template':
            control = <CommitInput value={isSet ? String(value) : ''} onCommit={(v) => set(op.key, v)} />;
            break;
    }
    return (
        <div data-option-row={op.key}>
            <Row label={op.label}>{control}</Row>
            {hint && <Hint className="-mt-1 mb-1.5">{hint}</Hint>}
        </div>
    );
}

/** The layout's palette, read-only: each role's colour and name. Editing a palette needs the layout to carry its own (a later spec). */
export function PalettePanel() {
    const layout = useEditor(layoutOf);
    const palette = usePalette(layout);
    if (!layout) return null;
    const theme = typeof layout.theme === 'string' ? layout.theme : null;
    return (
        <Section title="Palette" data-palette="">
            <Hint className="mb-2">{theme ? `The palette this layout names, “${theme}”. Read-only.` : 'This layout names no palette, so the engine’s default is used. Read-only.'}</Hint>
            <ul className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-1 p-0 text-xs">
                {palette.map((r) => (
                    <li key={r.role} data-palette-role={r.role} className="flex min-w-0 items-center gap-1.5">
                        <span data-palette-swatch={r.role} className="size-4 flex-none rounded border border-border" style={{ background: css(r.rgba) }} />
                        <span className="truncate">{r.role}</span>
                    </li>
                ))}
            </ul>
        </Section>
    );
}
