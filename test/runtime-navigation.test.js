'use strict';
// Seam 1 (runtime -> recording): navigation and the BACK stack. A screen's `nav` maps an action to the screen it
// opens: selecting an element whose action is linked reports the action and then opens that screen. The runtime
// keeps the screens it came through; BACK returns to the previous one (highlight where it was), and BACK on the
// first screen leaves the app, which the runtime reports for the app (or the head-unit adapter) to handle. Every
// screen change is reported to the app's code, which may open any screen itself.
//
// Expected frames are the kit's own recording of the screen plus the focus ring 8 px outside the highlighted element.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { OP, pack } = require(path.join(ROOT, 'kit', 'kit_record.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));

const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'navigation.json'), 'utf8'));
const screen = (name) => FILE.screens.find((s) => s.name === name);

/** A runtime on `file`, recording frames, actions, screen changes and leaving; started unless `noStart`. */
function run(file, noStart) {
    const frames = [], actions = [], screens = [], leaves = [], lines = [];
    const put = (m) => lines.push(String(m));
    const rt = createRuntime({
        kit,
        log: { error: put, warn: put, info: put },
        sink: { frame(rec) { frames.push(Uint32Array.from(rec.words())); return true; } },
    });
    rt.on('action', (a) => actions.push(a));
    rt.on('screen', (s) => screens.push(s));
    rt.on('leave', (s) => leaves.push(s));
    assert.ok(rt.load(file || FILE), lines.join('\n'));
    if (!noStart) rt.start();
    return { rt, frames, actions, screens, leaves, lines, last: () => frames[frames.length - 1] };
}

function kitOnly(s) {
    const rec = kit.record(s, { textScale: 1, design: { w: 1796, h: 632 }, area: { x: 0, y: 0, w: 1796, h: 632 } });
    return Uint32Array.from(rec.words());
}

const f32 = Math.fround;
// the elements' boxes and corner radii as the kit draws them (button 16, row 16, field 14)
const BOX = {
    toSettings: { x: 40, y: 150, w: 560, h: 84, r: 16 },
    ping: { x: 640, y: 150, w: 560, h: 84, r: 16 },
    helpButton: { x: 1240, y: 150, w: 500, h: 84, r: 16 },
    fog: { x: 48, y: 150, w: 1700, h: 104, r: 16 },
    name: { x: 48, y: 290, w: 1000, h: 100, r: 14 },
    more: { x: 48, y: 500, w: 560, h: 84, r: 16 },
    home: { x: 1180, y: 500, w: 560, h: 84, r: 16 },
    gone: { x: 40, y: 150, w: 560, h: 84, r: 16 },
};

/** `frame` must be screen `name` as the kit draws it followed by one focus ring around `ring`. */
function assertShows(frame, name, ring, what) {
    const base = kitOnly(screen(name));
    assert.deepStrictEqual(Array.from(frame.subarray(0, base.length)), Array.from(base), what + ': screen ' + name + ' as the kit draws it');
    if (!ring) {
        assert.strictEqual(frame.length, base.length, what + ': no ring');
        return;
    }
    const box = BOX[ring];
    assert.strictEqual(frame.length, base.length + 8, what + ': one ring after the screen');
    const f = new Float32Array(frame.buffer, frame.byteOffset + base.length * 4, 8);
    assert.strictEqual(frame[base.length], OP.RSTROKE);
    assert.deepStrictEqual([f[1], f[2], f[3], f[4], f[5], f[6]],
        [f32(box.x - 8), f32(box.y - 8), f32(box.w + 16), f32(box.h + 16), f32(box.r + 8), 5], what + ': ring around ' + ring);
    assert.strictEqual(frame[base.length + 7], pack('#ffffff'));
}

const right = (s, n) => { for (let i = 0; i < n; i++) s.rt.controller('right'); };
const tap = (s, b) => { s.rt.touch('down', b.x + 10, b.y + 10); s.rt.touch('up', b.x + 10, b.y + 10); };

test('selecting a linked element reports its action, then opens the linked screen with the highlight on its first element', () => {
    const s = run();
    s.rt.controller('press');       // toSettings, first in reading order, linked to settings
    assert.deepStrictEqual(s.actions, [{ screen: 'home', element: 'toSettings', action: 'toSettings' }]);
    assertShows(s.last(), 'settings', 'fog', 'after the link');
    assert.deepStrictEqual(s.screens.slice(-1), [{ screen: 'settings', from: 'home', by: 'link' }]);
});

test('BACK returns to the previous screen with the highlight where it was, and reports the change', () => {
    const s = run();
    s.rt.controller('press');                   // home -> settings
    right(s, 2);                                // fog, name, more
    s.rt.controller('press');                   // settings -> details
    assertShows(s.last(), 'details', 'gone', 'details');
    s.rt.controller('back');
    assertShows(s.last(), 'settings', 'more', 'back on settings');
    assert.deepStrictEqual(s.screens.slice(-1), [{ screen: 'settings', from: 'details', by: 'back' }]);
    s.rt.controller('back');
    assertShows(s.last(), 'home', 'toSettings', 'back on home');
    assert.deepStrictEqual(s.screens.slice(-1), [{ screen: 'home', from: 'settings', by: 'back' }]);
    assert.deepStrictEqual(s.leaves, []);
});

test('BACK on the first screen leaves the app: reported, nothing redrawn, the screen stays', () => {
    const s = run();
    const n = s.frames.length;
    s.rt.controller('back');
    assert.deepStrictEqual(s.leaves, [{ screen: 'home' }]);
    assert.strictEqual(s.frames.length, n, 'nothing redrawn');
    s.rt.controller('press');                   // still on home: its first element
    assertShows(s.last(), 'settings', 'fog', 'the app goes on from home');
});
