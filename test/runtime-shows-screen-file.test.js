'use strict';
// Seam 1 (runtime -> recording): an app loads a screen file into the runtime and starts it; the runtime hands
// the recording of the first screen to its sink. Recordings are compared with golden files under test/golden/;
// refresh them after a deliberate kit sync with UPDATE_GOLDEN=1 npm test (and look at them before committing).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
const FIXTURES = path.join(__dirname, 'fixtures', 'screens');

const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

// the test sink: keeps each frame's draw commands as bytes, the way the renderer receives them
function bufferSink() {
    const frames = [];
    return {
        frames,
        frame(rec) {
            const w = rec.words();
            frames.push(Buffer.from(w.buffer, w.byteOffset, w.byteLength));
            return true;
        },
    };
}

function captureLog() {
    const lines = [];
    const put = (m) => lines.push(String(m));
    return { lines, error: put, warn: put, info: put, log: put };
}

function start(file) {
    const sink = bufferSink(), log = captureLog();
    const rt = createRuntime({ kit, sink, log });
    const loaded = rt.load(file);
    rt.start();
    return { sink, log, loaded };
}

function assertGolden(got, name) {
    const file = path.join(__dirname, 'golden', name);
    if (process.env.UPDATE_GOLDEN) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, got);
    }
    assert.ok(fs.existsSync(file), `golden file missing: UPDATE_GOLDEN=1 npm test (${name})`);
    assert.ok(got.equals(fs.readFileSync(file)), `recording differs from test/golden/${name}`);
}

test('starting a schema 1 screen file draws its first screen', () => {
    const { sink, loaded } = start(fixture('two-screens.json'));
    assert.strictEqual(loaded, true);
    assert.strictEqual(sink.frames.length, 1);
    assertGolden(sink.frames[0], 'runtime-two-screens-settings.rec');
});

test('the first screen is drawn in the theme the screen file names', () => {
    const file = JSON.parse(fixture('two-screens.json'));
    for (const s of file.screens) s.theme = 'ice';
    const red = start(fixture('two-screens.json')).sink.frames[0];
    const { sink } = start(file);
    assert.strictEqual(sink.frames.length, 1);
    assert.ok(!sink.frames[0].equals(red), 'Ice White draws differently from M Red');
    assertGolden(sink.frames[0], 'runtime-two-screens-settings-ice.rec');
});

test('a screen file with an unknown schema is refused with a log line naming it, and nothing is drawn', () => {
    const file = JSON.parse(fixture('two-screens.json'));
    file.schema = 2;
    const { sink, log, loaded } = start(file);
    assert.strictEqual(loaded, false);
    assert.strictEqual(sink.frames.length, 0);
    assert.ok(log.lines.some((l) => /schema 2\b/.test(l)), log.lines.join('\n'));
});

test('a screen file whose first screen is not in it is refused, and nothing is drawn', () => {
    const file = JSON.parse(fixture('two-screens.json'));
    file.first = 'gone';
    const { sink, log, loaded } = start(file);
    assert.strictEqual(loaded, false);
    assert.strictEqual(sink.frames.length, 0);
    assert.ok(log.lines.some((l) => /"gone"/.test(l)), log.lines.join('\n'));
});

test('a Store screen file (no schema, no first) draws unchanged from its first listed screen', () => {
    const { compact } = require(path.join(__dirname, 'fixtures', 'mgu-store', 'store_compact.js'));
    const file = JSON.parse(JSON.stringify(compact(1796, 632)));       // as read from a Store screens.json
    assert.strictEqual(file.schema, undefined);
    assert.strictEqual(file.screens[0].name, 'store');
    const { sink, loaded, log } = start(JSON.stringify(file));
    assert.strictEqual(loaded, true, log.lines.join('\n'));
    assert.strictEqual(sink.frames.length, 1);
    // the kit's own recording of the Store tab (ticket 01's golden): the runtime adds and changes nothing
    // (compared, never rewritten here)
    const golden = fs.readFileSync(path.join(__dirname, 'golden', 'store-id7-store.rec'));
    assert.ok(sink.frames[0].equals(golden), 'recording differs from test/golden/store-id7-store.rec');
});
