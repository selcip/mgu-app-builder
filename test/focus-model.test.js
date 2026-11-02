'use strict';
// Seam 2 (document model -> screen file) for focus order and actions: the operations the Designer's focus panel and
// action field apply, and the screen file they write (`focus` per screen, `onTap: 'event:<action>'` per element).
// Also holds the Designer's numbered focus order to what the runtime does with the same screen (seam 1), and the
// runtime's list of widgets that take focus to the widget catalog.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const runtimeFocus = require(path.join(ROOT, 'runtime', 'mgu_focus.js'));
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'focus.json'), 'utf8'));

let M, catalog;
before(async () => {
    M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
    catalog = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'catalog.ts')).href);
});

const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const main = (d) => d.file.screens.find((s) => s.name === 'main');
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));
const fixtureDoc = () => ({ file: JSON.parse(JSON.stringify(FIXTURE)), images: {} });

// main: a text, a switch at the top right, a button below it, a slider at the top left
function laidOut() {
    return edit([
        { type: 'addElement', screen: 'main', widget: 'text', name: 'title', x: 40, y: 20 },
        { type: 'addElement', screen: 'main', widget: 'toggle', name: 'lights', x: 1500, y: 120 },
        { type: 'addElement', screen: 'main', widget: 'button', name: 'save', x: 1200, y: 400 },
        { type: 'addElement', screen: 'main', widget: 'slider', name: 'volume', x: 40, y: 125 },
    ]);
}

test('the focus order is reading order over the widgets that take focus until the app author changes it', () => {
    const d = laidOut();
    assert.deepStrictEqual(M.focusOrderOf(main(d)), ['volume', 'lights', 'save']);
    assert.strictEqual(main(d).focus, undefined, 'nothing written to the file');
});

test('moving an element in the focus order writes the whole order to the screen file', () => {
    let d = M.apply(laidOut(), { type: 'moveInFocus', screen: 'main', element: 'save', to: 0 });
    assert.deepStrictEqual(main(d).focus, ['save', 'volume', 'lights']);
    d = M.apply(d, { type: 'moveInFocus', screen: 'main', element: 'save', to: 2 });
    assert.deepStrictEqual(M.focusOrderOf(main(d)), ['volume', 'lights', 'save']);
    refused(() => M.apply(d, { type: 'moveInFocus', screen: 'main', element: 'title', to: 0 }), /not in the focus order/);
    refused(() => M.apply(d, { type: 'moveInFocus', screen: 'main', element: 'save', to: 3 }), /position/);
});

test('elements are left out of the focus order and taken back in, at the end', () => {
    let d = M.apply(laidOut(), { type: 'excludeFromFocus', screen: 'main', element: 'lights' });
    assert.deepStrictEqual(main(d).focus, ['volume', 'save']);
    d = edit([{ type: 'includeInFocus', screen: 'main', element: 'title' }, { type: 'includeInFocus', screen: 'main', element: 'lights' }], d);
    assert.deepStrictEqual(main(d).focus, ['volume', 'save', 'title', 'lights']);
    refused(() => M.apply(d, { type: 'includeInFocus', screen: 'main', element: 'save' }), /already/);
    refused(() => M.apply(d, { type: 'excludeFromFocus', screen: 'main', element: 'nope' }), /no element/);
});

test('the whole order is set at once, and reset back to reading order', () => {
    let d = M.apply(laidOut(), { type: 'setFocusOrder', screen: 'main', order: ['lights', 'title'] });
    assert.deepStrictEqual(main(d).focus, ['lights', 'title']);
    refused(() => M.apply(d, { type: 'setFocusOrder', screen: 'main', order: ['lights', 'lights'] }), /twice/);
    refused(() => M.apply(d, { type: 'setFocusOrder', screen: 'main', order: ['ghost'] }), /no element/);
    d = M.apply(d, { type: 'resetFocusOrder', screen: 'main' });
    assert.strictEqual(main(d).focus, undefined);
    assert.deepStrictEqual(M.focusOrderOf(main(d)), ['volume', 'lights', 'save']);
});

test('with an explicit order, a new element that takes focus joins it at the end; one that does not stays out', () => {
    let d = M.apply(laidOut(), { type: 'excludeFromFocus', screen: 'main', element: 'lights' });
    d = edit([{ type: 'addElement', screen: 'main', widget: 'row', name: 'wifi' }, { type: 'addElement', screen: 'main', widget: 'rect' }], d);
    assert.deepStrictEqual(main(d).focus, ['volume', 'save', 'wifi']);
});

test('an element’s action is its name until the app author names another, which several elements may share', () => {
    let d = laidOut();
    assert.strictEqual(M.actionOf(main(d).components.find((c) => c.name === 'save')), 'save');
    d = edit([{ type: 'setAction', screen: 'main', element: 'save', action: 'store' },
        { type: 'setAction', screen: 'main', element: 'volume', action: 'store' }], d);
    const el = (n) => main(d).components.find((c) => c.name === n);
    assert.strictEqual(el('save').onTap, 'event:store', 'written as the Store writes it');
    assert.strictEqual(M.actionOf(el('volume')), 'store');
    // back to the name: nothing written
    d = edit([{ type: 'setAction', screen: 'main', element: 'save', action: 'save' }, { type: 'setAction', screen: 'main', element: 'volume', action: '' }], d);
    assert.strictEqual(el('save').onTap, undefined);
    assert.strictEqual(el('volume').onTap, undefined);
    refused(() => M.apply(d, { type: 'setAction', screen: 'main', element: 'save', action: ' x' }), /spaces/);
});

test('focus and action edits undo and redo', () => {
    let h = M.createHistory(laidOut());
    h = M.dispatch(h, { type: 'excludeFromFocus', screen: 'main', element: 'save' });
    h = M.dispatch(h, { type: 'setAction', screen: 'main', element: 'volume', action: 'loud' });
    h = M.undo(M.undo(h));
    assert.strictEqual(main(h.present).focus, undefined);
    h = M.redo(h);
    assert.deepStrictEqual(main(h.present).focus, ['volume', 'lights']);
});

test('the Designer numbers the focus order as the runtime moves through it', () => {
    const screens = FIXTURE.screens.concat(laidOut().file.screens);
    // and a crowded screen of every widget in a grid, some rows shifted a little
    const crowd = { name: 'crowd', components: [] };
    catalog.WIDGETS.forEach((w, i) => crowd.components.push({ name: 'e' + i, gpu: w.type, x: (i % 6) * 290 + (i % 3) * 7,
        y: Math.floor(i / 6) * 100 + (i % 4) * 9, w: 250, h: 40 + (i % 5) * 20, opts: i % 7 === 3 ? { hidden: true } : {} }));
    screens.push(crowd);
    for (const s of screens) {
        assert.deepStrictEqual(M.focusOrderOf(s), runtimeFocus.focusOrder(s).map((c) => c.name), s.name);
        for (const c of s.components) assert.strictEqual(M.actionOf(c), runtimeFocus.actionOf(c), s.name + '.' + c.name);
    }
});

test('the runtime gives focus to exactly the widgets the catalog marks focusable', () => {
    const marked = catalog.WIDGETS.filter((w) => w.focusable).map((w) => w.type).sort();
    assert.deepStrictEqual(runtimeFocus.FOCUSABLE.slice().sort(), marked);
});

test('a screen file with focus lists and actions downloads unchanged', () => {
    const d = fixtureDoc();
    const back = M.importZip(M.exportZip(d));
    assert.deepStrictEqual(back.file, d.file);
});
