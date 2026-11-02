'use strict';
// The runtime on the head unit (runtime/mgu_headunit.js) takes the driver's touches and iDrive controller turns and
// pushes from the render client, as the renderer sends them, and reports the same actions as the core. The render
// client is replaced by a stand-in with its interface (events ready, touch, ccu; methods mode, place, show, claim,
// grab, frame, connect): the boundary to the renderer.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { runOnHeadUnit } = require(path.join(ROOT, 'runtime', 'mgu_headunit.js'));
const SCREENS = fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'focus.json'), 'utf8');

class FakeClient extends EventEmitter {
    constructor() {
        super();
        this.calls = [];
        this.frames = 0;
    }
    connect() { this.calls.push(['connect']); }
    mode(m) { this.calls.push(['mode', m]); }
    place(p) { this.calls.push(['place', p]); }
    show(on) { this.calls.push(['show', on]); }
    claim(rects) { this.calls.push(['claim', rects]); }
    grab(on) { this.calls.push(['grab', on]); }
    frame() { this.frames++; return true; }
}

function run(info) {
    const client = new FakeClient();
    const quiet = { error() {}, warn() {}, info() {} };
    const rt = runOnHeadUnit({ client, screens: SCREENS, log: quiet, kit });
    const actions = [];
    rt.on('action', (a) => actions.push(a));
    client.emit('ready', 0, info === undefined ? { modes: ['layer', 'embed'], embedBox: { x: 0, y: 0, w: 1796, h: 632 }, controller: true, touch: true } : info);
    return { client, actions };
}

const ccu = (seq, knob, press) => ({ seq, knob, press, tilt: 0, raw: Buffer.alloc(5) });

test('when the renderer is ready, the app claims touches on its whole screen and grabs the controller when offered', () => {
    const { client } = run();
    assert.deepStrictEqual(client.calls.find((c) => c[0] === 'claim'), ['claim', [{ x: 0, y: 0, w: 1796, h: 632 }]]);
    assert.deepStrictEqual(client.calls.find((c) => c[0] === 'grab'), ['grab', true]);
    const without = run({ modes: ['embed'], embedBox: { x: 0, y: 0, w: 1796, h: 632 }, controller: false });
    assert.strictEqual(without.client.calls.find((c) => c[0] === 'grab'), undefined, 'no controller gate: no grab');
});

test('a tap from the renderer reports the element’s action', () => {
    const { client, actions } = run();
    client.emit('touch', 'down', 1300, 540);
    client.emit('touch', 'up', 1300, 540);
    assert.deepStrictEqual(actions, [{ screen: 'main', element: 'save', action: 'save' }]);
});

test('turning the controller moves the highlight by its detents and pushing it selects', () => {
    const { client, actions } = run();
    const before = client.frames;
    client.emit('ccu', ccu(1, 10, 0));          // first sample: where the counter stands
    client.emit('ccu', ccu(2, 12, 0));          // two detents clockwise
    assert.strictEqual(client.frames, before + 1, 'one new frame for the move');
    client.emit('ccu', ccu(3, 12, 1));          // push
    client.emit('ccu', ccu(4, 12, 1));          // still held: no second press
    client.emit('ccu', ccu(5, 11, 0));          // one back
    client.emit('ccu', ccu(6, 11, 1));
    assert.deepStrictEqual(actions.map((a) => a.element), ['volume', 'lights']);
});

test('the counter wraps at 16 bits; 0xffff is no reading', () => {
    const { client, actions } = run();
    client.emit('ccu', ccu(1, 0xfffe, 0));
    client.emit('ccu', ccu(2, 0x0001, 0));      // three detents clockwise across the wrap
    client.emit('ccu', ccu(3, 0xffff, 0));      // no reading: ignored
    client.emit('ccu', ccu(4, 0x0001, 1));
    assert.deepStrictEqual(actions.map((a) => a.element), ['cancel']);
});

test('a jump of more than 24 detents is a stale sample and moves nothing', () => {
    const { client, actions } = run();
    client.emit('ccu', ccu(1, 100, 0));
    client.emit('ccu', ccu(2, 200, 0));
    client.emit('ccu', ccu(3, 200, 1));
    assert.deepStrictEqual(actions.map((a) => a.element), ['wifi']);
});
