// Row operations: the app author edits the default rows of a list (and of the other widgets whose option is rows):
// the rows the element shows until the app's code sets others. The screen file keeps them as the kit reads them:
// one line per row, fields comma separated.
import { widget } from '../../catalog.ts';
import { EditError, elementOf, screenOf, type Draft, type Element } from '../core.ts';

/** The fields of a row, by widget (the kit's order). Only a list's last field may hold commas: the kit joins them. */
export const ROW_FIELDS: Record<string, string[]> = {
    list: ['Badge', 'Title', 'Small line'],
    navRail: ['Label', 'Icon'],
    sideNav: ['Label', 'Icon', 'Badge'],
    appGrid: ['Title', 'Small line', 'Icon', 'Colour'],
    appList: ['Title', 'Small line', 'Right', 'Icon'],
};
const LAST_TAKES_COMMAS = new Set(['list']);

function rowsOption(e: Element) {
    const wd = widget(e.gpu);
    return wd && ROW_FIELDS[e.gpu] ? wd.options.find((o) => o.kind === 'rows') : undefined;
}

/** An element's rows as lists of fields; null when it has none or holds them as a list of objects. */
export function rowsOf(e: Element): string[][] | null {
    const o = rowsOption(e);
    if (!o) return null;
    const v = e.opts && o.key in e.opts ? e.opts[o.key] : o.default;
    if (typeof v !== 'string') return null;
    const n = ROW_FIELDS[e.gpu].length;
    return v.split('\n').filter((l) => l.trim()).map((l) => {
        const f = l.split(',').map((x) => x.trim());
        return LAST_TAKES_COMMAS.has(e.gpu) && f.length > n ? [...f.slice(0, n - 1), f.slice(n - 1).join(', ')] : f;
    });
}

const join = (fields: string[]) => {
    const f = fields.slice();
    while (f.length > 1 && f[f.length - 1] === '') f.pop();
    return f.join(', ');
};

type At = { screen: string; element: string };

function rowsTarget(d: Draft, a: At) {
    const e = elementOf(screenOf(d, a.screen), a.element);
    const o = rowsOption(e);
    if (!o) throw new EditError(`A ${widget(e.gpu) ? widget(e.gpu)!.label : e.gpu} has no rows.`);
    const rows = rowsOf(e);
    if (!rows) throw new EditError(`"${e.name}" holds its rows as a list of objects; edit them in the app’s code.`);
    const row = (i: number, extra = 0) => {
        if (!Number.isInteger(i) || i < 0 || i >= rows.length + extra) throw new EditError(`"${e.name}" has no row ${i + 1}.`);
        return i;
    };
    const fields = (f: string[]) => {
        const names = ROW_FIELDS[e.gpu];
        if (!Array.isArray(f) || !f.length || f.length > names.length || !f.every((x) => typeof x === 'string')) {
            throw new EditError(`A row of "${e.name}" has 1 to ${names.length} fields: ${names.join(', ')}.`);
        }
        f.forEach((x, i) => {
            if (/[\r\n]/.test(x)) throw new EditError(`${names[i]} must fit on one line.`);
            const last = i === names.length - 1 && LAST_TAKES_COMMAS.has(e.gpu);
            if (!last && x.includes(',')) throw new EditError(`${names[i]} can’t hold a comma (commas separate a row’s fields).`);
        });
        const out = f.map((x) => x.trim());
        if (out.every((x) => !x)) throw new EditError(`A row of "${e.name}" can’t be empty.`);
        return out;
    };
    return { rows, row, fields, save: () => { e.opts = { ...e.opts, [o.key]: rows.map(join).join('\n') }; } };
}

export const rowOps = {
    /** A new row at the end of the element's rows. */
    addRow(d: Draft, a: At & { fields: string[] }) {
        const t = rowsTarget(d, a);
        t.rows.push(t.fields(a.fields));
        t.save();
    },

    /** Replaces the fields of row `row` (0 = first). */
    setRow(d: Draft, a: At & { row: number; fields: string[] }) {
        const t = rowsTarget(d, a);
        t.rows[t.row(a.row)] = t.fields(a.fields);
        t.save();
    },

    deleteRow(d: Draft, a: At & { row: number }) {
        const t = rowsTarget(d, a);
        t.rows.splice(t.row(a.row), 1);
        t.save();
    },

    /** Moves row `row` so that it becomes row `to`. */
    moveRow(d: Draft, a: At & { row: number; to: number }) {
        const t = rowsTarget(d, a);
        const [r] = t.rows.splice(t.row(a.row), 1);
        t.rows.splice(t.row(a.to, 1), 0, r);
        t.save();
    },
};
