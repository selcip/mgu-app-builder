'use strict';
// Seam 1 (runtime -> recording): the driver moves the highlight with the controller (left, right), presses, or taps
// the screen; the runtime draws the focus ring into each recording and reports `{ screen, element, action }`.
// Each frame must be the kit's own recording of the screen followed by exactly one focus ring: a 5 px white rounded
// stroke 8 px outside the focused element (the Store's ring). Expected orders and actions are worked out by hand
// from test/fixtures/screens/focus.json.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { OP, pack } = require(path.join(ROOT, 'kit', 'kit_record.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));

const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'focus.json'), 'utf8'));
const fileWith = (change) => { const f = JSON.parse(JSON.stringify(FILE)); change(f); return f; };
const screenOf = (f, name) => f.screens.find((s) => s.name === name);
const boxOf = (f, screen, el) => screenOf(f, screen).components.find((c) => c.name === el);

function start(file) {
    const frames = [], actions = [], lines = [];
    const put = (m) => lines.push(String(m));
    const rt = createRuntime({
        kit,
        log: { error: put, warn: put, info: put },
        sink: { frame(rec) { const w = rec.words(); frames.push(Uint32Array.from(w)); return true; } },
    });
    rt.on('action', (a) => actions.push(a));
    assert.ok(rt.load(file), lines.join('\n'));
    rt.start();
    return { rt, frames, actions, lines, last: () => frames[frames.length - 1] };
}

/** The kit's recording of a screen alone (no runtime), as the words the renderer receives. */
function kitOnly(screen) {
    const rec = kit.record(screen, { textScale: 1, design: { w: 1796, h: 632 }, area: { x: 0, y: 0, w: 1796, h: 632 } });
    return Uint32Array.from(rec.words());
}

const WHITE = pack('#ffffff');
/**
 * The focus ring in a frame: the frame must be `base` (the kit's recording of the screen) followed by one 5 px
 * white rounded stroke; returns its box { x, y, w, h, r }, or null when the frame is `base` alone.
 */
function ringIn(frame, base) {
    assert.deepStrictEqual(Array.from(frame.subarray(0, base.length)), Array.from(base), 'the screen is drawn as the kit draws it');
    if (frame.length === base.length) return null;
    assert.strictEqual(frame.length, base.length + 8, 'one stroke after the screen');
    const f = new Float32Array(frame.buffer, frame.byteOffset + base.length * 4, 8);
    assert.strictEqual(frame[base.length], OP.RSTROKE);
    assert.strictEqual(f[6], 5, 'ring is 5 px wide');
    assert.strictEqual(frame[base.length + 7], WHITE, 'ring is white');
    return { x: f[1], y: f[2], w: f[3], h: f[4], r: f[5] };
}

/** The element whose ring a frame shows: the ring must sit 8 px outside exactly one element of the screen. */
function focusedIn(frame, screen) {
    const ring = ringIn(frame, kitOnly(screen));
    if (!ring) return null;
    const hit = screen.components.filter((c) => c.x - 8 === ring.x && c.y - 8 === ring.y && c.w + 16 === ring.w && c.h + 16 === ring.h);
    assert.strictEqual(hit.length, 1, 'the ring is 8 px outside one element: ' + JSON.stringify(ring));
    return hit[0].name;
}

/** Moves right n times and returns the focused element's name after each move (the first: before any move). */
function walk(s, screen, n, dir) {
    const seen = [focusedIn(s.last(), screen)];
    for (let i = 0; i < n; i++) {
        s.rt.controller(dir || 'right');
        seen.push(focusedIn(s.last(), screen));
    }
    return seen;
}

test('without a focus list, the highlight follows reading order over the focusable elements', () => {
    const s = start(FILE);
    assert.deepStrictEqual(walk(s, screenOf(FILE, 'main'), 4), ['wifi', 'lights', 'volume', 'cancel', 'save']);
});

test('a focus list sets the order, may take in any element, and leaves out the elements it does not name', () => {
    const f = fileWith((x) => { x.first = 'custom'; });
    const s = start(f);
    // custom: focus ["save", "heading", "volume"]; bass is left out
    assert.deepStrictEqual(walk(s, screenOf(f, 'custom'), 2), ['save', 'heading', 'volume']);
});

test('hidden elements and names not on the screen are skipped', () => {
    const f = fileWith((x) => {
        x.first = 'custom';
        screenOf(x, 'custom').focus = ['gone', 'volume', 'bass', 'save'];
        boxOf(x, 'custom', 'bass').opts.hidden = true;
    });
    const s = start(f);
    assert.deepStrictEqual(walk(s, screenOf(f, 'custom'), 1), ['volume', 'save']);
});

test('left and right stop at the ends of the focus order, drawing nothing new there', () => {
    const s = start(FILE);
    const main = screenOf(FILE, 'main');
    s.rt.controller('left');
    assert.strictEqual(s.frames.length, 1, 'nothing to move to before the first element');
    assert.deepStrictEqual(walk(s, main, 5, 'right').slice(-2), ['save', 'save']);
    assert.deepStrictEqual(walk(s, main, 2, 'left'), ['save', 'cancel', 'volume']);
});

test('a screen without focusable elements draws no ring and reports nothing', () => {
    const f = fileWith((x) => { x.first = 'custom'; screenOf(x, 'custom').focus = []; });
    const s = start(f);
    assert.strictEqual(ringIn(s.last(), kitOnly(screenOf(f, 'custom'))), null);
    s.rt.controller('right');
    s.rt.controller('press');
    s.rt.touch('down', 100, 350);
    s.rt.touch('up', 100, 350);
    assert.deepStrictEqual(s.actions, []);
    assert.strictEqual(s.frames.length, 1);
});

test('press reports the highlighted element; its action is its name', () => {
    const s = start(FILE);
    s.rt.controller('press');
    s.rt.controller('right');
    s.rt.controller('right');
    s.rt.controller('press');
    assert.deepStrictEqual(s.actions, [
        { screen: 'main', element: 'wifi', action: 'wifi' },
        { screen: 'main', element: 'volume', action: 'volume' },
    ]);
});

test('an action named in the screen file replaces the name, and several elements may share it', () => {
    const f = fileWith((x) => { x.first = 'custom'; screenOf(x, 'custom').focus = ['volume', 'bass', 'save']; });
    const s = start(f);
    for (const input of ['press', 'right', 'press', 'right', 'press']) s.rt.controller(input);
    assert.deepStrictEqual(s.actions, [
        { screen: 'custom', element: 'volume', action: 'sound' },
        { screen: 'custom', element: 'bass', action: 'sound' },
        { screen: 'custom', element: 'save', action: 'save' },
    ]);
});

test('a tap on an element reports the same action as a press, and moves the highlight there', () => {
    const s = start(FILE);
    const main = screenOf(FILE, 'main');
    s.rt.touch('down', 1300, 540);      // save
    s.rt.touch('move', 1310, 545);
    s.rt.touch('up', 1310, 545);
    assert.deepStrictEqual(s.actions, [{ screen: 'main', element: 'save', action: 'save' }]);
    assert.strictEqual(focusedIn(s.last(), main), 'save');
    s.rt.controller('press');
    assert.deepStrictEqual(s.actions[1], s.actions[0]);
});

test('a tap that leaves its element, misses every element, or lands on one out of focus reports nothing', () => {
    const s = start(FILE);
    s.rt.touch('down', 1300, 540);      // save ...
    s.rt.touch('up', 700, 540);         // ... up on cancel
    s.rt.touch('down', 1700, 30);       // nothing there
    s.rt.touch('up', 1700, 30);
    s.rt.touch('down', 100, 60);        // heading: a text, not in reading-order focus
    s.rt.touch('up', 100, 60);
    assert.deepStrictEqual(s.actions, []);
    assert.strictEqual(s.frames.length, 1, 'the highlight stayed');
});

test('a tap goes to the element drawn on top', () => {
    const f = fileWith((x) => {
        const m = screenOf(x, 'main');
        m.components.push({ name: 'over', rtype: 'gpu', gpu: 'button', x: 1250, y: 480, w: 300, h: 120, opts: { text: 'Over' } });
    });
    const s = start(f);
    s.rt.touch('down', 1300, 540);
    s.rt.touch('up', 1300, 540);
    assert.deepStrictEqual(s.actions.map((a) => a.element), ['over']);
});

test('the ring follows the element’s corners: 8 px more than its own radius', () => {
    const f = fileWith((x) => { x.first = 'custom'; screenOf(x, 'custom').focus = ['save', 'volume']; });
    const s = start(f);
    const custom = screenOf(f, 'custom');
    assert.strictEqual(ringIn(s.last(), kitOnly(custom)).r, 18 + 8, 'vbutton: 18');
    s.rt.controller('right');
    assert.strictEqual(ringIn(s.last(), kitOnly(custom)).r, 30 + 8, 'slider: half its height');
});
