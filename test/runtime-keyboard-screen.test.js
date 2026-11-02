'use strict';
// Seam 1 (runtime -> recording): selecting a field opens the runtime's keyboard screen, the Store's "type" screen in
// its iDrive 7 compact layout without the Store's side rail: a round back button, a title (the field's label), the
// text box with the field's text and the word keyboard with its symbols page under it. The driver types with the
// controller or by touch; the Enter key ('OK') returns to the field's screen and reports the typed text as the
// field's action value, BACK (or the back button) returns and reports nothing.
//
// Expected frames are the kit's own recording of the keyboard screen written out below by hand from the Store's
// layout (store_compact.js: margin 14, header 64, text box 64 high, 16 px gap, keyboard to the bottom margin),
// plus the focus ring; key boxes are worked out from the kit's word keyboard (5 rows, 16 px gaps).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { OP, pack } = require(path.join(ROOT, 'kit', 'kit_record.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));

const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'text-entry.json'), 'utf8'));
const MAIN = FILE.screens[0];

function start(file) {
    const frames = [], actions = [], lines = [];
    const put = (m) => lines.push(String(m));
    const rt = createRuntime({
        kit,
        log: { error: put, warn: put, info: put },
        sink: { frame(rec) { const w = rec.words(); frames.push(Uint32Array.from(w)); return true; } },
    });
    rt.on('action', (a) => actions.push(a));
    assert.ok(rt.load(file || FILE), lines.join('\n'));
    rt.start();
    return { rt, frames, actions, lines, last: () => frames[frames.length - 1] };
}

function kitOnly(screen) {
    const rec = kit.record(screen, { textScale: 1, design: { w: 1796, h: 632 }, area: { x: 0, y: 0, w: 1796, h: 632 } });
    return Uint32Array.from(rec.words());
}

/** The keyboard screen as the Store lays it out at 1796 x 632, with `text` in the box and `title` over it. */
function keyboardScreen(text, title, keys) {
    return {
        kind: 'gpu', name: 'main', theme: 'm_red', bg: 'theme',
        components: [
            { name: 'back', rtype: 'gpu', gpu: 'vbutton', x: 14, y: 14, w: 64, h: 64, opts: { text: '', vicon: 'back', style: 'round', color: '#f4f7fb' } },
            { name: 'title', rtype: 'gpu', gpu: 'text', x: 98, y: 16, w: 1684, h: 60, opts: { text: title, size: 50, font: 'bold', align: 'left', color: 'text' } },
            { name: 'field', rtype: 'gpu', gpu: 'field', x: 14, y: 92, w: 1768, h: 64, opts: { text: text, caret: true, focus: true, size: 30 } },
            { name: 'keyboard', rtype: 'gpu', gpu: 'keyboard', x: 14, y: 172, w: 1768, h: 446,
                opts: Object.assign({ layout: 'text', symbols: true, sym: false, shift: false, go: 'OK' }, keys || {}) },
        ],
    };
}

const f32 = Math.fround;
/** Row 0 of the word keyboard: ten keys 162.4 wide, 76.4 high (446 - 4 * 16 over 5 rows), from x 14, y 172. */
const KEY_1 = { x: 14, y: 172, w: 162.4, h: 76.4, r: 18 };
const BACK = { x: 14, y: 14, w: 64, h: 64, r: 32 };
const FIELD = { x: 40, y: 150, w: 1000, h: 100, r: 14 };

/** `frame` must be `base` followed by one focus ring 8 px outside `box`. */
function assertFrame(frame, base, box, what) {
    assert.deepStrictEqual(Array.from(frame.subarray(0, base.length)), Array.from(base), what + ': the screen is drawn as the kit draws it');
    assert.strictEqual(frame.length, base.length + 8, what + ': one ring after the screen');
    const f = new Float32Array(frame.buffer, frame.byteOffset + base.length * 4, 8);
    assert.strictEqual(frame[base.length], OP.RSTROKE);
    assert.deepStrictEqual([f[1], f[2], f[3], f[4], f[5], f[6]],
        [f32(box.x - 8), f32(box.y - 8), f32(box.w + 16), f32(box.h + 16), f32(box.r + 8), 5], what + ': ring');
    assert.strictEqual(frame[base.length + 7], pack('#ffffff'));
}

const right = (s, n) => { for (let i = 0; i < n; i++) s.rt.controller('right'); };

test('pressing a field opens the keyboard screen with its text and label, highlight on the first key', () => {
    const s = start();
    s.rt.controller('press');       // the field is first in reading order
    assertFrame(s.last(), kitOnly(keyboardScreen('Bob', 'Driver name')), KEY_1, 'keyboard screen');
    assert.deepStrictEqual(s.actions, [], 'opening the keyboard reports nothing');
});

/** The field's screen with the field showing `text`. */
function mainWith(text) {
    const m = JSON.parse(JSON.stringify(MAIN));
    m.components[1].opts = { text: text, label: 'Driver name' };
    return m;
}

test('typing with the controller and pressing OK returns to the field and reports the text as its action value', () => {
    const s = start();
    s.rt.controller('press');
    right(s, 10);                   // 'q', the first key of the second row
    s.rt.controller('press');
    assertFrame(s.last(), kitOnly(keyboardScreen('Bobq', 'Driver name')), { x: 14, y: 264.4, w: 162.4, h: 76.4, r: 18 }, 'typed q');
    right(s, 35);                   // OK: the last key (46 keys: 10, 10, 10, 10, 6)
    s.rt.controller('press');
    assertFrame(s.last(), kitOnly(mainWith('Bobq')), FIELD, 'back on the field');
    assert.deepStrictEqual(s.actions, [{ screen: 'main', element: 'name', action: 'rename', value: 'Bobq' }]);
});

test('BACK on the keyboard screen cancels: back on the field, nothing reported, its text unchanged', () => {
    const s = start();
    s.rt.controller('press');
    right(s, 10);
    s.rt.controller('press');
    s.rt.controller('back');
    assertFrame(s.last(), kitOnly(mainWith('Bob')), FIELD, 'back on the field');
    assert.deepStrictEqual(s.actions, []);
    s.rt.controller('right');       // the screen's own highlight moves again: to save
    s.rt.controller('press');
    assert.deepStrictEqual(s.actions, [{ screen: 'main', element: 'save', action: 'save' }]);
});

test('the back button after the last key cancels too', () => {
    const s = start();
    s.rt.controller('press');
    right(s, 50);                   // stops on the back button
    assertFrame(s.last(), kitOnly(keyboardScreen('Bob', 'Driver name')), BACK, 'highlight on back');
    s.rt.controller('press');
    assertFrame(s.last(), kitOnly(mainWith('Bob')), FIELD, 'back on the field');
    assert.deepStrictEqual(s.actions, []);
});

test('by touch: a tap on the field opens the keyboard, taps type, a tap on OK confirms', () => {
    const s = start();
    s.rt.touch('down', 500, 200);
    s.rt.touch('up', 500, 200);
    assertFrame(s.last(), kitOnly(keyboardScreen('Bob', 'Driver name')), KEY_1, 'keyboard screen');
    const tap = (x, y) => { s.rt.touch('down', x, y); s.rt.touch('up', x, y); };
    tap(100, 210);                  // '1'
    tap(1700, 580);                 // OK, bottom right
    assertFrame(s.last(), kitOnly(mainWith('Bob1')), FIELD, 'back on the field');
    assert.deepStrictEqual(s.actions, [{ screen: 'main', element: 'name', action: 'rename', value: 'Bob1' }]);
    tap(500, 200);
    tap(40, 40);                    // the back button
    assert.deepStrictEqual(s.actions.length, 1, 'cancel reports nothing');
    assertFrame(s.last(), kitOnly(mainWith('Bob1')), FIELD, 'back on the field after cancel');
});

test('Shift types a capital, Delete removes the last character, #+= switches to the symbols page', () => {
    const s = start();
    s.rt.controller('press');
    right(s, 30);                   // Shift: first key of the fourth row, 1.3 keys wide of 10.3
    s.rt.controller('press');
    const SHIFT = { x: 14, y: 449.2, w: (1768 - 9 * 16) / 10.3 * 1.3, h: 76.4, r: 18 };
    assertFrame(s.last(), kitOnly(keyboardScreen('Bob', 'Driver name', { shift: true })), SHIFT, 'shift on');
    right(s, 1);                    // 'z', shown as 'Z'
    s.rt.controller('press');
    s.rt.controller('left', 2);     // Delete: the last key of the third row
    s.rt.controller('press');
    s.rt.controller('press');
    assertFrame(s.last(), kitOnly(keyboardScreen('Bo', 'Driver name', { shift: true })),
        { x: 14 + 9 * ((1768 - 9 * 16) / 10.3 + 16), y: 356.8, w: (1768 - 9 * 16) / 10.3 * 1.3, h: 76.4, r: 18 }, 'BobZ, then two deletes');
    right(s, 11);                   // '#+=': first key of the last row
    s.rt.controller('press');
    s.rt.controller('left', 30);    // '!': first key of the symbols page's second row
    s.rt.controller('press');
    s.rt.controller('right', 35);   // OK
    s.rt.controller('press');
    assert.deepStrictEqual(s.actions, [{ screen: 'main', element: 'name', action: 'rename', value: 'Bo!' }]);
});

test('the keyboard opens with the text set from code and titles in the active language', () => {
    const s = start();
    s.rt.setLanguage('de');
    s.rt.set('main', 'name', 'Anna');
    s.rt.controller('press');
    assertFrame(s.last(), kitOnly(keyboardScreen('Anna', 'Fahrername')), KEY_1, 'keyboard screen in German');
});

test('a value set from code while typing does not draw over the keyboard screen; the field shows it afterwards', () => {
    const s = start();
    s.rt.controller('press');
    const n = s.frames.length;
    s.rt.set('main', 'name', 'Carl');
    assert.strictEqual(s.frames.length, n, 'no frame of the field screen while the keyboard is open');
    s.rt.controller('back');
    assertFrame(s.last(), kitOnly(mainWith('Carl')), FIELD, 'back on the field');
});
