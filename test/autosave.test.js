'use strict';
// Seam 2: the document model -> the autosaved copy. The Designer keeps the open design (screen file and images)
// in browser storage behind a small store interface; here an in-memory store stands in for IndexedDB.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function edited() {
    const uploaded = M.importScreenFile(M.newDocument().file, { 'images/logo.png': PNG });
    return [
        { type: 'addScreen', name: 'about', title: 'About' },
        { type: 'addElement', screen: 'about', widget: 'button' },
    ].reduce((d, op) => M.apply(d, op), uploaded);
}

test('a saved design, with its uploaded images, is restored as it was', async () => {
    const store = M.memoryStore();
    const doc = edited();
    assert.strictEqual(await M.autosave(store).save(doc), null);
    const { doc: back, problem } = await M.autosave(store).restore();
    assert.strictEqual(problem, null);
    assert.deepStrictEqual(back.file, doc.file);
    assert.deepStrictEqual(Object.keys(back.images), ['images/logo.png']);
    assert.deepStrictEqual(Array.from(back.images['images/logo.png']), Array.from(PNG));
});

test('with nothing stored there is nothing to restore, and each save replaces the stored copy', async () => {
    const store = M.memoryStore();
    assert.deepStrictEqual(await M.autosave(store).restore(), { doc: null, problem: null });
    const a = M.autosave(store);
    await a.save(edited());
    const fresh = M.apply(M.newDocument(), { type: 'addScreen', name: 'b' });
    await a.save(fresh);
    const { doc } = await a.restore();
    assert.deepStrictEqual(doc.file, fresh.file);
    assert.deepStrictEqual(doc.images, {});
});

test('a stored copy that is not a screen file this Designer reads is not restored, and says why', async () => {
    const store = M.memoryStore();
    await store.write({ file: { schema: 2, screens: [{ name: 'a', components: [] }] }, images: {} });
    const { doc, problem } = await M.autosave(store).restore();
    assert.strictEqual(doc, null);
    assert.match(problem, /schema 2/);
    await store.write({ nonsense: true });
    assert.strictEqual((await M.autosave(store).restore()).doc, null);
});

/** A store that fails as browser storage does: full, or not available in a private window. */
function failingStore(name, message) {
    const fail = async () => { const e = new Error(message); e.name = name; throw e; };
    return { read: fail, write: fail };
}

test('a full or unavailable store is reported, not thrown, and a later save still works', async () => {
    const full = await M.autosave(failingStore('QuotaExceededError', 'quota')).save(edited());
    assert.match(full, /storage is full/i);
    assert.match(full, /download/i);
    const off = M.autosave(failingStore('InvalidStateError', 'IndexedDB is not available'));
    assert.match(await off.save(edited()), /IndexedDB is not available/);
    const { doc, problem } = await off.restore();
    assert.strictEqual(doc, null);
    assert.match(problem, /IndexedDB is not available/);

    // storage that fails once and then works again
    const store = M.memoryStore();
    let broken = true;
    const flaky = { read: () => store.read(), write: (d) => (broken ? Promise.reject(new Error('busy')) : store.write(d)) };
    const a = M.autosave(flaky);
    assert.match(await a.save(edited()), /busy/);
    broken = false;
    assert.strictEqual(await a.save(edited()), null);
    assert.deepStrictEqual((await a.restore()).doc.file, edited().file);
});
