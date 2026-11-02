'use strict';
// The vendored kit draws on its own outside mgu-store: every Store screen in its iDrive 7 layout
// (compact, 1796 x 632) records without an element error, and the Store tab's recording matches
// its golden file. Refresh the golden after a deliberate kit sync: UPDATE_GOLDEN=1 npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { record } = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { compact } = require(path.join(__dirname, 'fixtures', 'mgu-store', 'store_compact.js'));
const GOLDEN = path.join(__dirname, 'golden', 'store-id7-store.rec');

const layout = compact(1796, 632);
const draw = (screen) => record(screen, { design: layout.design, view: 'id7' });

test('the Store lays out its iDrive 7 screens at 1796 x 632', () => {
    assert.deepStrictEqual(layout.design, { w: 1796, h: 632 });
    assert.ok(layout.screens.length >= 10, `${layout.screens.length} screens`);
});

for (const screen of layout.screens) {
    test(`Store screen ${screen.name} draws through the vendored kit without errors`, () => {
        const rec = draw(screen);
        assert.strictEqual(rec.errors, undefined, String(rec.errors));
        assert.ok(rec.words().length > 0, 'something recorded');
    });
}

test('the Store tab records the same draw commands as its golden file', () => {
    const got = Buffer.from(Uint32Array.from(draw(layout.screens.find((s) => s.name === 'store')).words()).buffer);
    if (process.env.UPDATE_GOLDEN) {
        fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
        fs.writeFileSync(GOLDEN, got);
    }
    assert.ok(fs.existsSync(GOLDEN), 'golden file missing: UPDATE_GOLDEN=1 npm test');
    assert.ok(got.equals(fs.readFileSync(GOLDEN)), 'recording differs from test/golden/store-id7-store.rec');
});
