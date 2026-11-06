// "Preview settings": the settings the open cluster layout refers to (its conditions and map cut-out), each with a switch
// (or, for a choice, a picker). Flipping one makes the engine rebuild with that setting and the canvas shows the variant.
// These are the Designer's own state: they are never saved into the layout and are not in the undo history.
import { Hint, Section, selectClass } from '@/components/designer/form';
import { Button } from '@/components/ui/button';
import { previewValue, settingsOf, type ConditionSetting } from '../../model/index.ts';
import { layoutOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

function Control({ setting, value }: { setting: ConditionSetting; value: boolean | string }) {
    const { setPreviewSetting } = useActions();
    if (setting.type === 'bool') {
        return (
            <Button variant={value ? 'default' : 'outline'} size="xs" role="switch" aria-checked={value === true} aria-label={setting.label}
                data-preview-switch={setting.key} onClick={() => setPreviewSetting(setting.key, value !== true)}>
                {value ? 'On' : 'Off'}
            </Button>
        );
    }
    return (
        <select className={selectClass + ' !w-auto max-w-40'} aria-label={setting.label} data-preview-choice={setting.key} value={String(value)}
            onChange={(e) => setPreviewSetting(setting.key, e.target.value)}>
            {setting.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

export function PreviewSettings() {
    const layout = useEditor(layoutOf);
    const picked = useEditor((s) => s.previewSettings);
    if (!layout) return null;
    const settings = settingsOf(layout);
    return (
        <Section title="Preview settings" data-preview-settings="">
            {settings.length === 0 && <Hint>This layout does not change with any setting.</Hint>}
            {settings.map((s) => (
                <div key={s.key} className="mb-1.5 flex items-center gap-2 text-xs" data-preview-setting={s.key}>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <Control setting={s} value={previewValue(s, picked)} />
                </div>
            ))}
            {settings.length > 0 && <Hint className="mt-2">Only for looking at the canvas. They are not saved in the layout.</Hint>}
        </Section>
    );
}
