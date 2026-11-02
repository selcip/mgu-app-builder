'use strict';
// Seam 2 (document model -> screen file), pictures: an app author uploads PNGs, which the design keeps under images/
// and elements name by that relative path. The download leaves out images no element uses; a picture an element
// names but the design doesn't have is reported.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const { Canvas } = require(path.join(ROOT, 'kit', 'kit_canvas.js'));
const { zipSync, unzipSync, strToU8, strFromU8 } = require(require.resolve('fflate', { paths: [path.join(ROOT, 'designer')] }));

let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const png = (w, h) => new Uint8Array(new Canvas(w || 4, h || 4).png());
const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const el = (doc, name) => doc.file.screens[0].components.find((c) => c.name === name);
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));
const zipNames = (doc) => Object.keys(unzipSync(M.exportZip(doc))).sort();

test('an uploaded PNG is kept under images/ by its file name and named by that relative path', () => {
    assert.strictEqual(M.imagePathFor('logo.png'), 'images/logo.png');
    assert.strictEqual(M.imagePathFor('My Logo (2).PNG'), 'images/My-Logo-2.png');
    assert.strictEqual(M.imagePathFor('C:\\art\\car.png'), 'images/car.png');
    const bytes = png();
    const d = edit([{ type: 'addImage', path: 'images/logo.png', bytes }]);
    assert.deepStrictEqual(Object.keys(d.images), ['images/logo.png']);
    assert.deepStrictEqual(d.images['images/logo.png'], bytes);
});

test('uploading a picture for an element keeps the PNG and points the element at it, as one edit', () => {
    let h = M.createHistory(edit([{ type: 'addElement', screen: 'main', widget: 'image' }]));
    const bytes = png();
    h = M.dispatch(h, { type: 'uploadPicture', screen: 'main', element: 'image1', key: 'src', path: 'images/car.png', bytes });
    assert.strictEqual(el(h.present, 'image1').opts.src, 'images/car.png');
    assert.deepStrictEqual(h.present.images['images/car.png'], bytes);
    h = M.undo(h);
    assert.strictEqual(el(h.present, 'image1').opts.src, '');
    assert.deepStrictEqual(Object.keys(h.present.images), []);
});

test('an upload that the head unit cannot draw is refused', () => {
    refused(() => M.apply(M.newDocument(), { type: 'addImage', path: 'images/a.png', bytes: strToU8('GIF89a...') }), /PNG/);
    refused(() => M.apply(M.newDocument(), { type: 'addImage', path: 'images/a.png', bytes: png(1100, 10) }), /1024/);
    refused(() => M.apply(M.newDocument(), { type: 'addImage', path: 'logo.png', bytes: png() }), /images\//);
    refused(() => M.apply(M.newDocument(), { type: 'addImage', path: 'images/../x.png', bytes: png() }), /images\//);
});

test('an image no element uses can be removed; one in use cannot', () => {
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'image' }, { type: 'addImage', path: 'images/a.png', bytes: png() },
        { type: 'addImage', path: 'images/b.png', bytes: png() },
        { type: 'setOption', screen: 'main', element: 'image1', key: 'src', value: 'images/a.png' }]);
    assert.deepStrictEqual(Object.keys(M.apply(d, { type: 'removeImage', path: 'images/b.png' }).images), ['images/a.png']);
    refused(() => M.apply(d, { type: 'removeImage', path: 'images/a.png' }), /main.*image1/);
    refused(() => M.apply(d, { type: 'removeImage', path: 'images/c.png' }), /no image/);
});

test('the download leaves out images no element uses', () => {
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'image' }, { type: 'addElement', screen: 'main', widget: 'appIcon' },
        { type: 'addImage', path: 'images/used.png', bytes: png() }, { type: 'addImage', path: 'images/icon.png', bytes: png() },
        { type: 'addImage', path: 'images/old.png', bytes: png() },
        { type: 'setOption', screen: 'main', element: 'image1', key: 'src', value: 'images/used.png' },
        { type: 'setOption', screen: 'main', element: 'appIcon1', key: 'icon', value: 'images/icon.png' }]);
    assert.deepStrictEqual(zipNames(d), ['images/icon.png', 'images/used.png', 'screens.json']);
    // the element moves to another picture: the first one goes too
    const e = M.apply(d, { type: 'setOption', screen: 'main', element: 'image1', key: 'src', value: 'images/old.png' });
    assert.deepStrictEqual(zipNames(e), ['images/icon.png', 'images/old.png', 'screens.json']);
    // an upload with images nobody uses downloads without them
    const up = M.importZip(zipSync({ 'screens.json': strToU8(JSON.stringify(M.newDocument().file)), 'images/stray.png': png() }));
    assert.deepStrictEqual(Object.keys(up.images), ['images/stray.png']);
    assert.deepStrictEqual(zipNames(up), ['screens.json']);
    assert.deepStrictEqual(JSON.parse(strFromU8(unzipSync(M.exportZip(up))['screens.json'])), up.file);
});

test('a picture an element names but the design does not have is reported', () => {
    const d = edit([{ type: 'addElement', screen: 'main', widget: 'image' }, { type: 'addElement', screen: 'main', widget: 'image' },
        { type: 'addScreen', name: 'b' }, { type: 'addElement', screen: 'b', widget: 'appIcon' },
        { type: 'addImage', path: 'images/here.png', bytes: png() },
        { type: 'setOption', screen: 'main', element: 'image1', key: 'src', value: 'images/here.png' },
        { type: 'setOption', screen: 'main', element: 'image2', key: 'src', value: 'images/gone.png' },
        { type: 'setOption', screen: 'b', element: 'appIcon1', key: 'icon', value: 'images/lost.png' }]);
    assert.deepStrictEqual(M.missingImages(d), [
        { screen: 'main', element: 'image2', key: 'src', path: 'images/gone.png' },
        { screen: 'b', element: 'appIcon1', key: 'icon', path: 'images/lost.png' },
    ]);
    assert.deepStrictEqual(M.missingImages(edit([{ type: 'addElement', screen: 'main', widget: 'image' }])), []);
});
