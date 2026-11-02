'use strict';
// The vendored kit is the pinned mgu-store commit, unmodified: every file's git blob id is the one recorded
// beside the copy (no clone needed), nothing else is in the folder, and the MIT notices came with it.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const blobId = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

for (const dir of ['kit', path.join('test', 'fixtures', 'mgu-store')]) {
    test(`${dir} is byte-identical to the mgu-store commit recorded beside it`, () => {
        const rec = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'SOURCE.json'), 'utf8'));
        assert.match(rec.commit, /^[0-9a-f]{40}$/);
        assert.ok(rec.files.length > 0);
        for (const f of rec.files) {
            assert.strictEqual(blobId(fs.readFileSync(path.join(ROOT, dir, f.name))), f.blob, `${f.name} unmodified`);
        }
        assert.deepStrictEqual(fs.readdirSync(path.join(ROOT, dir)).sort(), rec.files.map((f) => f.name).concat('SOURCE.json').sort());
    });
}

test('the kit keeps its MIT notices', () => {
    const kit = fs.readFileSync(path.join(ROOT, 'kit', 'LICENSE-kit.txt'), 'utf8');
    assert.match(kit, /^MIT License/);
    assert.match(kit, /cauliflowermossgrape/);
    assert.match(fs.readFileSync(path.join(ROOT, 'kit', 'LICENSE-qrcodegen.txt'), 'utf8'), /MIT/);
});
