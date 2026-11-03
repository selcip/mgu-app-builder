'use strict';
// The canvas's view (designer/src/shell/view.ts): zooming about a point keeps that point still, zoom steps and
// limits, centring and fitting the HMI page.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let V;
before(async () => { V = await import(pathToFileURL(path.join(__dirname, '..', 'designer', 'src', 'shell', 'view.ts')).href); });

const shows = (view, p) => ({ x: view.x + p.x * view.zoom, y: view.y + p.y * view.zoom });

test('zooming about a point keeps the page point under it where it was', () => {
    const v = { zoom: 1, x: 100, y: 50 };
    for (const z of [0.5, 2, 3.7]) {
        const n = V.zoomAbout(v, z, 400, 300);
        const p = { x: (400 - v.x) / v.zoom, y: (300 - v.y) / v.zoom };       // the page point under (400, 300)
        const at = shows(n, p);
        assert.ok(Math.abs(at.x - 400) < 1e-9 && Math.abs(at.y - 300) < 1e-9, `at ${z}`);
        assert.strictEqual(n.zoom, z);
    }
});

test('zoom stays between 10 % and 400 %, and steps through the levels', () => {
    assert.strictEqual(V.zoomAbout({ zoom: 1, x: 0, y: 0 }, 9, 0, 0).zoom, 4);
    assert.strictEqual(V.zoomAbout({ zoom: 1, x: 0, y: 0 }, 0.01, 0, 0).zoom, 0.1);
    assert.deepStrictEqual([V.stepZoom(1, 1), V.stepZoom(1, -1), V.stepZoom(0.75, -1)], [1.5, 0.75, 0.5]);
    assert.deepStrictEqual([V.stepZoom(4, 1), V.stepZoom(0.1, -1)], [4, 0.1]);
    assert.strictEqual(V.stepZoom(0.6, 1), 0.75);                       // from between two levels: the next one
    assert.ok(V.wheelZoom(1, -100) > 1 && V.wheelZoom(1, 100) < 1);
    assert.strictEqual(V.wheelZoom(4, -1000), 4);
});

test('centring puts the page in the middle; fitting makes it as large as fits with a margin', () => {
    const canvas = { w: 1000, h: 800 }, page = { w: 1820, h: 745 };
    assert.deepStrictEqual(V.centred(canvas, page, 0.5), { zoom: 0.5, x: (1000 - 910) / 2, y: (800 - 372.5) / 2 });
    const f = V.fitted(canvas, page);
    assert.ok(Math.abs(f.zoom - (1000 - 64) / 1820) < 1e-9);         // width limits it
    assert.ok(Math.abs(f.x - 32) < 1e-9);
    assert.ok(f.y > 32);
});
