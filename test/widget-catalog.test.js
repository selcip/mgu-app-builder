'use strict';
// Seam 3: the widget catalog (designer/src/catalog.ts) against the vendored kit. Fails when a widget or an option
// exists in one and not the other, and draws every catalog widget with its defaults through the kit.
//
// Left out of the catalog on purpose, so the Designer never offers something the head unit can't draw:
// - Widgets the kit lists (am_elements.js ELEMENTS) but has no drawing for (am_gpu.js DRAW): record() silently
//   skips them, so they would show as nothing.
// - The `icon` widget and every option of kit kind `icon`: those are HMI icon names from an icon atlas the kit
//   doesn't ship (am_widgets.js ICONS is empty, icon() draws nothing), and a `button` with a non-empty `icon`
//   throws inside the kit. The catalog's `icon` kind is the kit's vector icons (kit kind `vicon`), which do draw.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const E = require(path.join(ROOT, 'kit', 'am_elements.js'));
const { record } = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { ICONS } = require(path.join(ROOT, 'kit', 'kit_vicons.js'));
const themes = require(path.join(ROOT, 'kit', 'kit_themes.js'));

const UNDRAWN = ['radial', 'needle', 'ring', 'bar', 'segBar', 'stat', 'readout', 'gear', 'shiftLights', 'chart',
    'table', 'tyres', 'gmeter', 'pill', 'panel', 'header', 'menuBar'];
const HMI_ICONS = ['icon'];     // draws nothing: no HMI icon atlas in the kit

// the catalog's option kind for each kit field kind (kit 'icon' fields are left out, see above)
const KIND = { text: 'text', num: 'number', int: 'number', bool: 'boolean', color: 'colour', select: 'choice',
    lines: 'rows', image: 'image', vicon: 'icon' };

const DESIGN = { w: 1796, h: 632 };
const draw = (components) => record({ bg: 'none', theme: 'm_tricolour', components },
    { textScale: 1, design: DESIGN, area: { x: 0, y: 0, w: DESIGN.w, h: DESIGN.h } });

/** Whether the kit draws anything for this widget type: with its defaults, or else with sample texts. */
function kitDraws(type) {
    const box = { x: 20, y: 20, w: 600, h: 300 };
    if (draw([Object.assign({ name: 'a', gpu: type, opts: {} }, box)]).words().length > 2) return true;
    const sample = {};
    for (const f of E.ELEMENTS[type].fields) if (f.kind === 'text') sample[f.key] = 'Sample';
    return draw([Object.assign({ name: 'a', gpu: type, opts: sample }, box)]).words().length > 2;
}

let catalog;
before(async () => { catalog = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'catalog.ts')).href); });

test('the kit has no drawing for the widgets the catalog leaves out, and draws every other one', () => {
    for (const type of Object.keys(E.ELEMENTS)) {
        const expectDrawn = !UNDRAWN.includes(type) && !HMI_ICONS.includes(type);
        assert.strictEqual(kitDraws(type), expectDrawn, `${type} ${expectDrawn ? 'should' : 'should not'} draw`);
    }
});

test('the catalog offers exactly the widgets the kit draws', () => {
    const want = Object.keys(E.ELEMENTS).filter((t) => !UNDRAWN.includes(t) && !HMI_ICONS.includes(t)).sort();
    assert.deepStrictEqual(catalog.WIDGETS.map((w) => w.type).sort(), want);
});

test("each catalog widget has exactly the kit's options, with matching kinds, defaults and choices", () => {
    for (const w of catalog.WIDGETS) {
        const fields = E.ELEMENTS[w.type].fields.filter((f) => f.kind !== 'icon');
        assert.deepStrictEqual(w.options.map((o) => o.key), fields.map((f) => f.key), `${w.type} options`);
        for (const f of fields) {
            const o = w.options.find((x) => x.key === f.key);
            const where = `${w.type}.${f.key}`;
            assert.strictEqual(o.kind, KIND[f.kind], `${where} kind`);
            assert.deepStrictEqual(o.default, f.def, `${where} default`);
            assert.strictEqual(!!o.integer, f.kind === 'int', `${where} integer`);
            if (f.kind === 'select') assert.deepStrictEqual(o.choices, f.extra, `${where} choices`);
        }
    }
});

test("colours, themes and icons are the kit's", () => {
    assert.deepStrictEqual(catalog.COLOURS, E.COLORS.filter(Boolean));
    assert.deepStrictEqual(catalog.THEMES.map((t) => t.id).sort(), themes.ids().slice().sort());
    assert.deepStrictEqual(catalog.ICONS.slice().sort(), Object.keys(ICONS).sort());
});

test('every catalog widget draws with its defaults, at its default size, without errors', () => {
    for (const w of catalog.WIDGETS) {
        assert.ok(w.size.w > 0 && w.size.w <= DESIGN.w && w.size.h >= 0 && w.size.h <= DESIGN.h, `${w.type} size`);
        const rec = draw([{ name: w.type, gpu: w.type, x: 0, y: 0, w: w.size.w, h: w.size.h, opts: catalog.defaultsOf(w.type) }]);
        assert.strictEqual(rec.errors, undefined, `${w.type}: ${rec.errors}`);
    }
});

test('each widget says whether it takes focus by default', () => {
    for (const w of catalog.WIDGETS) assert.strictEqual(typeof w.focusable, 'boolean', w.type);
    const focusable = (t) => catalog.widget(t).focusable;
    assert.ok(focusable('button') && focusable('toggle') && focusable('list') && focusable('field'));
    assert.ok(!focusable('text') && !focusable('rect') && !focusable('image'));
});
