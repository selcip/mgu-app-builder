// Conditions on a cluster layout's elements: when a widget is shown. "toggle" (a setting is on, off, or a choice has / does
// not have a value) and "themes" (only in those palettes), written as the apps repo reads them (engine/shared/hud.js).
import { EditError, type ClusterLayout } from '../core.ts';
import { conditionString, settingByKey, THEME_NAMES, type Condition } from '../cluster-settings.ts';

interface LayoutDraft {
    layout: ClusterLayout;
}

function widgetsNamed(d: LayoutDraft, names: string[]): Record<string, unknown>[] {
    return (names || []).map((name) => {
        const w = d.layout.widgets.find((x) => !!x && typeof x === 'object' && (x as { id?: unknown }).id === name);
        if (!w) throw new EditError(`The layout has no element "${name}".`);
        return w as Record<string, unknown>;
    });
}

/** Why `c` is not a condition the app can evaluate, or null. */
function conditionProblem(c: Condition): string | null {
    const s = c && typeof c.setting === 'string' ? settingByKey(c.setting) : undefined;
    if (!s) return `The cluster app has no setting "${c && c.setting}" to use as a condition.`;
    if (s.type === 'bool') return c.value === undefined ? null : `"${s.key}" is on or off; a condition on it has no value.`;
    if (c.value === undefined) return `"${s.key}" has several values; a condition on it needs one of them.`;
    if (!s.options!.some((o) => o.value === c.value)) return `"${s.key}" has no value "${c.value}".`;
    return null;
}

export const clusterConditionOps = {
    /** Shows the named elements only while the condition holds (null: always). */
    setCondition(d: LayoutDraft, a: { screen?: string; elements: string[]; condition: Condition | null }) {
        const ws = widgetsNamed(d, a.elements);
        if (a.condition) {
            const problem = conditionProblem(a.condition);
            if (problem) throw new EditError(problem);
        }
        for (const w of ws) {
            if (a.condition) w.toggle = conditionString(a.condition);
            else delete w.toggle;
        }
    },

    /** Limits the named elements to those palettes (an empty list: every palette). */
    setThemes(d: LayoutDraft, a: { screen?: string; elements: string[]; themes: string[] }) {
        const ws = widgetsNamed(d, a.elements);
        const themes = a.themes || [];
        for (const t of themes) if (!THEME_NAMES.includes(t)) throw new EditError(`There is no palette "${t}".`);
        for (const w of ws) {
            if (themes.length) w.themes = [...themes];
            else delete w.themes;
        }
    },
};
