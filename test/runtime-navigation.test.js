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

test('the first screen shown is reported as a screen change from none', () => {
    const s = run();
    assert.deepStrictEqual(s.screens, [{ screen: 'home', from: null, by: 'start' }]);
});

test('the app\'s code opens any screen on top of the shown one; BACK returns from it', () => {
    const s = run();
    s.rt.controller('right');                   // ping
    assert.strictEqual(s.rt.open('about'), true);
    assertShows(s.last(), 'about', null, 'opened from code');
    assert.deepStrictEqual(s.screens.slice(-1), [{ screen: 'about', from: 'home', by: 'open' }]);
    s.rt.controller('back');
    assertShows(s.last(), 'home', 'ping', 'back on home');
});

test('opening a screen that is not in the file is refused and logged; the shown screen stays', () => {
    const s = run();
    const n = s.frames.length;
    assert.strictEqual(s.rt.open('nowhere'), false);
    assert.strictEqual(s.frames.length, n);
    assert.strictEqual(s.screens.length, 1);
    assert.match(s.lines.join('\n'), /no screen "nowhere"/);
});

test('start(name) starts on that screen; BACK there leaves the app', () => {
    const s = run(null, true);
    assert.strictEqual(s.rt.start('settings'), true);
    assertShows(s.last(), 'settings', 'fog', 'started on settings');
    assert.deepStrictEqual(s.screens, [{ screen: 'settings', from: null, by: 'start' }]);
    s.rt.controller('back');
    assert.deepStrictEqual(s.leaves, [{ screen: 'settings' }]);
    assert.strictEqual(s.rt.start('nowhere'), false, 'a screen that is not in the file');
});

test('a link to a screen the driver came through returns to it: BACK there goes on from where it was', () => {
    const s = run();
    s.rt.controller('press');                   // home -> settings
    right(s, 3);                                // home button
    s.rt.controller('press');                   // settings -> home (linked)
    assertShows(s.last(), 'home', 'toSettings', 'back on home through the link, highlight where it was');
    assert.deepStrictEqual(s.screens.slice(-1), [{ screen: 'home', from: 'settings', by: 'link' }]);
    s.rt.controller('back');
    assert.deepStrictEqual(s.leaves, [{ screen: 'home' }], 'home is the first screen again');
});

test('opening the shown screen changes nothing', () => {
    const s = run();
    const n = s.frames.length;
    assert.strictEqual(s.rt.open('home'), true);
    assert.strictEqual(s.frames.length, n);
    assert.strictEqual(s.screens.length, 1);
});

test('tapping a linked element follows its link; an action named by onTap links by that name', () => {
    const s = run();
    tap(s, BOX.helpButton);                     // reports 'help', linked to about
    assert.deepStrictEqual(s.actions, [{ screen: 'home', element: 'helpButton', action: 'help' }]);
    assertShows(s.last(), 'about', null, 'about');
    s.rt.controller('back');
    assertShows(s.last(), 'home', 'helpButton', 'back on home, highlight on the tapped element');
});

test('an unlinked element only reports its action', () => {
    const s = run();
    s.rt.controller('right');
    const n = s.frames.length;
    s.rt.controller('press');                   // ping
    assert.deepStrictEqual(s.actions, [{ screen: 'home', element: 'ping', action: 'ping' }]);
    assert.strictEqual(s.frames.length, n);
});

test('a link to a screen that is not in the file is logged and the screen stays', () => {
    const s = run();
    s.rt.open('details');
    const n = s.frames.length;
    s.rt.controller('press');                   // gone -> nowhere
    assert.deepStrictEqual(s.actions.slice(-1), [{ screen: 'details', element: 'gone', action: 'gone' }]);
    assert.strictEqual(s.frames.length, n);
    assert.match(s.lines.join('\n'), /details: action "gone" links to "nowhere", which is not a screen/);
});

test('an action handler that opens a screen itself wins over the link', () => {
    const s = run();
    s.rt.on('action', (a) => { if (a.action === 'toSettings') s.rt.open('about'); });
    s.rt.controller('press');
    assertShows(s.last(), 'about', null, 'the code\'s screen');
    assert.deepStrictEqual(s.screens.slice(1).map((x) => x.screen), ['about']);
    s.rt.controller('back');
    assertShows(s.last(), 'home', 'toSettings', 'back on home');
});

test('BACK on the keyboard screen cancels it and stays on the field\'s screen; the next BACK leaves that screen', () => {
    const s = run();
    s.rt.controller('press');                   // home -> settings
    s.rt.controller('right');                   // name (a field)
    s.rt.controller('press');                   // keyboard screen
    const changes = s.screens.length;
    s.rt.controller('back');
    assertShows(s.last(), 'settings', 'name', 'back on the field');
    assert.strictEqual(s.screens.length, changes, 'the keyboard screen is no screen change');
    s.rt.controller('back');
    assertShows(s.last(), 'home', 'toSettings', 'back on home');
    assert.deepStrictEqual(s.leaves, []);
});

test('a field whose action is linked opens the linked screen once its text is confirmed, not when cancelled', () => {
    const s = run();
    s.rt.controller('press');                   // home -> settings
    s.rt.controller('right');
    s.rt.controller('press');                   // keyboard screen on "Bob"
    s.rt.controller('back');                    // cancel
    assert.deepStrictEqual(s.screens.slice(-1).map((x) => x.screen), ['settings']);
    s.rt.controller('press');                   // keyboard again
    s.rt.touch('down', 1700, 590); s.rt.touch('up', 1700, 590);     // the keyboard's go key ('OK'), bottom right
    assert.deepStrictEqual(s.actions.slice(-1), [{ screen: 'settings', element: 'name', action: 'name', value: 'Bob' }]);
    assertShows(s.last(), 'details', 'gone', 'the linked screen');
    assert.deepStrictEqual(s.screens.slice(-1), [{ screen: 'details', from: 'settings', by: 'link' }]);
});

test('the app\'s code opening a screen while the keyboard screen is open cancels the typing', () => {
    const s = run();
    s.rt.controller('press');                   // home -> settings
    s.rt.controller('right');
    s.rt.controller('press');                   // keyboard screen
    const acted = s.actions.length;
    assert.strictEqual(s.rt.open('about'), true);
    assertShows(s.last(), 'about', null, 'about');
    s.rt.controller('back');
    assertShows(s.last(), 'settings', 'name', 'back on settings, no keyboard');
    assert.strictEqual(s.actions.length, acted, 'nothing typed is reported');
});
