'use strict';
// Seam 1 for the car's view (ticket 09): the warnings the Designer shows per element equal the engine's own layout
// check (engine/shared/visible.js check(), the one layouts.js logs from) for GT3, Sport, M and the grid, before and
// after an element is moved; the masks are the engine's geometry.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const visible = require('../engine/shared/visible.js');
let M, V;
before(async () => {
    M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
    V = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'visibility.ts')).href);
});
const open = (name) => M.openBytes(new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', name))));

/** The engine's check lines grouped by widget id, the prefix cut off. */
function engineWarnings(layout) {
    const out = {};
    visible.check(layout.widgets, 'panel').forEach((line) => {
        const i = line.indexOf(': ');
        (out[line.slice(0, i)] = out[line.slice(0, i)] || []).push(line.slice(i + 2));
    });
    return out;
}

for (const name of ['gt3.json', 'sport.json', 'm.json', 'grid.json']) {
    test(name + ': the warnings per element equal the engine\'s layout check', () => {
        const doc = open(name);
        assert.deepStrictEqual(V.warningsOf(doc.layout, visible), engineWarnings(doc.layout));
    });
}

test('GT3 as shipped: the elements that sit under the hood, gear box or belt light are the ones the engine names', () => {
    const doc = open('gt3.json');
    const w = V.warningsOf(doc.layout, visible);
    for (const id of Object.keys(w)) assert.ok(doc.layout.widgets.some((x) => x.id === id), id);
    assert.deepStrictEqual(w, engineWarnings(doc.layout));
});

test('moving an element under the hood adds its warning with the engine\'s reason; moving it away removes it', () => {
    const doc = open('gt3.json');
    const id = 'speed';
    const w0 = doc.layout.widgets.find((x) => x.id === id);
    assert.strictEqual(V.warningsOf(doc.layout, visible)[id], undefined, 'speed is clear of the masks in GT3');
    const hid = M.apply(doc, { type: 'setBoxes', boxes: { [id]: { x: 0, y: 0, w: 200, h: 50 } } });
    const got = V.warningsOf(hid.layout, visible);
    assert.deepStrictEqual(got[id], engineWarnings(hid.layout)[id]);
    assert.match(got[id][0], /px under the hood/);
    const back = M.apply(hid, { type: 'setBoxes', boxes: { [id]: { x: w0.x, y: w0.y, w: w0.w, h: w0.h } } });
    assert.strictEqual(V.warningsOf(back.layout, visible)[id], undefined);
    const box = M.apply(doc, { type: 'setBoxes', boxes: { [id]: { x: 1450, y: 360, w: 40, h: 20 } } });
    assert.match(V.warningsOf(box.layout, visible)[id][0], /gear box/);
    const belt = M.apply(doc, { type: 'setBoxes', boxes: { [id]: { x: 600, y: 680, w: 10, h: 10 } } });
    assert.match(V.warningsOf(belt.layout, visible)[id][0], /seat-belt light/);
});

test('the masks are the engine\'s geometry: the hood polygon follows HOOD, the boxes are BLACK_BOX and BELT', () => {
    const m = V.masksOf(visible);
    assert.deepStrictEqual(m.gearBox, { x: 1406, y: 342, w: 191, h: 77 });
    assert.deepStrictEqual(m.belt, { x: 587, y: 663, w: 39, h: 37 });
    assert.strictEqual(m.hood[0].join(), '0,0');
    assert.ok(m.hood.some((p) => p.join() === '800,3'));
    assert.strictEqual(m.hood[m.hood.length - 1].join(), '1920,0');
});

test('a layout with a widget without a box and a widget that is not an object gives no warning and no error', () => {
    const doc = open('gt3.json');
    const layout = { ...doc.layout, widgets: [{ id: 'a', type: 'fill' }, null, ...doc.layout.widgets] };
    assert.deepStrictEqual(V.warningsOf(layout, visible), engineWarnings(doc.layout));
});
