'use strict';
// Seam: the document model for a cluster layout (ADR 0004): open the apps repo's layout file, rename it, keep it
// in autosave, write it back. The layouts under test/fixtures/cluster-layouts are copies of the apps repo's.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, 'fixtures', 'cluster-layouts');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const bytesOf = (name) => new Uint8Array(fs.readFileSync(path.join(DIR, name)));
const LAYOUTS = ['gt3.json', 'sport.json', 'm.json', 'grid.json'];

for (const name of LAYOUTS) {
    test(`${name} opens as a cluster layout and saves equal to the file opened, key order included`, () => {
        const doc = M.openBytes(bytesOf(name));
        assert.strictEqual(M.kindOf(doc), 'cluster-layout');
        const original = fs.readFileSync(path.join(DIR, name), 'utf8');
        const saved = M.exportClusterLayout(doc);
        assert.deepStrictEqual(JSON.parse(saved), JSON.parse(original));
        assert.strictEqual(JSON.stringify(JSON.parse(saved)), JSON.stringify(JSON.parse(original)));
    });
}

test('a screen file zip still opens as a screen file', () => {
    const zip = M.exportZip(M.newDocument());
    const doc = M.openBytes(zip);
    assert.strictEqual(M.kindOf(doc), 'screen-file');
    assert.strictEqual(M.kindOf(M.newDocument()), 'screen-file');
});

test('the layout\'s target defaults to the cluster and only the cluster is exposed', () => {
    const doc = M.openBytes(bytesOf('gt3.json'));
    assert.strictEqual(M.targetOf(doc), 'cluster');
    assert.deepStrictEqual(M.EXPOSED_TARGETS, ['cluster']);
    assert.ok(!('target' in doc.layout), 'opening adds nothing to the file');
    const cluster = M.openBytes(Buffer.from(JSON.stringify({ ...doc.layout, target: 'cluster' })));
    assert.strictEqual(M.targetOf(cluster), 'cluster');
    assert.strictEqual(JSON.parse(M.exportClusterLayout(cluster)).target, 'cluster');
    assert.throws(() => M.openBytes(Buffer.from(JSON.stringify({ ...doc.layout, target: 'hud' }))), /hud/i);
});

test('renaming the layout changes its name and nothing else, and undoes', () => {
    const doc = M.openBytes(bytesOf('sport.json'));
    const h = M.dispatch(M.createHistory(doc), { type: 'renameLayout', name: 'My sport' });
    const saved = JSON.parse(M.exportClusterLayout(h.present));
    const original = JSON.parse(fs.readFileSync(path.join(DIR, 'sport.json'), 'utf8'));
    assert.strictEqual(saved.name, 'My sport');
    assert.deepStrictEqual(Object.keys(saved), Object.keys(original));
    assert.deepStrictEqual({ ...saved, name: 'Sport' }, original);
    assert.strictEqual(doc.layout.name, 'Sport', 'the document opened is not changed');
    assert.strictEqual(M.undo(h).present.layout.name, 'Sport');
    assert.throws(() => M.apply(doc, { type: 'renameLayout', name: '  ' }), M.EditError);
    assert.throws(() => M.apply(M.newDocument(), { type: 'renameLayout', name: 'x' }), M.EditError);
});

test('the layout\'s download is named after it', () => {
    assert.strictEqual(M.downloadName(M.openBytes(bytesOf('gt3.json'))), 'GT3.json');
    assert.strictEqual(M.downloadName(M.openBytes(bytesOf('grid.json'))), 'Calibration grid.json');
    assert.strictEqual(M.downloadName(M.apply(M.openBytes(bytesOf('m.json')), { type: 'renameLayout', name: 'a/b:c' })), 'a_b_c.json');
    assert.strictEqual(M.downloadName(M.newDocument()), 'design.zip');
});

test('a file that is neither a zip nor a cluster layout is refused with a reason', () => {
    const text = (s) => Buffer.from(s);
    assert.throws(() => M.openBytes(text('not json')), M.ImportError);
    assert.throws(() => M.openBytes(text('{"schemaVersion":1,"widgets":[]}')), /schemaVersion/);
    assert.throws(() => M.openBytes(text('{"schemaVersion":2,"name":"x"}')), /widgets/);
    assert.throws(() => M.openBytes(text('[1]')), M.ImportError);
});

test('an autosaved cluster layout is restored as a cluster layout, with its edits', async () => {
    const store = M.memoryStore();
    const doc = M.apply(M.openBytes(bytesOf('m.json')), { type: 'renameLayout', name: 'Mine' });
    assert.strictEqual(await M.autosave(store).save(doc), null);
    const { doc: back, problem } = await M.autosave(store).restore();
    assert.strictEqual(problem, null);
    assert.strictEqual(M.kindOf(back), 'cluster-layout');
    assert.deepStrictEqual(back.layout, doc.layout);
});

test('a damaged autosaved layout is refused, not opened', async () => {
    const store = M.memoryStore();
    await store.write({ kind: 'cluster-layout', file: { schemaVersion: 2 }, images: {} });
    const { doc, problem } = await M.autosave(store).restore();
    assert.strictEqual(doc, null);
    assert.match(problem, /can’t be restored/);
});
