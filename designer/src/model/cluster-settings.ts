// The cluster app's settings that a layout's conditions can refer to, and the palettes a widget can be limited to
// (engine/shared/hud.js: "toggle": "name" | "!name" | "name=value" | "!name=value", "themes": [...], "holeWhen": "name").
// Only bool and choice settings can be conditions; the settings the host decides (the layout and drive-mode choices,
// demo data) are left out. test/cluster-conditions.test.js keeps this table equal to engine/apps/cluster_themes/app.json.
import type { ClusterLayout } from './core.ts';

export interface ConditionSetting {
    key: string;
    label: string;
    type: 'bool' | 'choice';
    default: boolean | string;
    options?: { value: string; label: string }[];
}

export const CONDITION_SETTINGS: readonly ConditionSetting[] = [
    { key: 'mapWindow', label: 'Leave room for the map', type: 'bool', default: false },
    { key: 'units', label: 'Units', type: 'choice', default: 'us', options: [{ value: 'us', label: 'mph, °F, psi' }, { value: 'metric', label: 'km/h, °C, bar' }] },
    { key: 'clock', label: 'Clock', type: 'choice', default: '12h', options: [{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }] },
    { key: 'coldGuard', label: 'Cold-engine rev guard', type: 'bool', default: true },
    { key: 'showBoost', label: 'Show boost', type: 'bool', default: true },
];

/** The palettes ("themes") a widget can be limited to: the keys of engine/shared/hud_themes.js. */
export const THEME_NAMES: readonly string[] = ['classic', 'm', 'night', 'gt3', 'sportdash', 'mdash'];

export const settingByKey = (key: string): ConditionSetting | undefined => CONDITION_SETTINGS.find((s) => s.key === key);

/** A condition: the setting is on/has the value, or (not) is off/has another value. A choice always carries a value. */
export interface Condition {
    setting: string;
    not: boolean;
    value?: string;
}

const PATTERN = /^(!?)([a-zA-Z0-9_]+)(?:=([a-zA-Z0-9_]+))?$/;

/** A toggle string as a condition; null when it is not one. */
export function parseCondition(toggle: unknown): Condition | null {
    const m = typeof toggle === 'string' ? PATTERN.exec(toggle) : null;
    if (!m) return null;
    return m[3] === undefined ? { setting: m[2], not: m[1] === '!' } : { setting: m[2], not: m[1] === '!', value: m[3] };
}

/** The apps repo's string for a condition. */
export function conditionString(c: Condition): string {
    return (c.not ? '!' : '') + c.setting + (c.value === undefined ? '' : '=' + c.value);
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The settings (of those the app knows) the layout refers to, in the app's order: widget and inner-box conditions and map cut-outs. */
export function settingsOf(layout: ClusterLayout): ConditionSetting[] {
    const keys = new Set<string>();
    const note = (w: unknown) => {
        if (!isObject(w)) return;
        const c = parseCondition(w.toggle);
        if (c) keys.add(c.setting);
        if (typeof w.holeWhen === 'string') keys.add(w.holeWhen);
        if (Array.isArray(w.boxes)) w.boxes.forEach(note);
    };
    layout.widgets.forEach(note);
    return CONDITION_SETTINGS.filter((s) => keys.has(s.key));
}

/** The value a preview setting has: the one picked, else the app's default. */
export function previewValue(s: ConditionSetting, picked: Record<string, boolean | string>): boolean | string {
    return picked[s.key] ?? s.default;
}

/** Whether `value` is one the setting takes (a boolean for a bool, one of the offered values for a choice). */
export function acceptsValue(s: ConditionSetting, value: unknown): boolean {
    return s.type === 'bool' ? typeof value === 'boolean' : typeof value === 'string' && !!s.options?.some((o) => o.value === value);
}
