'use strict';
// The vendored cluster engine (engine/, the apps repo's) runs in Node against the in-memory stand-in: no socket, `fs`
// and the kit's ctx shimmed (cluster/). GT3 registers the layers the apps repo's bench golden
// (bench/test/golden/gt3-cluster.json, recorded on the real bench) lists: 8 layers, 3 effects and 5 sheets.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createEngine } = require('../cluster/node.js');

const gt3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cluster-layouts', 'gt3.json'), 'utf8'));

async function until(what, ok, ms = 8000) {
    const t0 = Date.now();
    while (!ok()) {
        if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what);
        await new Promise((r) => setTimeout(r, 25));
    }
}

test('GT3 registers 8 layers, 3 effects and 5 sheets, on the stand-in', async () => {
    const engine = createEngine({ name: 'gt3', layout: gt3 });
    try {
        await until('GT3 layers', () => engine.scene().length === 8);
        const layers = engine.scene();
        // from the apps repo's golden: key, kind, rect (z in the engine's order)
        assert.deepStrictEqual(layers.map((l) => [l.key, l.kind, l.x, l.y, l.w, l.h]), [
            ['1:1', 'effect', 0, 0, 1920, 720],
            ['1:2', 'effect', 470, 52, 980, 44],
            ['1:3', 'image', 136, 62, 1740, 180],
            ['1:4', 'effect', 440, 112, 1040, 34],
            ['1:5', 'image', 440, 150, 1040, 26],
            ['1:6', 'image', 128, 268, 744, 418],
            ['1:7', 'image', 1166, 268, 724, 418],
            ['1:8', 'image', 760, 300, 400, 244],
        ]);
        assert.strictEqual(layers.filter((l) => l.kind === 'effect').length, 3);
        assert.strictEqual(layers.filter((l) => l.kind === 'image').length, 5);
        assert.ok(layers.every((l) => l.state === 'shown'));
    } finally {
        engine.stop();
    }
});

test('the sheets carry pixels and the status row reads as the car shows it', async () => {
    const engine = createEngine({ name: 'gt3', layout: gt3 });
    try {
        await until('GT3 layers', () => engine.scene().length === 8 && /8 layers/.test(engine.status()));
        const sheet = engine.scene().find((l) => l.key === '1:6');
        const px = engine.pixelRect({ key: sheet.key, x: 0, y: 0, w: sheet.iw, h: sheet.ih });
        assert.strictEqual(px.length, sheet.iw * sheet.ih * 4);
        assert.ok(px.some((b) => b !== 0), 'the sheet is drawn');
        assert.match(engine.status(), /GT3 theme, 8 layers/);
        assert.deepStrictEqual(engine.logs.filter((l) => l.level === 'error'), []);
    } finally {
        engine.stop();
    }
});

test('a layout the engine refuses is refused with the engine\'s own reason', async () => {
    const bad = Object.assign({}, gt3, { widgets: [{ id: 'x', type: 'nope', x: 0, y: 0, w: 10, h: 10 }] });
    const engine = createEngine({ name: 'bad', layout: bad });
    try {
        await until('the refusal', () => /unknown type "nope"/.test(engine.status()));
        assert.strictEqual(engine.scene().length, 0);
    } finally {
        engine.stop();
    }
});

test('a layer cap of 3 leaves the layers past it waiting, as the bench\'s golden does', async () => {
    const engine = createEngine({ name: 'gt3', layout: gt3, layerCap: 3 });
    try {
        await until('GT3 layers', () => engine.scene().length === 8);
        assert.deepStrictEqual(engine.scene().map((l) => l.state), ['shown', 'shown', 'shown'].concat(Array(5).fill('waiting')));
    } finally {
        engine.stop();
    }
});

test('a setting changes the layers: "Leave room for the map" cuts the layout again', async () => {
    const engine = createEngine({ name: 'gt3', layout: gt3 });
    try {
        await until('GT3 layers', () => engine.scene().length === 8);
        const before = JSON.stringify(engine.scene().map((l) => l.uniforms));
        engine.setSetting('mapWindow', true);
        await until('the rebuilt layers', () => JSON.stringify(engine.scene().map((l) => l.uniforms)) !== before);
        assert.ok(engine.scene().length > 0);
    } finally {
        engine.stop();
    }
});

test('a signal fed as the car sends it reaches the layers', async () => {
    const engine = createEngine({ name: 'gt3', layout: gt3 });
    try {
        await until('GT3 layers', () => engine.scene().length === 8);
        const rpm = () => JSON.stringify(engine.scene().map((l) => l.uniforms));
        const before = rpm();
        engine.feed('de.bmw.infotainment.vehicle.CDS', 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: 6000 * 4 });
        await until('the rev bar to move', () => rpm() !== before);
    } finally {
        engine.stop();
    }
});

test('stop() ends the Layouts reload debounce too: a layout pushed just before stop reloads nothing', async () => {
    const engine = createEngine({ name: 'gt3', layout: gt3 });
    await until('GT3 layers', () => engine.scene().length === 8);
    engine.setLayout(gt3);
    engine.stop();
    const before = engine.logs.length;
    await new Promise((r) => setTimeout(r, 450));      // the debounce is 300 ms
    assert.deepStrictEqual(engine.logs.slice(before), [], 'nothing ran after stop');
    assert.ok(!engine.logs.some((l) => /changed on disk/.test(l.text)));
    // a stopped engine ignores late calls
    engine.setLayout(gt3);
    engine.setSetting('mapWindow', true);
    await new Promise((r) => setTimeout(r, 450));
    assert.deepStrictEqual(engine.logs.slice(before), []);
});
