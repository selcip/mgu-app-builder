'use strict';
// Seam 1 (runtime -> recording), pictures: an element's picture is a PNG under images/ beside the screen file,
// named by its relative path. The runtime reads it (from the app's folder on the head unit, from the open design in
// the preview) and the recording draws it. Checked by playing each recording back in software, as the preview does.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const { EventEmitter } = require('node:events');

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { play } = require(path.join(ROOT, 'kit', 'kit_record.js'));
const { Canvas } = require(path.join(ROOT, 'kit', 'kit_canvas.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
const { runOnHeadUnit } = require(path.join(ROOT, 'runtime', 'mgu_headunit.js'));

const W = 1796, H = 632;

/** A w x h PNG of one colour [r, g, b]. */
function pngOf(rgb, w, h) {
    const cv = new Canvas(w || 8, h || 8);
    for (let i = 0; i < cv.d.length; i += 4) { cv.d[i] = rgb[0]; cv.d[i + 1] = rgb[1]; cv.d[i + 2] = rgb[2]; cv.d[i + 3] = 255; }
    return cv.png();
}

/** A one-screen file on a black background with a picture element at 100, 100 (200 x 100) showing `src`. */
function fileWith(src) {
    return {
        schema: 1, first: 'main', design: { w: W, h: H },
        screens: [{ name: 'main', kind: 'gpu', theme: 'm_tricolour', bg: '#000000', components: [
            { name: 'logo', rtype: 'gpu', gpu: 'image', x: 100, y: 100, w: 200, h: 100, opts: { src, radius: 0 } },
        ] }],
    };
}

function captureLog() {
    const lines = [];
    const put = (m) => lines.push(String(m));
    return { lines, error: put, warn: put, info: put, log: put };
}

/** Plays a recording as the preview does and returns the colour [r, g, b] at x, y. */
function pixel(rec, x, y) {
    const cv = new Canvas(W, H);
    play(rec.words(), cv);
    const i = (y * W + x) * 4;
    return [cv.d[i], cv.d[i + 1], cv.d[i + 2]];
}

function show(file, opts) {
    const frames = [];
    const log = captureLog();
    const rt = createRuntime(Object.assign({ kit, log, sink: { frame(rec) { frames.push(pixel(rec, 200, 150)); return true; } } }, opts));
    assert.ok(rt.load(file), log.lines.join('\n'));
    rt.start();
    return { frames, log };
}

test('a picture element draws the PNG its images/ path names', () => {
    const images = { 'images/red.png': pngOf([255, 0, 0]), 'images/blue.png': pngOf([0, 0, 255]) };
    const readImage = (p) => images[p];
    assert.deepStrictEqual(show(fileWith('images/red.png'), { readImage }).frames, [[255, 0, 0]]);
    assert.deepStrictEqual(show(fileWith('images/blue.png'), { readImage }).frames, [[0, 0, 255]]);
});

test('a picture that is missing is logged by its path, and the element draws its empty outline', () => {
    const { frames, log } = show(fileWith('images/gone.png'), { readImage: () => null });
    assert.deepStrictEqual(frames, [[0, 0, 0]]);
    assert.ok(log.lines.some((l) => l.includes('images/gone.png')), log.lines.join('\n'));
    const noReader = show(fileWith('images/gone.png'));
    assert.ok(noReader.log.lines.some((l) => l.includes('images/gone.png')), noReader.log.lines.join('\n'));
});

test('a file that is not a readable PNG is logged and draws the empty outline', () => {
    const { frames, log } = show(fileWith('images/bad.png'), { readImage: () => Buffer.from('not a png') });
    assert.deepStrictEqual(frames, [[0, 0, 0]]);
    assert.ok(log.lines.some((l) => l.includes('images/bad.png')), log.lines.join('\n'));
});

test('on the head unit, pictures are read from images/ in the folder the app names', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-pictures-'));
    try {
        fs.mkdirSync(path.join(dir, 'images'));
        fs.writeFileSync(path.join(dir, 'images', 'green.png'), pngOf([0, 255, 0]));
        // a stand-in for the render client: the frames it is asked to send
        const client = new EventEmitter();
        const sent = [];
        Object.assign(client, { connect() {}, mode() {}, place() {}, show() {}, frame(rec) { sent.push(pixel(rec, 200, 150)); return true; } });
        const log = captureLog();
        const rt = runOnHeadUnit({ client, kit, log, dir, screens: JSON.stringify(fileWith('images/green.png')) });
        assert.ok(rt, log.lines.join('\n'));
        assert.deepStrictEqual(sent, [[0, 255, 0]]);
        assert.deepStrictEqual(log.lines, []);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
