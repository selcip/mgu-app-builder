'use strict';
// Seam 1 for preview settings and conditions (ticket 10): the document model and the editor store in Node.
// The settings a layout refers to are collected from its widgets' conditions (toggle, holeWhen); a condition set
// from the picker is written as the apps repo's exact strings ("name", "!name", "name=value", "!name=value",
// themes: [...]); preview settings are editor state and never reach the document or the undo history.
// Expected strings and lists are worked from the four layouts and hud.js's header, not from the code under test.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M, C, S;
before(async () => {
    M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
    C = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'cluster-settings.ts')).href);
    S = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'store', 'editor.ts')).href);
});

const bytes = (name) => new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', name + '.json')));
const open = (name) => M.openBytes(bytes(name));
const widget = (doc, id) => doc.layout.widgets.find((w) => w.id === id);
const refused = (doc, op, re) => assert.throws(() => M.apply(doc, op), (e) => e instanceof M.EditError && re.test(e.message));

test('the settings a layout refers to are collected from its conditions and map-window cut-out', () => {
    const keys = (n) => C.settingsOf(open(n).layout).map((s) => s.key);
    assert.deepStrictEqual(keys('gt3'), ['mapWindow', 'showBoost']);
    assert.deepStrictEqual(keys('sport'), ['mapWindow', 'showBoost']);
    assert.deepStrictEqual(keys('m'), []);
    assert.deepStrictEqual(keys('grid'), []);
    const map = C.settingsOf(open('gt3').layout)[0];
    assert.deepStrictEqual([map.label, map.type, map.default], ['Leave room for the map', 'bool', false]);
});

test('settings are also found in a boxes widget\'s inner boxes, and a setting nobody knows is not listed', () => {
    const doc = open('grid');
    const layout = { ...doc.layout, widgets: [
        { id: 'b', type: 'boxes', x: 0, y: 0, w: 10, h: 10, boxes: [{ id: 'one', x: 0, y: 0, w: 1, h: 1, toggle: '!coldGuard' }] },
        { id: 't', type: 'text', x: 0, y: 0, w: 1, h: 1, toggle: 'units=metric' },
        { id: 'u', type: 'text', x: 0, y: 0, w: 1, h: 1, toggle: 'nonsense' },
    ] };
    assert.deepStrictEqual(C.settingsOf(layout).map((s) => s.key), ['units', 'coldGuard']);
});

test('conditions parse into on, off, value and not-value, and back into the exact strings', () => {
    assert.deepStrictEqual(C.parseCondition('mapWindow'), { setting: 'mapWindow', not: false });
    assert.deepStrictEqual(C.parseCondition('!mapWindow'), { setting: 'mapWindow', not: true });
    assert.deepStrictEqual(C.parseCondition('units=metric'), { setting: 'units', not: false, value: 'metric' });
    assert.deepStrictEqual(C.parseCondition('!clock=24h'), { setting: 'clock', not: true, value: '24h' });
    assert.strictEqual(C.parseCondition('not a condition'), null);
    for (const t of ['mapWindow', '!mapWindow', 'units=metric', '!clock=24h']) assert.strictEqual(C.conditionString(C.parseCondition(t)), t);
});

test('setCondition writes the apps repo\'s strings, one undo step each, and keeps the other keys', () => {
    const doc = open('gt3');
    const before = widget(doc, 'speed');
    const cases = [
        [{ setting: 'mapWindow', not: false }, 'mapWindow'],
        [{ setting: 'showBoost', not: true }, '!showBoost'],
        [{ setting: 'units', not: false, value: 'metric' }, 'units=metric'],
        [{ setting: 'clock', not: true, value: '12h' }, '!clock=12h'],
    ];
    for (const [condition, want] of cases) {
        const next = M.apply(doc, { type: 'setCondition', elements: ['speed'], condition });
        assert.strictEqual(widget(next, 'speed').toggle, want);
        const { toggle, ...rest } = widget(next, 'speed');
        const { toggle: was, ...restBefore } = before;
        assert.deepStrictEqual(rest, restBefore, 'nothing else changed');
        assert.strictEqual(widget(doc, 'speed'), before, 'the document opened is not changed');
    }
    const h = M.createHistory(doc);
    const h2 = M.dispatch(h, { type: 'setCondition', elements: ['speed'], condition: { setting: 'mapWindow', not: false } });
    assert.strictEqual(widget(h2.present, 'speed').toggle, 'mapWindow');
    assert.strictEqual(widget(M.undo(h2).present, 'speed').toggle, before.toggle);
});

test('a condition can be cleared, and the element keeps no toggle key after', () => {
    const doc = open('gt3');
    const hidden = doc.layout.widgets.find((w) => w.toggle === '!mapWindow');
    assert.ok(hidden);
    const next = M.apply(doc, { type: 'setCondition', elements: [hidden.id], condition: null });
    assert.strictEqual('toggle' in widget(next, hidden.id), false);
});

test('setCondition refuses a setting the app does not know, a value it does not offer, and a mismatch of kind', () => {
    const doc = open('gt3');
    refused(doc, { type: 'setCondition', elements: ['speed'], condition: { setting: 'nope', not: false } }, /nope/);
    refused(doc, { type: 'setCondition', elements: ['speed'], condition: { setting: 'units', not: false, value: 'furlongs' } }, /furlongs/);
    refused(doc, { type: 'setCondition', elements: ['speed'], condition: { setting: 'units', not: false } }, /units/);
    refused(doc, { type: 'setCondition', elements: ['speed'], condition: { setting: 'mapWindow', not: false, value: 'x' } }, /mapWindow/);
    refused(doc, { type: 'setCondition', elements: ['ghost'], condition: { setting: 'mapWindow', not: false } }, /ghost/);
});

test('setThemes limits an element to palettes (or lifts the limit), refusing a palette that does not exist', () => {
    const doc = open('gt3');
    const next = M.apply(doc, { type: 'setThemes', elements: ['speed'], themes: ['gt3', 'night'] });
    assert.deepStrictEqual(widget(next, 'speed').themes, ['gt3', 'night']);
    const none = M.apply(next, { type: 'setThemes', elements: ['speed'], themes: [] });
    assert.strictEqual('themes' in widget(none, 'speed'), false);
    refused(doc, { type: 'setThemes', elements: ['speed'], themes: ['gt3', 'neon'] }, /neon/);
    refused(doc, { type: 'setThemes', elements: ['ghost'], themes: ['gt3'] }, /ghost/);
});

test('the palettes and the settings offered equal the apps repo\'s', () => {
    const { THEMES } = require(path.join(ROOT, 'engine', 'shared', 'hud_themes.js'));
    assert.deepStrictEqual([...C.THEME_NAMES].sort(), Object.keys(THEMES).sort());
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine', 'apps', 'cluster_themes', 'app.json'), 'utf8'));
    const hostOwned = ['hudLayout', 'byMode', 'inComfort', 'inSport', 'inEco', 'demo'];
    const want = app.settings.filter((s) => (s.type === 'bool' || s.type === 'choice') && !hostOwned.includes(s.key));
    assert.deepStrictEqual(C.CONDITION_SETTINGS.map((s) => s.key), want.map((s) => s.key));
    for (const w of want) {
        const got = C.CONDITION_SETTINGS.find((s) => s.key === w.key);
        assert.deepStrictEqual([got.type, got.default], [w.type, w.default], w.key);
        if (w.type === 'choice') assert.deepStrictEqual(got.options.map((o) => o.value), w.options.map((o) => o[0]), w.key);
    }
});

test('preview settings live in the editor, survive edits and Trying, and are in neither the document nor the history', () => {
    const store = S.createEditorStore();
    store.getState().open(open('gt3'));
    const history = store.getState().history;
    const doc = history.present;
    store.getState().setPreviewSetting('mapWindow', true);
    assert.strictEqual(store.getState().previewSettings.mapWindow, true);
    assert.strictEqual(store.getState().history, history, 'history untouched');
    assert.strictEqual(store.getState().history.present, doc, 'document untouched');
    assert.ok(store.getState().edit({ type: 'renameLayout', name: 'Mine' }));
    store.getState().setTrying(true);
    store.getState().setTrying(false);
    store.getState().undo();
    assert.strictEqual(store.getState().previewSettings.mapWindow, true, 'edits, undo and Trying leave it');
    assert.strictEqual(M.exportClusterLayout(store.getState().history.present).includes('"mapWindow": true'), false);
});

test('an unknown preview setting, a wrong kind of value, or a choice value not on offer is ignored', () => {
    const store = S.createEditorStore();
    store.getState().setPreviewSetting('nope', true);
    store.getState().setPreviewSetting('mapWindow', 'yes');
    store.getState().setPreviewSetting('units', 'furlongs');
    store.getState().setPreviewSetting('units', 'metric');
    assert.deepStrictEqual(store.getState().previewSettings, { units: 'metric' });
});
