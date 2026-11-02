'use strict';
// Seam 2: the Designer's document model (designer/src/model) -> screen file. Sequences of edit operations go in;
// the screen file that comes out, the refusals, undo/redo and the zip round trip are checked.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

/** Applies ops in turn to a document (a new one when none given) and returns the result. */
function edit(ops, doc) {
    return ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
}
const screen = (doc, name) => doc.file.screens.find((s) => s.name === name);
const names = (doc) => doc.file.screens.map((s) => s.name);
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));

// --- screens

test('a new screen file has one screen, which is its first, in the default theme at the iDrive 7 size', () => {
    const { file } = M.newDocument();
    assert.strictEqual(file.schema, 1);
    assert.deepStrictEqual(file.design, { w: 1796, h: 632 });
    assert.strictEqual(file.screens.length, 1);
    assert.strictEqual(file.first, file.screens[0].name);
    assert.deepStrictEqual(file.screens[0], { name: 'main', kind: 'gpu', title: 'Main', theme: 'm_tricolour', bg: 'theme', components: [] });
});

test('screens are added with unique names, renamed, duplicated and deleted', () => {
    let d = edit([{ type: 'addScreen' }, { type: 'addScreen' }, { type: 'addScreen', name: 'about', title: 'About' }]);
    assert.deepStrictEqual(names(d), ['main', 'screen1', 'screen2', 'about']);
    assert.strictEqual(screen(d, 'about').title, 'About');
    d = edit([{ type: 'renameScreen', screen: 'screen1', name: 'settings' }, { type: 'deleteScreen', screen: 'screen2' },
        { type: 'duplicateScreen', screen: 'settings' }], d);
    assert.deepStrictEqual(names(d), ['main', 'settings', 'settings_copy', 'about']);
    assert.deepStrictEqual(screen(d, 'settings_copy'), Object.assign({}, screen(d, 'settings'), { name: 'settings_copy' }));
    d = M.apply(d, { type: 'duplicateScreen', screen: 'settings', name: 'more' });
    assert.deepStrictEqual(names(d), ['main', 'settings', 'more', 'settings_copy', 'about']);
});

test('screen names must be unique and not empty, and the last screen cannot be deleted', () => {
    const d = edit([{ type: 'addScreen', name: 'b' }]);
    refused(() => M.apply(d, { type: 'addScreen', name: 'main' }), /already/);
    refused(() => M.apply(d, { type: 'renameScreen', screen: 'b', name: 'main' }), /already/);
    refused(() => M.apply(d, { type: 'renameScreen', screen: 'b', name: ' ' }), /name/);
    refused(() => M.apply(d, { type: 'duplicateScreen', screen: 'b', name: 'main' }), /already/);
    refused(() => M.apply(d, { type: 'deleteScreen', screen: 'nope' }), /no screen/);
    refused(() => M.apply(M.newDocument(), { type: 'deleteScreen', screen: 'main' }), /last/);
});

test('the first screen is marked, follows a rename, and moves to the top screen when deleted', () => {
    let d = edit([{ type: 'addScreen', name: 'b' }, { type: 'addScreen', name: 'c' }, { type: 'setFirstScreen', screen: 'c' }]);
    assert.strictEqual(d.file.first, 'c');
    refused(() => M.apply(d, { type: 'setFirstScreen', screen: 'nope' }), /no screen/);
    d = M.apply(d, { type: 'renameScreen', screen: 'c', name: 'home' });
    assert.strictEqual(d.file.first, 'home');
    d = M.apply(d, { type: 'deleteScreen', screen: 'home' });
    assert.strictEqual(d.file.first, 'main');
});

test('each screen has its own title', () => {
    const d = edit([{ type: 'addScreen', name: 'b' }, { type: 'setScreenTitle', screen: 'b', title: 'Lights' }]);
    assert.strictEqual(screen(d, 'b').title, 'Lights');
    assert.strictEqual(screen(d, 'main').title, 'Main');
});

test('the theme is chosen once and written on every screen, including ones added later', () => {
    let d = edit([{ type: 'addScreen', name: 'b' }, { type: 'setTheme', theme: 'ice' }, { type: 'addScreen', name: 'c' }]);
    assert.deepStrictEqual(d.file.screens.map((s) => s.theme), ['ice', 'ice', 'ice']);
    assert.strictEqual(M.themeOf(d.file), 'ice');
    refused(() => M.apply(d, { type: 'setTheme', theme: 'pink' }), /theme/);
});

test('a refused operation leaves the document as it was', () => {
    const d = edit([{ type: 'addScreen', name: 'b' }]);
    const before = JSON.stringify(d.file);
    assert.throws(() => M.apply(d, { type: 'renameScreen', screen: 'b', name: 'main' }));
    assert.throws(() => M.apply(d, { type: 'noSuchOperation' }), /noSuchOperation/);
    assert.strictEqual(JSON.stringify(d.file), before);
});

// --- elements

const el = (doc, s, name) => screen(doc, s).components.find((c) => c.name === name);
const elNames = (doc, s) => screen(doc, s).components.map((c) => c.name);

test('a widget added from the palette becomes an element with a unique name, the catalog defaults and size', () => {
    const d = edit([
        { type: 'addElement', screen: 'main', widget: 'button', x: 100, y: 50 },
        { type: 'addElement', screen: 'main', widget: 'button' },
        { type: 'addElement', screen: 'main', widget: 'toggle', name: 'fog' },
        { type: 'addScreen', name: 'b' },
        { type: 'addElement', screen: 'b', widget: 'button' },
    ]);
    assert.deepStrictEqual(elNames(d, 'main'), ['button1', 'button2', 'fog']);
    assert.deepStrictEqual(elNames(d, 'b'), ['button1']);
    assert.deepStrictEqual(el(d, 'main', 'button1'), {
        name: 'button1', rtype: 'gpu', gpu: 'button', x: 100, y: 50, w: 349, h: 52,
        opts: { text: 'Apply', style: 'primary', size: 0, radius: 16, color: '' },
    });
    assert.strictEqual(M.newElementName(screen(d, 'main'), 'button'), 'button3');
});

test('an element name is unique on its screen: adding or renaming to a used name is refused', () => {
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'text' }, { type: 'addElement', screen: 'main', widget: 'rect' }]);
    refused(() => M.apply(d, { type: 'renameElement', screen: 'main', element: 'rect1', name: 'text1' }), /already/);
    refused(() => M.apply(d, { type: 'addElement', screen: 'main', widget: 'rect', name: 'text1' }), /already/);
    refused(() => M.apply(d, { type: 'renameElement', screen: 'main', element: 'rect1', name: '' }), /name/);
    refused(() => M.apply(d, { type: 'renameElement', screen: 'main', element: 'nope', name: 'x' }), /no element/);
    refused(() => M.apply(d, { type: 'addElement', screen: 'main', widget: 'radial' }), /widget/);
    refused(() => M.apply(d, { type: 'addElement', screen: 'nope', widget: 'text' }), /no screen/);
});

test('elements are renamed and deleted, and the focus order follows', () => {
    let d = edit([{ type: 'addElement', screen: 'main', widget: 'button' }, { type: 'addElement', screen: 'main', widget: 'toggle' },
        { type: 'addElement', screen: 'main', widget: 'slider' }]);
    d = { file: Object.assign({}, d.file, { screens: [Object.assign({}, d.file.screens[0], { focus: ['slider1', 'button1', 'toggle1'] })] }), images: {} };
    d = edit([{ type: 'renameElement', screen: 'main', element: 'button1', name: 'apply' }, { type: 'deleteElement', screen: 'main', element: 'toggle1' }], d);
    assert.deepStrictEqual(elNames(d, 'main'), ['apply', 'slider1']);
    assert.deepStrictEqual(screen(d, 'main').focus, ['slider1', 'apply']);
});

test('options are set with a value of the right kind, and unset back to the widget default', () => {
    const set = (element, key, value) => ({ type: 'setOption', screen: 'main', element, key, value });
    let d = edit([{ type: 'addElement', screen: 'main', widget: 'slider' }, { type: 'addElement', screen: 'main', widget: 'list' },
        { type: 'addElement', screen: 'main', widget: 'vbutton' }]);
    d = edit([set('slider1', 'value', 70), set('slider1', 'color', 'warn'), set('slider1', 'unit', '°C'), set('slider1', 'showValue', false),
        set('vbutton1', 'style', 'round'), set('vbutton1', 'vicon', 'gear'), set('vbutton1', 'color', '#ff0000'),
        set('list1', 'items', 'A, First\nB, Second'), set('slider1', 'decimals', undefined)], d);
    assert.deepStrictEqual(el(d, 'main', 'slider1').opts, { min: 0, max: 100, value: 70, unit: '°C', showValue: false, color: 'warn' });
    assert.deepStrictEqual(el(d, 'main', 'vbutton1').opts, { text: 'Install', vicon: 'gear', style: 'round', color: '#ff0000', disabled: false, size: 0 });
    assert.strictEqual(el(d, 'main', 'list1').opts.items, 'A, First\nB, Second');
    d = M.apply(d, set('list1', 'items', [{ title: 'A' }]));
    assert.deepStrictEqual(el(d, 'main', 'list1').opts.items, [{ title: 'A' }]);

    refused(() => M.apply(d, set('slider1', 'value', '70')), /number/);
    refused(() => M.apply(d, set('slider1', 'decimals', 1.5)), /whole/);
    refused(() => M.apply(d, set('slider1', 'showValue', 'yes')), /on or off/);
    refused(() => M.apply(d, set('slider1', 'color', 'pink')), /colour/);
    refused(() => M.apply(d, set('vbutton1', 'style', 'huge')), /one of/);
    refused(() => M.apply(d, set('vbutton1', 'vicon', 'Settings')), /icon/);
    refused(() => M.apply(d, set('vbutton1', 'text', 3)), /text/);
    refused(() => M.apply(d, set('vbutton1', 'nope', 1)), /no option/);
});

test('options set in the Designer are what the kit draws', () => {
    const { record } = require(path.join(ROOT, 'kit', 'am_gpu.js'));
    const words = (s) => Buffer.from(Uint32Array.from(record(s, { textScale: 1, design: { w: 1796, h: 632 }, area: { x: 0, y: 0, w: 1796, h: 632 } }).words()).buffer);
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'text', x: 40, y: 40 },
        { type: 'setOption', screen: 'main', element: 'text1', key: 'text', value: 'Lights' },
        { type: 'setOption', screen: 'main', element: 'text1', key: 'color', value: 'accent' }]);
    const byHand = { name: 'main', theme: 'm_tricolour', bg: 'theme',
        components: [{ name: 't', gpu: 'text', x: 40, y: 40, w: 374, h: 60, opts: { text: 'Lights', color: 'accent' } }] };
    assert.ok(words(screen(d, 'main')).equals(words(byHand)));
    assert.ok(!words(screen(edit([{ type: 'addElement', screen: 'main', widget: 'text', x: 40, y: 40 }]), 'main')).equals(words(byHand)));
});

// --- undo and redo

test('every operation can be undone and redone; a new edit after undo drops the redo', () => {
    let h = M.createHistory(M.newDocument());
    const start = h.present.file;
    assert.ok(!M.canUndo(h) && !M.canRedo(h));
    h = M.dispatch(h, { type: 'addScreen', name: 'b' });
    h = M.dispatch(h, { type: 'addElement', screen: 'b', widget: 'text' });
    const two = h.present.file;
    h = M.undo(M.undo(h));
    assert.deepStrictEqual(h.present.file, start);
    assert.ok(!M.canUndo(h) && M.canRedo(h));
    h = M.redo(M.redo(h));
    assert.deepStrictEqual(h.present.file, two);
    h = M.dispatch(M.undo(h), { type: 'setTheme', theme: 'amber' });
    assert.ok(!M.canRedo(h));
    assert.deepStrictEqual(names(h.present), ['main', 'b']);
    assert.strictEqual(screen(h.present, 'b').components.length, 0);
    assert.strictEqual(M.undo(M.createHistory(M.newDocument())).present.file.screens.length, 1, 'nothing to undo: unchanged');
});

test('a refused operation adds nothing to the history', () => {
    const h = M.dispatch(M.createHistory(M.newDocument()), { type: 'addScreen', name: 'b' });
    assert.throws(() => M.dispatch(h, { type: 'addScreen', name: 'b' }), M.EditError);
    assert.deepStrictEqual(names(M.undo(h).present), ['main']);
});

// --- zip

const { zipSync, unzipSync, strToU8, strFromU8 } = require(require.resolve('fflate', { paths: [path.join(ROOT, 'designer')] }));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const zipOf = (entries) => zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])));

test('download gives a zip with screens.json at the root and the PNGs under images/', () => {
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'image' }], M.importZip(zipOf({
        'screens.json': JSON.stringify(M.newDocument().file), 'images/logo.png': PNG,
    })));
    const entries = unzipSync(M.exportZip(d));
    assert.deepStrictEqual(Object.keys(entries).sort(), ['images/logo.png', 'screens.json']);
    assert.deepStrictEqual(JSON.parse(strFromU8(entries['screens.json'])), d.file);
    assert.deepStrictEqual(entries['images/logo.png'], PNG);
});

test('uploading then downloading a design gives the same design', () => {
    const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'two-screens.json'), 'utf8'));
    const d = M.importZip(zipOf({ 'my-app/screens.json': JSON.stringify(file), 'my-app/images/a.png': PNG, 'my-app/notes.txt': 'x' }));
    assert.deepStrictEqual(d.file, file);
    assert.deepStrictEqual(Object.keys(d.images), ['images/a.png']);
    const again = M.importZip(M.exportZip(d));
    assert.deepStrictEqual(again, d);
    assert.deepStrictEqual(M.exportZip(again), M.exportZip(d), 'the download is the same bytes every time');
});

test('a Store screen file imports unchanged and downloads unchanged', () => {
    const { compact } = require(path.join(__dirname, 'fixtures', 'mgu-store', 'store_compact.js'));
    const store = JSON.parse(JSON.stringify(compact(1796, 632)));
    const d = M.importZip(zipOf({ 'screens.json': JSON.stringify(store) }));
    assert.deepStrictEqual(d.file, store);
    assert.deepStrictEqual(JSON.parse(strFromU8(unzipSync(M.exportZip(d))['screens.json'])), store);
    // and it can be edited: Store-only options stay as they are
    const e = M.apply(d, { type: 'setOption', screen: 'store', element: 'nav', key: 'sel', value: 2 });
    assert.deepStrictEqual(screen(e, 'store').components[0].opts, Object.assign({}, store.screens[0].components[0].opts, { sel: 2 }));
});

test('an upload that is not a valid screen file is refused with a clear reason', () => {
    const bad = (bytes, re) => assert.throws(() => M.importZip(bytes), (e) => e instanceof M.ImportError && re.test(e.message));
    const one = (file) => zipOf({ 'screens.json': JSON.stringify(file) });
    bad(strToU8('hello'), /not a zip/i);
    bad(zipOf({ 'other.json': '{}' }), /no screens\.json/);
    bad(zipOf({ 'screens.json': '{ nope' }), /not JSON/);
    bad(one({ schema: 2, screens: [{ name: 'a', components: [] }] }), /schema 2/);
    bad(one({ screens: [] }), /no screens/);
    bad(one({ screens: [{ name: 'a', components: [] }, { name: 'a', components: [] }] }), /"a".*more than once/);
    bad(one({ screens: [{ name: 'a', components: [{ name: 'x', gpu: 'text' }, { name: 'x', gpu: 'rect' }] }] }), /"x".*more than once/);
    bad(one({ first: 'b', screens: [{ name: 'a', components: [] }] }), /first screen "b"/);
    bad(one({ screens: [{ components: [] }] }), /name/);
});
