// "Shown when": the selected element's condition, picked from the cluster app's settings rather than typed, and the
// palettes it is limited to. Each pick is one operation (setCondition, setThemes), so one undo step, and writes the apps
// repo's exact strings ("mapWindow", "!mapWindow", "units=metric", "!clock=24h", themes: [...]).
import { Row, Section, checkboxClass, selectClass } from '@/components/designer/form';
import { CONDITION_SETTINGS, THEME_NAMES, conditionString, parseCondition, type Condition } from '../../model/index.ts';
import { useActions, useEditor } from '../../store/react.tsx';

interface Choice { value: string; label: string; condition: Condition }

/** Every condition the picker offers, in the app's setting order. */
const CHOICES: Choice[] = CONDITION_SETTINGS.flatMap((s): Choice[] => {
    if (s.type === 'bool') {
        return [false, true].map((not) => ({ condition: { setting: s.key, not }, value: conditionString({ setting: s.key, not }), label: `${s.label} is ${not ? 'off' : 'on'}` }));
    }
    return s.options!.flatMap((o) => [false, true].map((not) => ({
        condition: { setting: s.key, not, value: o.value }, value: conditionString({ setting: s.key, not, value: o.value }),
        label: `${s.label} ${not ? 'is not' : 'is'} ${o.label}`,
    })));
});

export function ElementCondition({ name }: { name: string }) {
    const { edit } = useActions();
    const widget = useEditor((s) => {
        const l = s.history.present.kind === 'cluster-layout' ? s.history.present.layout : null;
        return l ? (l.widgets.find((w) => !!w && typeof w === 'object' && (w as { id?: unknown }).id === name) as Record<string, unknown> | undefined) : undefined;
    });
    if (!widget) return null;
    const toggle = typeof widget.toggle === 'string' ? widget.toggle : '';
    const themes = Array.isArray(widget.themes) ? widget.themes.map(String) : [];
    const known = !toggle || CHOICES.some((c) => c.value === toggle);
    // palettes the file names that this build does not know stay listed (and ticked) so they are kept, and can be unticked
    const extra = themes.filter((t) => !THEME_NAMES.includes(t));
    const setThemes = (next: string[]) => edit({ type: 'setThemes', elements: [name], themes: [...THEME_NAMES.filter((t) => next.includes(t)), ...extra.filter((t) => next.includes(t))] });
    return (
        <Section title="Shown when" data-element-condition={name}>
            <Row label="Condition">
                <select className={selectClass} aria-label="Shown when" data-condition-picker="" value={toggle}
                    onChange={(e) => {
                        const c = CHOICES.find((x) => x.value === e.target.value);
                        edit({ type: 'setCondition', elements: [name], condition: c ? c.condition : null });
                    }}>
                    <option value="">Always</option>
                    {!known && <option value={toggle}>{toggle} (not a setting the Designer knows)</option>}
                    {CONDITION_SETTINGS.map((s) => (
                        <optgroup key={s.key} label={s.label}>
                            {CHOICES.filter((c) => c.condition.setting === s.key).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </optgroup>
                    ))}
                </select>
            </Row>
            <fieldset className="m-0 border-0 p-0" data-condition-themes="" aria-label="Palettes">
                <legend className="mb-1 p-0 text-xs text-muted-foreground">Only in these palettes{themes.length === 0 ? ' (all)' : ''}</legend>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {[...THEME_NAMES, ...extra].map((t) => (
                        <label key={t} className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" className={checkboxClass} data-condition-theme={t} checked={themes.includes(t)}
                                onChange={(e) => setThemes(e.target.checked ? [...themes, t] : themes.filter((x) => x !== t))} />
                            {t}
                        </label>
                    ))}
                </div>
            </fieldset>
        </Section>
    );
}
