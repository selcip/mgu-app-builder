// Option values: what each catalog option kind accepts.
import { COLOURS, ICONS, type WidgetOption } from '../catalog.ts';
import { EditError } from './core.ts';

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

const isTextMap = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)
    && Object.values(v as object).every((x) => typeof x === 'string');

/** Throws EditError unless `value` suits option `o`. */
export function checkOptionValue(o: WidgetOption, value: unknown): void {
    const bad = (what: string) => new EditError(`${o.label} (${o.key}) must be ${what}.`);
    switch (o.kind) {
        case 'text':
            if (typeof value !== 'string' && !isTextMap(value)) throw bad('text');
            return;
        case 'number':
            if (typeof value !== 'number' || !isFinite(value)) throw bad('a number');
            if (o.integer && !Number.isInteger(value)) throw bad('a whole number');
            return;
        case 'boolean':
            if (typeof value !== 'boolean') throw bad('on or off');
            return;
        case 'colour':
            if (value !== '' && !(typeof value === 'string' && (COLOURS.includes(value) || HEX.test(value)))) {
                throw bad('a theme colour or a #rrggbb colour');
            }
            return;
        case 'choice':
            if (!o.choices!.includes(value as string)) throw bad(`one of ${o.choices!.map((c) => JSON.stringify(c)).join(', ')}`);
            return;
        case 'icon':
            if (value !== '' && !ICONS.includes(value as string)) throw bad('one of the kit’s icons');
            return;
        case 'image':
            if (typeof value !== 'string') throw bad('a picture path');
            return;
        case 'rows':
            if (typeof value !== 'string' && !(Array.isArray(value) && value.every((r) => r && typeof r === 'object'))) {
                throw bad('rows (one per line, or a list of rows)');
            }
            return;
    }
}
