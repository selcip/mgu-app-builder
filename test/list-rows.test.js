'use strict';
// Seam 2 (document model -> screen file): the app author edits a list element's default rows, the rows it shows
// until the app's code sets others. Rows are kept in the screen file as the kit reads them: one line per row,
// fields comma separated.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const element = (doc, name) => doc.file.screens[0].components.find((c) => c.name === name);
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));

/** A document with an empty list `faults` on the main screen. */
const withList = () => edit([{ type: 'addElement', screen: 'main', widget: 'list', name: 'faults' },
    { type: 'setOption', screen: 'main', element: 'faults', key: 'items', value: '' }]);

test('rows are added to a list as lines of comma-separated fields', () => {
    const d = edit([
        { type: 'addRow', screen: 'main', element: 'faults', fields: ['3', 'Engine electronics', '0x12 · 2 active'] },
        { type: 'addRow', screen: 'main', element: 'faults', fields: ['', 'Seats'] },
    ], withList());
    assert.strictEqual(element(d, 'faults').opts.items, '3, Engine electronics, 0x12 · 2 active\n, Seats');
});

test('a row\'s fields are changed in place; a list added from the palette starts from the widget\'s default rows', () => {
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'list', name: 'faults' },
        { type: 'setRow', screen: 'main', element: 'faults', row: 1, fields: ['5', 'Body', 'stored'] }]);
    assert.strictEqual(element(d, 'faults').opts.items,
        '3, Engine electronics, 0x12 · 2 active\n5, Body, stored\n2, Dynamic stability control, 0x29 · 1 active');
});

test('rows are deleted and moved', () => {
    let d = edit(['a', 'b', 'c', 'd'].map((t) => ({ type: 'addRow', screen: 'main', element: 'faults', fields: ['', t] })), withList());
    d = edit([{ type: 'deleteRow', screen: 'main', element: 'faults', row: 1 },
        { type: 'moveRow', screen: 'main', element: 'faults', row: 2, to: 0 }], d);
    assert.strictEqual(element(d, 'faults').opts.items, ', d\n, a\n, c');
    d = edit([{ type: 'moveRow', screen: 'main', element: 'faults', row: 0, to: 2 }], d);
    assert.strictEqual(element(d, 'faults').opts.items, ', a\n, c\n, d');
});

test('row edits that the rows can\'t hold are refused, and the document is unchanged', () => {
    const d = edit([{ type: 'addRow', screen: 'main', element: 'faults', fields: ['1', 'Engine'] },
        { type: 'addElement', screen: 'main', widget: 'button', name: 'ok' }], withList());
    const at = { screen: 'main', element: 'faults' };
    refused(() => M.apply(d, { type: 'setRow', ...at, row: 1, fields: ['x'] }), /no row 2/);
    refused(() => M.apply(d, { type: 'deleteRow', ...at, row: -1 }), /no row 0/);
    refused(() => M.apply(d, { type: 'moveRow', ...at, row: 0, to: 1 }), /no row 2/);
    refused(() => M.apply(d, { type: 'addRow', ...at, fields: ['1, 2', 'Engine'] }), /comma/);
    refused(() => M.apply(d, { type: 'addRow', ...at, fields: ['1', 'Engine\nBody'] }), /line/);
    refused(() => M.apply(d, { type: 'addRow', ...at, fields: [] }), /field/);
    refused(() => M.apply(d, { type: 'setRow', ...at, row: 0, fields: ['', ' '] }), /empty/);     // a blank line is no row
    refused(() => M.apply(d, { type: 'addRow', screen: 'main', element: 'ok', fields: ['a'] }), /Button has no rows/);
    // the last field of a list row (its small line) may hold commas: the kit joins them back
    const ok = M.apply(d, { type: 'addRow', ...at, fields: ['2', 'Body', '0x40, stored'] });
    assert.strictEqual(element(ok, 'faults').opts.items, '1, Engine\n2, Body, 0x40, stored');
    assert.deepStrictEqual(M.rowsOf(element(ok, 'faults')), [['1', 'Engine'], ['2', 'Body', '0x40, stored']]);
});

test('rows the app gave as a list of objects (a Store file) are not edited row by row', () => {
    const d = edit([{ type: 'setOption', screen: 'main', element: 'faults', key: 'items', value: [{ badge: '1', title: 'Engine' }] }], withList());
    assert.strictEqual(M.rowsOf(element(d, 'faults')), null);
    refused(() => M.apply(d, { type: 'addRow', screen: 'main', element: 'faults', fields: ['2', 'Body'] }), /list of objects/);
});
