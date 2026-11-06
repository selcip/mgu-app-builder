'use strict';
// Seam 1 for adding cluster widgets and editing their options (ticket 06): the document model in Node, with the
// engine's checks registered. A layout goes in, an operation is applied, the layout comes out; refusals carry the
// engine's reason and leave the layout unchanged.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M, C;
before(async () => {
    M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
    C = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'cluster-catalog.ts')).href);
    M.setEngineChecks(require(path.join(ROOT, 'cluster', 'node.js')).checks);
});

const bytes = (name) => new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', name)));
const gt3 = () => M.openBytes(bytes('gt3.json'));
const empty = (theme) => M.openBytes(new TextEncoder().encode(JSON.stringify({ schemaVersion: 2, name: 'mine', ...(theme ? { theme } : {}), widgets: [] })));
const widget = (doc, id) => doc.layout.widgets.find((w) => w.id === id);
const refused = (doc, op, re) => assert.throws(() => M.apply(doc, op), (e) => e instanceof M.EditError && re.test(e.message));

test('every generic widget can be added to an empty layout; each gets a unique id, the catalog box and starting options', () => {
    let doc = empty('gt3');
    for (const t of C.CLUSTER_WIDGETS) doc = M.apply(doc, { type: 'addWidget', widgetType: t.type, x: 100, y: 100 });
    assert.deepStrictEqual(doc.layout.widgets.map((w) => w.type), C.CLUSTER_WIDGETS.map((t) => t.type));
    const text = doc.layout.widgets[0];
    assert.deepStrictEqual([text.id, text.x, text.y, text.w, text.h, text.font], ['text1', 100, 100, 200, 40, 'head']);
    doc = M.apply(doc, { type: 'addWidget', widgetType: 'text' });
    assert.strictEqual(doc.layout.widgets.at(-1).id, 'text2');
});

test('a widget added near the edge is kept on the cluster, and an unknown widget is refused', () => {
    const doc = M.apply(empty(), { type: 'addWidget', widgetType: 'text', x: 1900, y: 715 });
    const w = doc.layout.widgets[0];
    assert.deepStrictEqual([w.x + w.w, w.y + w.h], [1920, 720]);
    refused(doc, { type: 'addWidget', widgetType: 'mdash' }, /no cluster widget/);
});

test('adding is one undo step', () => {
    let h = M.createHistory(gt3());
    h = M.dispatch(h, { type: 'addWidget', widgetType: 'arc' });
    assert.strictEqual(h.present.layout.widgets.length, gt3().layout.widgets.length + 1);
    h = M.undo(h);
    assert.deepStrictEqual(h.present.layout, gt3().layout);
});

test('setWidgetOption sets, keeps key order, and null removes the key; the document opened is not changed', () => {
    const doc = gt3();
    const before = widget(doc, 'speed');
    const next = M.apply(doc, { type: 'setWidgetOption', element: 'speed', key: 'align', value: 'center' });
    assert.strictEqual(widget(next, 'speed').align, 'center');
    assert.strictEqual(widget(doc, 'speed'), before);
    const back = M.apply(next, { type: 'setWidgetOption', element: 'speed', key: 'align', value: null });
    assert.ok(!('align' in widget(back, 'speed')));
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'font', value: null }, /needs/);
});

test('invalid values are refused: the engine\'s own reason where it has one, the catalog\'s range or choice otherwise', () => {
    const doc = gt3();
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'conn', value: 5 }, /"conn" must be 0\.\.3 \(the connection to cluster-render\)/);
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'class', value: 'bottom' }, /unknown class "bottom"/);
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'align', value: 'middle' }, /Alignment.*left, center, right/);
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'font', value: 'comic' }, /not one of the engine’s fonts/);
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'z', value: 1.5 }, /whole number/);
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'nope', value: 1 }, /no option/);
    refused(doc, { type: 'setWidgetOption', element: 'ghost', key: 'z', value: 1 }, /no element "ghost"/);
    refused(doc, { type: 'setWidgetOption', element: 'lights', key: 'count', value: 0 }, /Lights.*at least 1/);
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'conn', value: 4 }, /0\.\.3/);
});

test('where the engine has no limit the catalog has none: z and the light count take any whole number; atext cells stop at the engine 32', () => {
    const doc = gt3();
    const z = M.apply(doc, { type: 'setWidgetOption', element: 'speed', key: 'z', value: 500 });
    assert.strictEqual(widget(z, 'speed').z, 500);
    const n = M.apply(doc, { type: 'setWidgetOption', element: 'lights', key: 'count', value: 64 });
    assert.strictEqual(widget(n, 'lights').count, 64);
    const atext = M.apply(doc, { type: 'addWidget', widgetType: 'atext' });
    const id = atext.layout.widgets[atext.layout.widgets.length - 1].id;
    refused(atext, { type: 'setWidgetOption', element: id, key: 'cells', value: 33 }, /from 1 to 32/);
});

test('a role must be in the palette of the layout\'s theme', () => {
    const doc = gt3();
    const ok = M.apply(doc, { type: 'setWidgetOption', element: 'speed', key: 'color', value: 'accent' });
    assert.strictEqual(widget(ok, 'speed').color, 'accent');
    refused(doc, { type: 'setWidgetOption', element: 'speed', key: 'color', value: 'purple' }, /not a role of this layout’s palette/);
    // classic has no accent
    const classic = M.apply(empty('classic'), { type: 'addWidget', widgetType: 'text' });
    refused(classic, { type: 'setWidgetOption', element: 'text1', key: 'color', value: 'accent' }, /not a role/);
});

test('the template of a text is edited as text; a locked backdrop refuses option edits', () => {
    const doc = gt3();
    const next = M.apply(doc, { type: 'setWidgetOption', element: 'speed', key: 'text', value: '{{rpm}} rpm' });
    assert.strictEqual(widget(next, 'speed').text, '{{rpm}} rpm');
    const m = M.openBytes(bytes('m.json'));
    const locked = m.layout.widgets.find((w) => w.type === 'mdash');
    refused(m, { type: 'setWidgetOption', element: locked.id, key: 'z', value: 1 }, /locked/);
});

test('a layout built from nothing saves, reopens equal, and the engine accepts it', () => {
    let doc = empty('gt3');
    for (const t of ['boxes', 'text', 'arc', 'lights']) doc = M.apply(doc, { type: 'addWidget', widgetType: t, x: 50, y: 50 });
    doc = M.apply(doc, { type: 'setWidgetOption', element: 'text1', key: 'text', value: '{{speed}}' });
    const text = M.exportClusterLayout(doc);
    const again = M.openBytes(new TextEncoder().encode(text));
    assert.deepStrictEqual(again.layout, doc.layout);
    assert.strictEqual(M.exportClusterLayout(again), text);
});
