'use strict';
// Seam 1 for locked backdrop elements (ticket 12): M's mdash and mtach and Sport's sdash open as locked elements.
// Moving, resizing or aligning one would shift the drawing against its own geometry (inside the widget the
// engine's numbers are in target pixels), so those and pasting are refused with a reason; select, stack, delete
// work; the saved file keeps every parameter exactly.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const bytes = (name) => new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', name)));
const open = (n) => M.openBytes(bytes(n));
const widget = (doc, id) => doc.layout.widgets.find((w) => w.id === id);
const refused = (doc, op, re) => assert.throws(() => M.apply(doc, op), (e) => e instanceof M.EditError && re.test(e.message));
const saved = (doc) => JSON.parse(M.exportClusterLayout(doc));
const original = (f) => JSON.parse(Buffer.from(bytes(f)).toString('utf8'));
const LOCKED = [['m.json', 'backdrop'], ['m.json', 'tach_left'], ['m.json', 'tach_right'], ['sport.json', 'sport']];

test('the whole-theme widgets are listed as locked elements, with a note on what each draws; others are not', () => {
    for (const [file, id] of LOCKED) {
        const screen = M.layoutScreen(open(file).layout);
        const el = screen.components.find((c) => c.name === id);
        assert.ok(el.locked, `${file} ${id} locked`);
        assert.match(M.lockedNote(el.gpu), /read-only|locked/i);
    }
    const m = M.layoutScreen(open('m.json').layout);
    assert.ok(!m.components.find((c) => c.name === 'speed').locked);
    assert.ok(!M.layoutScreen(open('gt3.json').layout).components.some((c) => c.locked));
});

test('move, resize, align and paste of a locked element are refused with a reason; the layout is unchanged', () => {
    for (const [file, id] of LOCKED) {
        const doc = open(file);
        refused(doc, { type: 'moveElements', elements: [id], dx: 5, dy: 0 }, /locked/);
        refused(doc, { type: 'setBoxes', boxes: { [id]: { w: 100 } } }, /locked/);
        refused(doc, { type: 'alignElements', elements: [id], edge: 'left' }, /locked/);
        const copy = M.copyElements(M.layoutScreen(doc.layout), [id]);
        refused(doc, { type: 'pasteElements', elements: copy, dx: 0, dy: 0 }, /locked/);
    }
    // a mixed selection is refused whole
    const doc = open('m.json');
    refused(doc, { type: 'moveElements', elements: ['speed', 'backdrop'], dx: 1, dy: 1 }, /locked/);
    assert.deepStrictEqual(saved(doc), original('m.json'));
});

test('assertEditable names the locked widget, for operations that would edit internals', () => {
    const doc = open('sport.json');
    assert.throws(() => M.assertEditable(widget(doc, 'sport')), (e) => e instanceof M.EditError && /sport/.test(e.message));
    M.assertEditable(widget(doc, 'speed'));
});

test('stacking and deleting work on a locked element, and leave its parameters byte-equal', () => {
    for (const [file, id] of LOCKED) {
        const doc = open(file);
        const was = JSON.stringify(widget(doc, id));
        const up = M.apply(doc, { type: 'restackElements', elements: [id], place: 'front' });
        assert.strictEqual(up.layout.widgets[up.layout.widgets.length - 1].id, id);
        assert.strictEqual(JSON.stringify(widget(up, id)), was);
        const gone = M.apply(doc, { type: 'deleteElements', elements: [id] });
        assert.ok(!widget(gone, id));
    }
});

test('M and Sport saved after editing another element equal the file but for that edit', () => {
    for (const file of ['m.json', 'sport.json']) {
        const doc = open(file);
        assert.strictEqual(JSON.stringify(saved(doc)), JSON.stringify(original(file)), 'key order too');
        const next = M.apply(doc, { type: 'moveElements', elements: ['speed'], dx: 3, dy: 0 });
        const was = original(file), now = saved(next);
        was.widgets.find((w) => w.id === 'speed').x += 3;
        assert.deepStrictEqual(now, was);
    }
});
