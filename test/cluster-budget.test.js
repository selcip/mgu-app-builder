'use strict';
// Seam 1 for the Layer budget (ticket 08): the engine runs with the car's limits and the budget is read from its
// packing plan. GT3 equals the apps repo's bench golden (bench/test/golden/gt3-cluster.json: 8 layers, 3 effects,
// 5 sheets, its pixel memory); Sport, M and the calibration grid equal what the engine's own status row says; a layout
// over the cap is marked. Then the `conn` operation (one undo step, refusals).
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createEngine } = require('../cluster/node.js');
const { budgetOf, CAR } = require('../cluster/budget.js');

const ROOT = path.join(__dirname, '..');
const fixture = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', n + '.json'), 'utf8'));
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const withCar = (layout) => createEngine({ name: 'design', layout, layerCap: CAR.perConnection, pixelBytes: CAR.pixelBytes });
async function settled(engine) {
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
        const b = budgetOf(engine);
        const drawn = engine.scene().filter((l) => l.kind !== 'asset').length;
        if (b.layers.count > 0 && drawn >= Math.min(b.layers.count, CAR.total) && /layers?( on d+ connections)?, /.test(engine.status())) return b;
        await new Promise((r) => setTimeout(r, 25));
    }
    return budgetOf(engine);
}

const APPS = process.env.APPS_REPO || path.join(ROOT, '..', 'apps');
const GOLDEN = path.join(APPS, 'bench', 'test', 'golden', 'gt3-cluster.json');

test('GT3: 8 layers (3 effects, 5 sheets) on one connection and the pixel memory of the apps repo golden', { skip: !fs.existsSync(GOLDEN) && 'no apps checkout' }, async () => {
    const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    const engine = withCar(fixture('gt3'));
    try {
        const b = await settled(engine);
        assert.deepStrictEqual(b.connections, [{ conn: 0, layers: 8, limit: 8, over: false }]);
        assert.strictEqual(b.layers.count, golden.layers.filter((l) => l.kind !== 'asset').length);
        assert.strictEqual(b.layers.count, 8);
        assert.deepStrictEqual([b.effects, b.sheets, b.waiting], [3, 5, 0]);
        assert.strictEqual(b.pixels.bytes, golden.pixelsInUse);
        assert.strictEqual(b.pixels.limit, golden.pixelCap);
        assert.deepStrictEqual(b.over, []);
    } finally { engine.stop(); }
});

for (const name of ['gt3', 'sport', 'm', 'grid']) {
    test(name + ': the budget equals the engine\'s own status row', async () => {
        const engine = withCar(fixture(name));
        try {
            const b = await settled(engine);
            const m = /(\d+) layers?(?: on (\d+) connections)?, ([\d.]+) MiB of 16 MiB/.exec(engine.status());
            assert.ok(m, engine.status());
            assert.strictEqual(b.layers.count, Number(m[1]));
            assert.strictEqual(b.connections.length, Number(m[2] || 1));
            assert.strictEqual((b.pixels.bytes / 1048576).toFixed(1), m[3]);
            if (name !== 'grid') assert.deepStrictEqual(b.over, [], name + ' fits the car');
            if (name === 'grid') assert.ok(b.connections.length > 1, 'the grid uses several connections');
        } finally { engine.stop(); }
    });
}

test('a layout over the per-connection cap is marked and says which limit', async () => {
    const layout = fixture('gt3');
    for (let i = 0; i < 10; i++) layout.widgets.push({ id: 'extra' + i, type: 'fill', x: 0, y: 0, w: 100, h: 100, color: 'bg' });
    const engine = withCar(layout);
    try {
        const b = await settled(engine);
        assert.strictEqual(b.connections[0].layers, 15);
        assert.strictEqual(b.connections[0].over, true);
        assert.strictEqual(b.waiting, 7);
        assert.ok(b.over.some((t) => /Connection 1 has 15 layers; the limit is 8/.test(t)), b.over.join('|'));
    } finally { engine.stop(); }
});

test('setConn puts an element on another connection, in one undo step; out of range is refused', () => {
    const doc = M.openBytes(new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', 'gt3.json'))));
    const w = (d, id) => d.layout.widgets.find((x) => x.id === id);
    const next = M.apply(doc, { type: 'setConn', element: 'speed', conn: 2 });
    assert.strictEqual(w(next, 'speed').conn, 2);
    assert.strictEqual(w(doc, 'speed').conn, undefined);
    const back = M.apply(next, { type: 'setConn', element: 'speed', conn: 0 });
    assert.strictEqual(w(back, 'speed').conn, undefined, '0 is the default, so the key goes again');
    for (const bad of [4, -1, 1.5, '2']) {
        assert.throws(() => M.apply(doc, { type: 'setConn', element: 'speed', conn: bad }), (e) => e instanceof M.EditError && /connection/i.test(e.message));
    }
    assert.throws(() => M.apply(doc, { type: 'setConn', element: 'nope', conn: 1 }), M.EditError);
    let h = M.createHistory(doc);
    h = M.dispatch(h, { type: 'setConn', element: 'speed', conn: 1 });
    assert.strictEqual(w(h.present, 'speed').conn, 1);
    assert.strictEqual(w(M.undo(h).present, 'speed').conn, undefined);
});
