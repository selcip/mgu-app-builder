'use strict';
// Seam 1 (runtime -> recording): the app's code sets what an element shows (text, toggle state, slider position,
// list rows, progress, pictures) and the next recording shows it. The expected recording of each case is the
// runtime's drawing of the same screen file with that option written into the file: what the app sets from code
// draws exactly as if the app author had put it in the screen file.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));

const fixtureText = fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'values.json'), 'utf8');
const fixture = () => JSON.parse(fixtureText);

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

function started(file) {
    const sink = bufferSink(), log = captureLog();
    const rt = createRuntime({ kit, sink, log });
    assert.strictEqual(rt.load(file || fixture()), true, log.lines.join('\n'));
    assert.strictEqual(rt.start(), true);
    return { rt, sink, log };
}

/** The first frame of a runtime started on the fixture with `edit` applied to the file's element options. */
function drawnWith(edit) {
    const file = fixture();
    const opts = {};
    for (const s of file.screens) for (const c of s.components) opts[s.name + '/' + c.name] = c.opts;
    edit(opts, file);
    return started(file).sink.frames[0];
}

const last = (sink) => sink.frames[sink.frames.length - 1];

test('setting a text element\'s text on the shown screen redraws it with that text', () => {
    const { rt, sink } = started();
    assert.strictEqual(rt.set('live', 'title', 'Lights'), true);
    assert.strictEqual(sink.frames.length, 2);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/title'].text = 'Lights'; })));
    assert.ok(!last(sink).equals(sink.frames[0]), 'the new text draws differently');
});

test('setting a toggle\'s state, or a settings row\'s switch, redraws it on or off', () => {
    const { rt, sink } = started();
    assert.strictEqual(rt.set('live', 'wifi', true), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/wifi'].on = true; })));
    assert.strictEqual(rt.set('live', 'fog', false), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/wifi'].on = true; o['live/fog'].on = false; })));
});

test('setting a slider\'s position, a settings row\'s slider or a progress bar redraws it at that value', () => {
    const { rt, sink } = started();
    assert.strictEqual(rt.set('live', 'volume', 90), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/volume'].value = 90; })));
    assert.strictEqual(rt.set('live', 'fan', 75), true);
    assert.strictEqual(rt.set('live', 'storage', 82), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/volume'].value = 90; o['live/fan'].value = 75; o['live/storage'].value = 82; })));
});

test('setting a list\'s rows, as rows or as the screen file\'s lines, redraws the list with them', () => {
    const rows = [{ badge: '4', title: 'Gearbox', sub: '0x18 · 1 active' }, { badge: '', title: 'Seats', sub: 'no faults' }];
    const { rt, sink } = started();
    assert.strictEqual(rt.set('live', 'faults', rows), true);
    // the kit draws a row's fields the same from an object as from its line in the file
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/faults'].items = '4, Gearbox, 0x18 · 1 active\n, Seats, no faults'; })));
    assert.strictEqual(rt.set('live', 'faults', '7, Doors, 0x50'), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/faults'].items = '7, Doors, 0x50'; })));
    assert.strictEqual(rt.set('live', 'faults', []), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/faults'].items = ''; })), 'no rows: the list shows its empty text');
});

test('setting a picture as PNG data redraws the picture element with it', () => {
    const { Canvas } = require(path.join(ROOT, 'kit', 'kit_canvas.js'));
    const cv = new Canvas(8, 8);
    cv.fillRect(0, 0, 8, 8, '#2f6bff');
    const png = 'data:image/png;base64,' + cv.png().toString('base64');
    const { rt, sink } = started();
    assert.strictEqual(rt.set('live', 'logo', png), true);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/logo'].src = png; })));
    assert.ok(!last(sink).equals(sink.frames[0]), 'the picture draws instead of the empty outline');
});

test('a value set before the screen is shown is drawn when it is; one set on a screen not shown draws nothing yet', () => {
    const sink = bufferSink(), log = captureLog();
    const rt = createRuntime({ kit, sink, log });
    rt.load(fixture());
    assert.strictEqual(rt.set('live', 'volume', 10), true);
    assert.strictEqual(rt.set('other', 'label', 'Later'), true);
    assert.strictEqual(sink.frames.length, 0, 'nothing is drawn before start()');
    rt.start();
    assert.strictEqual(sink.frames.length, 1);
    assert.ok(sink.frames[0].equals(drawnWith((o) => { o['live/volume'].value = 10; })));
    assert.strictEqual(rt.set('other', 'label', 'Still later'), true);
    assert.strictEqual(sink.frames.length, 1, 'the shown screen did not change');
    assert.deepStrictEqual(log.lines, []);
});

test('elements show their screen-file options again once a screen file is loaded anew', () => {
    const { rt, sink } = started();
    rt.set('live', 'title', 'Changed');
    rt.set('live', 'wifi', true);
    rt.load(fixture());
    rt.start();
    assert.ok(last(sink).equals(sink.frames[0]), 'the reloaded screen draws as the file says');
});

test('a text set from code is drawn as set in every language; the other texts follow the language', () => {
    const multi = () => {
        const f = fixture();
        f.languages = ['en', 'de'];
        const live = f.screens.find((s) => s.name === 'live');
        live.components.find((c) => c.name === 'title').opts.text = { en: 'Live data', de: 'Live-Daten' };
        live.components.find((c) => c.name === 'fog').opts.label = { en: 'Fog lights', de: 'Nebelscheinwerfer' };
        return f;
    };
    const { rt, sink } = started(multi());
    assert.strictEqual(rt.set('live', 'title', 'Lights'), true);
    assert.strictEqual(rt.setLanguage('de'), true);
    const de = drawnWith((o, f) => {
        f.languages = ['de', 'en'];
        o['live/title'].text = 'Lights';
        o['live/fog'].label = 'Nebelscheinwerfer';
    });
    assert.ok(last(sink).equals(de), 'German, with the title as the code set it');
    rt.setLanguage('en');
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/title'].text = 'Lights'; })), 'English, same title');
});

test('a value for an unknown screen or element is refused with a log line naming it, and nothing changes', () => {
    const { rt, sink, log } = started();
    assert.strictEqual(rt.set('gone', 'title', 'x'), false);
    assert.ok(log.lines.some((l) => /"gone"/.test(l) && /no screen/.test(l)), log.lines.join('\n'));
    assert.strictEqual(rt.set('live', 'nothing', 'x'), false);
    assert.ok(log.lines.some((l) => /"live"/.test(l) && /"nothing"/.test(l)), log.lines.join('\n'));
    assert.strictEqual(sink.frames.length, 1, 'nothing was drawn');
    rt.set('live', 'volume', 50);
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/volume'].value = 50; })), 'and nothing was kept');
});

test('a value an element can\'t show is refused with a log line saying why, and nothing changes', () => {
    const { rt, sink, log } = started();
    const refused = [
        ['panel', 'red', /rect.*no value/i],            // a rectangle shows no value
        ['wifi', 'yes', /on or off/],
        ['volume', '90', /number/],
        ['storage', NaN, /number/],
        ['faults', 42, /rows/],
        ['title', { a: 1 }, /text/],
        ['logo', 7, /picture/],
    ];
    for (const [element, value, why] of refused) {
        const before = log.lines.length;
        assert.strictEqual(rt.set('live', element, value), false, element);
        const said = log.lines.slice(before).join('\n');
        assert.ok(why.test(said) && said.includes('"' + element + '"'), element + ': ' + said);
    }
    assert.strictEqual(sink.frames.length, 1, 'nothing was drawn');
    rt.set('live', 'title', 42);                        // a number is text too
    assert.ok(last(sink).equals(drawnWith((o) => { o['live/title'].text = '42'; })));
});

test('every widget that shows a text, a state, a number, rows or a picture takes it as its value', () => {
    const cases = [
        // widget, value set, the option it draws as
        ['button', 'Save', 'text'], ['vbutton', 'Update', 'text'], ['field', 'Hello', 'text'], ['dropdown', 'Sport', 'text'],
        ['titleBar', 'Garage', 'title'], ['card', 'Trips', 'title'], ['tile', 'Lights', 'title'], ['qr', 'https://x.y', 'text'],
        ['choice', false, 'selected'], ['metric', 120, 'value'],
        ['appList', [{ title: 'Car Data', sub: '1.1.4', right: 'chevron', vicon: 'gauge' }], 'items'],
        ['appGrid', [{ title: 'Fault Codes', sub: 'Installed', vicon: 'wrench' }], 'items'],
        ['sideNav', 'Store, grid\nUSB, usb', 'items'],
    ];
    for (const [gpu, value, option] of cases) {
        const file = (opts) => ({ schema: 1, first: 's', design: { w: 1796, h: 632 }, screens: [
            { name: 's', theme: 'm_red', bg: 'theme', components: [{ name: 'e', gpu, x: 20, y: 20, w: 900, h: 400, opts }] }] });
        const { rt, sink, log } = started(file({}));
        assert.strictEqual(rt.set('s', 'e', value), true, gpu + ': ' + log.lines.join('\n'));
        const expected = started(file({ [option]: value })).sink.frames[0];
        assert.ok(last(sink).equals(expected), gpu + ' draws its value as ' + option);
        assert.ok(!last(sink).equals(sink.frames[0]), gpu + ': the value changed the drawing');
    }
});

test('setting a picture by its images/ path draws that PNG, as the same path in the screen file does', () => {
    const { Canvas } = require(path.join(ROOT, 'kit', 'kit_canvas.js'));
    const cv = new Canvas(8, 8);
    cv.fillRect(0, 0, 8, 8, '#27ae60');
    const files = { 'images/logo.png': cv.png() };
    const readImage = (p) => files[p] || null;
    const run = (file) => {
        const sink = bufferSink(), log = captureLog();
        const rt = createRuntime({ kit, sink, log, readImage });
        rt.load(file);
        rt.start();
        return { rt, sink, log };
    };
    const { rt, sink, log } = run(fixture());
    assert.strictEqual(rt.set('live', 'logo', 'images/logo.png'), true);
    const file = fixture();
    file.screens[0].components.find((c) => c.name === 'logo').opts.src = 'images/logo.png';
    assert.ok(last(sink).equals(run(file).sink.frames[0]));
    assert.ok(!last(sink).equals(sink.frames[0]), 'the picture draws instead of the empty outline');
    assert.deepStrictEqual(log.lines, []);
});
