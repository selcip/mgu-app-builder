// Adding cluster widgets and editing their options (ticket 06). An element is a widget of the layout's widgets[];
// the options each widget type has, with defaults and ranges, are in cluster-catalog.ts. The engine's own validator
// (cluster/checks.js, registered with engine-checks.ts) decides what it refuses and says why; the catalog adds the
// ranges and choices the Designer offers. One operation is one undo step; a refusal changes nothing.
import { EditError, uniqueName, type ClusterLayout } from '../core.ts';
import { engineChecks } from '../engine-checks.ts';
import { CLUSTER_FONTS, CLUSTER_ICONS, clusterWidget, optionsOf, type ClusterOption } from '../../cluster-catalog.ts';
import { CLUSTER } from './cluster-elements.ts';

type Widget = Record<string, unknown>;
const isWidget = (v: unknown): v is Widget => !!v && typeof v === 'object' && !Array.isArray(v);

interface LayoutDraft { layout: ClusterLayout }

const find = (d: LayoutDraft, name: string): Widget => {
    const w = d.layout.widgets.find((x) => isWidget(x) && x.id === name);
    if (!w) throw new EditError(`The layout has no element "${name}".`);
    return w as Widget;
};

const range = (op: ClusterOption) => (op.min !== undefined && op.max !== undefined ? ` from ${op.min} to ${op.max}` : op.min !== undefined ? ` of at least ${op.min}` : op.max !== undefined ? ` of at most ${op.max}` : '');

/** The value's shape and range for the option's kind, as the Designer offers it (the engine's own check comes before). */
function checkValue(d: LayoutDraft, widgetType: string, op: ClusterOption, v: unknown): void {
    const what = `${op.label}`;
    const bad = (why: string) => { throw new EditError(`${what}: ${why}`); };
    switch (op.kind) {
        case 'int':
            if (typeof v !== 'number' || !Number.isInteger(v)) bad(`must be a whole number${range(op)}.`);
            break;
        case 'number':
            if (typeof v !== 'number' || !Number.isFinite(v)) bad(`must be a number${range(op)}.`);
            break;
        case 'boolean':
            if (typeof v !== 'boolean') bad('must be on or off.');
            break;
        case 'choice':
            if (!op.choices!.includes(v as string)) bad(`must be one of ${op.choices!.join(', ')}.`);
            return;
        case 'font':
            if (!CLUSTER_FONTS.includes(v as never)) bad(`“${String(v)}” is not one of the engine’s fonts.`);
            return;
        case 'icon':
            if (!CLUSTER_ICONS.includes(v as never)) bad(`“${String(v)}” is not one of the engine’s icons.`);
            return;
        case 'role': {
            const roles = engineChecks().palette(d.layout.theme).map((r) => r.role);
            if (typeof v !== 'string' || !roles.includes(v)) bad(`“${String(v)}” is not a role of this layout’s palette (${roles.join(', ')}).`);
            return;
        }
        case 'signal':
            if (typeof v !== 'string' || !v.trim()) bad('needs the name of a signal.');
            return;
        case 'template':
            if (typeof v !== 'string') bad('must be text.');
            return;
    }
    const n = v as number;
    if ((op.min !== undefined && n < op.min) || (op.max !== undefined && n > op.max)) bad(`must be a${op.kind === 'int' ? ' whole' : ''} number${range(op)}.`);
}

export const clusterWidgetOps = {
    /** Adds a widget of `widgetType` on top, at x, y (kept on the cluster) with the catalog's box and starting options. */
    addWidget(d: LayoutDraft, a: { widgetType: string; x?: number; y?: number }) {
        const t = clusterWidget(a.widgetType);
        if (!t) throw new EditError(`The Designer has no cluster widget “${String(a.widgetType)}”.`);
        const ids = d.layout.widgets.map((w) => (isWidget(w) ? String(w.id) : ''));
        const clamp = (v: unknown, size: number, max: number) => Math.max(0, Math.min(max - size, Math.round(typeof v === 'number' && Number.isFinite(v) ? v : 0)));
        const widget: Widget = {
            id: uniqueName(t.type, ids), type: t.type,
            x: clamp(a.x, t.box.w, CLUSTER.w), y: clamp(a.y, t.box.h, CLUSTER.h), w: t.box.w, h: t.box.h,
            ...structuredClone(t.start),
        };
        const why = engineChecks().problem(widget, d.layout.target);
        if (why) throw new EditError(why);
        d.layout.widgets.push(widget);
    },

    /** Sets option `key` of the named element; `value` null puts it back to the engine's default (removes the key). */
    setWidgetOption(d: LayoutDraft, a: { element: string; key: string; value: unknown }) {
        const w = find(d, a.element);
        const type = String(w.type);
        const t = clusterWidget(type);
        if (!t) throw new EditError(`Element "${a.element}" is a ${type}, which the Designer doesn’t edit the options of.`);
        const op = optionsOf(type).find((o) => o.key === a.key);
        if (!op) throw new EditError(`A ${type} has no option “${a.key}”.`);
        if (a.value === null || a.value === undefined) {
            if (t.required.includes(a.key)) throw new EditError(`A ${type} needs “${op.label}”.`);
            delete w[a.key];
            return;
        }
        // the engine's reason first (it knows conn, class, the box…), then the Designer's ranges
        const after = { ...w, [a.key]: a.value };
        const why = engineChecks().problem(after, d.layout.target);
        if (why) throw new EditError(why);
        checkValue(d, type, op, a.value);
        w[a.key] = a.value;
    },
};
