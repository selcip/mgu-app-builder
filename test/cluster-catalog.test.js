'use strict';
// Seam 1 for the cluster widget catalog (designer/src/cluster-catalog.ts) against the vendored engine, as
// widget-catalog.test.js does for the kit. Fails when the engine adds or changes a widget type, a required option,
// a font, an icon or a text token the catalog does not know, or when the catalog offers what the engine refuses.
//
// Widget types the engine has and the Designer does not offer: the calibration probes (grid, gridlabels, swatch,
// swatchimg), the plain box, and the whole-theme backdrop shaders of M and Sport (mdash, mtach, sdash; ticket 12 opens
// them as locked elements). A new engine type must be offered or added to this list on purpose.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const NOT_OFFERED = ['box', 'grid', 'gridlabels', 'swatch', 'swatchimg', 'mdash', 'mtach', 'sdash'];
const engineSource = (f) => fs.readFileSync(path.join(ROOT, 'engine', 'shared', f), 'utf8');

let C, checks, engineModule;
before(async () => {
    C = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'cluster-catalog.ts')).href);
    engineModule = require(path.join(ROOT, 'cluster', 'node.js'));
    checks = require(path.join(ROOT, 'cluster', 'checks.js'));
});

/**
 * layouts.js's types and the options each requires. The required options are probed through the engine's own validator
 * (checks.problem: add what it says a widget "needs" until it accepts it), so the layout of the source does not matter.
 * Only the list of type names is read from the source (the validator cannot enumerate its types): the keys of the
 * `const TYPES = {...}` table; if that moves, the failure says so.
 */
function engineTypeNames() {
    const m = /const TYPES = \{([\s\S]*?)\n\};/.exec(engineSource('layouts.js'));
    assert.ok(m, 'layouts.js no longer has "const TYPES = {...}": update engineTypeNames() in test/cluster-catalog.test.js to list the engine\'s widget types from where they are now');
    const names = Array.from(m[1].matchAll(/^\s{4}([a-z0-9_]+):/gm), (x) => x[1]);
    assert.ok(names.length > 10, 'read ' + names.length + ' widget types from layouts.js TYPES; update engineTypeNames() if its entries are written differently now');
    return names;
}
function requiredOf(type) {
    const w = { id: 'probe', type, x: 0, y: 0, w: 10, h: 10 };
    const needs = [];
    for (let i = 0; i < 20; i++) {
        const why = checks.problem(w);
        if (why === null) return needs;
        const m = /needs "([^"]+)"/.exec(why);
        assert.ok(m, `${type}: the engine refuses a bare widget for a reason this probe does not know: ${why}`);
        needs.push(m[1]);
        w[m[1]] = 1;
    }
    throw new Error(type + ' needs more than 20 options?');
}
function engineTypes() {
    const out = {};
    engineTypeNames().forEach((t) => { out[t] = requiredOf(t); });
    return out;
}

const box = { x: 0, y: 0, w: 100, h: 50 };
const widgetOf = (t, extra) => ({ id: 'a', type: t.type, ...box, ...t.start, ...extra });

test('the catalog offers exactly the engine widget types it should, with the engine\'s required options', () => {
    const types = engineTypes();
    const offered = C.CLUSTER_WIDGETS.map((w) => w.type);
    assert.deepStrictEqual(offered.slice().sort(), Object.keys(types).filter((t) => !NOT_OFFERED.includes(t)).sort(),
        'every engine type is offered or listed as not offered here, and nothing else is offered');
    for (const w of C.CLUSTER_WIDGETS) assert.deepStrictEqual(w.required.slice().sort(), types[w.type].slice().sort(), `${w.type}: required options`);
    for (const t of NOT_OFFERED) assert.ok(types[t], `${t} is still an engine type (take it off the not-offered list)`);
});

test('a new element of every widget is accepted by the engine; without a required option, or off the display, it is refused', () => {
    for (const t of C.CLUSTER_WIDGETS) {
        const w = widgetOf(t);
        assert.strictEqual(checks.problem(w), null, `${t.type}: ${checks.problem(w)}`);
        assert.ok(t.box.w <= 1920 && t.box.h <= 720, `${t.type}: its box fits the cluster`);
        for (const k of t.required) {
            assert.ok(w[k] !== undefined, `${t.type} starts with ${k}`);
            const lacking = { ...w }; delete lacking[k];
            assert.match(checks.problem(lacking), new RegExp(`needs "${k}"`), `${t.type} without ${k}`);
        }
    }
});

async function until(what, ok, ms = 8000) {
    const t0 = Date.now();
    while (!ok()) {
        if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what);
        await new Promise((r) => setTimeout(r, 25));
    }
}

test('every catalog widget draws with its defaults: the engine takes the layout and registers a layer', async () => {
    for (const t of C.CLUSTER_WIDGETS) {
        const layout = { schemaVersion: 2, name: 'cat', theme: 'gt3', widgets: [widgetOf(t, { id: 'one' })] };
        const engine = engineModule.createEngine({ layout });
        try {
            await until(`${t.type} layers`, () => engine.scene().length > 0 || engine.hud.problem);
            assert.strictEqual(engine.hud.problem, null, `${t.type}: ${engine.hud.problem}`);
            assert.ok(engine.scene().length > 0, `${t.type}: a layer is registered`);
        } finally { engine.stop(); }
    }
});

test('every option is read by the engine, and its range ends and choices are accepted', () => {
    const hud = engineSource('hud.js');
    for (const t of C.CLUSTER_WIDGETS) for (const op of C.optionsOf(t.type)) {
        assert.ok(new RegExp('\\bw\\.' + op.key + '\\b|"' + op.key + '"').test(hud), `${t.type}.${op.key} is in hud.js`);
        const probes = [];
        if (op.min !== undefined) probes.push(op.min);
        if (op.max !== undefined) probes.push(op.max);
        (op.choices || []).forEach((c) => probes.push(c));
        for (const v of probes) assert.strictEqual(checks.problem(widgetOf(t, { [op.key]: v })), null, `${t.type}.${op.key}=${v}`);
        if (op.default !== undefined && op.kind !== 'role') assert.ok(typeof op.default === (op.kind === 'boolean' ? 'boolean' : op.kind === 'int' || op.kind === 'number' ? 'number' : 'string'), `${t.type}.${op.key} default's type`);
    }
});

test('the fonts and icons the catalog lists are the engine\'s', () => {
    const dir = path.join(ROOT, 'engine', 'apps', 'cluster_themes', 'hud', 'fonts');
    const baked = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    assert.deepStrictEqual(C.CLUSTER_FONTS.slice().sort(), baked.sort());
    assert.deepStrictEqual(C.CLUSTER_ICONS.slice().sort(), checks.icons().sort());
    for (const t of C.CLUSTER_WIDGETS) if (t.start.font) assert.ok(C.CLUSTER_FONTS.includes(t.start.font), `${t.type} starts in a baked font`);
});

test('the text tokens: each resolves in the engine, and the header\'s tokens are all in the catalog', () => {
    const layout = { schemaVersion: 2, name: 'tok', theme: 'gt3', widgets: [] };
    const engine = engineModule.createEngine({ layout });
    try {
        for (const { token } of C.CLUSTER_TOKENS) assert.notStrictEqual(engine.hud._token(token), `{{${token}}}`, `{{${token}}} is a token the engine knows`);
    } finally { engine.stop(); }
    const header = /Text tokens:[\s\S]*?\*\/|Text tokens:[\s\S]*?\n \*\n/.exec(engineSource('hud.js'))[0];
    const named = new Set(C.CLUSTER_TOKENS.map((t) => t.token.split(':')[0] + (t.token.includes(':') ? ':' : '')));
    for (const m of header.matchAll(/\{\{([A-Za-z0-9:]+?)(?:<[^>]*>)?\}\}/g)) {
        const tok = m[1].split('|')[0];
        const key = tok.split(':')[0] + (tok.includes(':') ? ':' : '');
        assert.ok(named.has(key), `{{${m[1]}}} from the hud.js header is in the catalog`);
    }
});

test('the palette: every role is a colour, and a layout\'s theme picks the engine\'s palette (classic when it has none or an unknown one)', () => {
    const gt3 = checks.palette('gt3');
    const roles = gt3.map((r) => r.role);
    for (const r of ['fg', 'dim', 'bg', 'accent', 'hot']) assert.ok(roles.includes(r), `gt3 has ${r}`);
    assert.ok(!roles.includes('bar') && !roles.includes('name'), 'only colours are roles');
    assert.ok(gt3.every((r) => r.rgba.length === 4));
    assert.deepStrictEqual(checks.palette(undefined), checks.palette('classic'));
    assert.deepStrictEqual(checks.palette('nonsense'), checks.palette('classic'));
});
