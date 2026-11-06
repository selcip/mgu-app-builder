'use strict';
// Seam 1 for editing a cluster layout's elements (ticket 05): the document model in Node. A layout goes in, an
// operation is applied, the layout comes out; undo and redo through the history; refusals leave it unchanged.
// An element is a widget of the layout's widgets[]; its name is the widget's id. Operations have the screen file's
// names (setBoxes, moveElements, deleteElements, pasteElements, restackElements, alignElements); the `screen`
// argument the shared commands pass is ignored.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const bytes = (name) => new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', name)));
const gt3 = () => M.openBytes(bytes('gt3.json'));
const ids = (doc) => doc.layout.widgets.map((w) => w.id);
const widget = (doc, id) => doc.layout.widgets.find((w) => w.id === id);
const refused = (doc, op, re) => assert.throws(() => M.apply(doc, op), (e) => e instanceof M.EditError && re.test(e.message));

test('setBoxes changes only the given parts of the widget box and leaves every other key, and its place in the key order', () => {
    const doc = gt3();
    const before = widget(doc, 'speed');
    const next = M.apply(doc, { type: 'setBoxes', boxes: { speed: { x: 100, w: 300 } } });
    const w = widget(next, 'speed');
    assert.deepStrictEqual([w.x, w.y, w.w, w.h], [100, before.y, 300, before.h]);
    assert.deepStrictEqual(Object.keys(w), Object.keys(before), 'key order kept');
    assert.deepStrictEqual({ ...w, x: before.x, w: before.w }, before, 'nothing else changed');
    assert.strictEqual(widget(doc, 'speed'), before, 'the document opened is not changed');
    assert.deepStrictEqual(ids(next), ids(doc));
});

test('a box outside the 1920x720 target is allowed; a non-positive size, a fraction or an unknown element is refused', () => {
    const doc = gt3();
    const out = M.apply(doc, { type: 'setBoxes', boxes: { speed: { x: -50, y: 900 } } });
    assert.deepStrictEqual([widget(out, 'speed').x, widget(out, 'speed').y], [-50, 900]);
    refused(doc, { type: 'setBoxes', boxes: { speed: { w: 0 } } }, /speed.*width/);
    refused(doc, { type: 'setBoxes', boxes: { speed: { h: -3 } } }, /speed.*height/);
    refused(doc, { type: 'setBoxes', boxes: { speed: { x: 1.5 } } }, /whole number/);
    refused(doc, { type: 'setBoxes', boxes: { nope: { x: 1 } } }, /no element "nope"/);
    refused(doc, { type: 'setBoxes', boxes: { speed: { x: 1 }, nope: { x: 1 } } }, /nope/);
});

test('moveElements moves several widgets by the same step in one operation', () => {
    const doc = gt3();
    const next = M.apply(doc, { type: 'moveElements', elements: ['speed', 'rpm'], dx: 5, dy: -2 });
    assert.strictEqual(widget(next, 'speed').x, widget(doc, 'speed').x + 5);
    assert.strictEqual(widget(next, 'rpm').y, widget(doc, 'rpm').y - 2);
    refused(doc, { type: 'moveElements', elements: ['speed', 'zip'], dx: 1, dy: 1 }, /zip/);
});

test('alignElements aligns to the box around the widgets, or one widget to the 1920x720 cluster', () => {
    const doc = gt3();
    const one = M.apply(doc, { type: 'alignElements', elements: ['speed'], edge: 'right' });
    assert.strictEqual(widget(one, 'speed').x + widget(one, 'speed').w, 1920);
    const many = M.apply(doc, { type: 'alignElements', elements: ['speed', 'rpm'], edge: 'left' });
    assert.strictEqual(widget(many, 'rpm').x, Math.min(widget(doc, 'speed').x, widget(doc, 'rpm').x));
    refused(doc, { type: 'alignElements', elements: ['speed'], edge: 'diagonal' }, /edge/);
});

test('deleteElements removes the widgets and nothing else, several at once', () => {
    const doc = gt3();
    const next = M.apply(doc, { type: 'deleteElements', elements: ['speed', 'rpm'] });
    assert.deepStrictEqual(ids(next), ids(doc).filter((i) => i !== 'speed' && i !== 'rpm'));
    assert.deepStrictEqual(next.layout.widgets, doc.layout.widgets.filter((w) => w.id !== 'speed' && w.id !== 'rpm'));
    refused(doc, { type: 'deleteElements', elements: ['speed', 'zip'] }, /zip/);
});

test('copyElements and pasteElements duplicate a widget with every key under a new id, on top, moved by the offset', () => {
    const doc = gt3();
    const screen = M.layoutScreen(doc.layout);
    const copy = M.copyElements(screen, ['speed']);
    assert.deepStrictEqual(M.pastedNames(screen, copy), ['speed1']);
    const next = M.apply(doc, { type: 'pasteElements', elements: copy, dx: 16, dy: 16 });
    const was = widget(doc, 'speed'), now = next.layout.widgets[next.layout.widgets.length - 1];
    assert.strictEqual(now.id, 'speed1');
    assert.deepStrictEqual({ ...now, id: 'speed', x: now.x - 16, y: now.y - 16 }, was);
    assert.deepStrictEqual(Object.keys(now), Object.keys(was));
    // pasting again: the next free name
    const again = M.apply(next, { type: 'pasteElements', elements: copy });
    assert.strictEqual(again.layout.widgets[again.layout.widgets.length - 1].id, 'speed2');
    // a copy shares nothing with the widget it came from
    now.x = 0;
    assert.notStrictEqual(widget(doc, 'speed').x, 0);
});

test('pasteElements refuses what is not an element of a cluster layout', () => {
    const doc = gt3();
    refused(doc, { type: 'pasteElements', elements: [{ name: 'b', gpu: 'button', x: 0, y: 0, w: 10, h: 10, opts: {} }] }, /cluster layout/);
    const bad = M.copyElements(M.layoutScreen(doc.layout), ['speed'])[0];
    bad.widget.w = 0;
    refused(doc, { type: 'pasteElements', elements: [bad] }, /width/);
});

test('restackElements reorders widgets[] (bottom first): forward, backward, front, back and a drop index', () => {
    const doc = gt3();
    const order = ids(doc);
    const top = order[order.length - 1];
    const front = M.apply(doc, { type: 'restackElements', elements: ['frame'], place: 'front' });
    assert.deepStrictEqual(ids(front), order.filter((i) => i !== 'frame').concat(['frame']));
    const back = M.apply(doc, { type: 'restackElements', elements: [top], place: 'back' });
    assert.strictEqual(ids(back)[0], top);
    const fwd = M.apply(doc, { type: 'restackElements', elements: ['frame'], place: 'forward' });
    assert.deepStrictEqual(ids(fwd).slice(0, 2), [order[1], 'frame']);
    const bwd = M.apply(front, { type: 'restackElements', elements: ['frame'], place: 'backward' });
    assert.strictEqual(ids(bwd)[ids(bwd).length - 2], 'frame');
    const at = M.apply(doc, { type: 'restackElements', elements: [top], place: 2 });
    assert.strictEqual(ids(at)[2], top);
    // the widgets themselves are untouched
    assert.deepStrictEqual(front.layout.widgets.find((w) => w.id === 'frame'), widget(doc, 'frame'));
    refused(doc, { type: 'restackElements', elements: ['zip'], place: 'front' }, /zip/);
    refused(doc, { type: 'restackElements', elements: ['frame'], place: 9999 }, /stacking/);
    assert.ok(!M.canRestack(M.layoutScreen(doc.layout), [top], 'front'), 'the top one cannot go further up');
    assert.ok(M.canRestack(M.layoutScreen(doc.layout), [top], 'back'));
});

test('widgets without a box are listed but cannot be moved, resized or aligned; they can be deleted and stacked', () => {
    const base = gt3();
    const layout = structuredClone(base.layout);
    layout.widgets.push({ id: 'ghost', type: 'future' });
    const doc = { ...base, layout };
    const screen = M.layoutScreen(layout);
    const g = screen.components.find((c) => c.name === 'ghost');
    assert.ok(g && g.boxless, 'listed, flagged boxless');
    refused(doc, { type: 'setBoxes', boxes: { ghost: { x: 4 } } }, /ghost.*no box/);
    refused(doc, { type: 'moveElements', elements: ['ghost'], dx: 1, dy: 1 }, /ghost.*no box/);
    refused(doc, { type: 'alignElements', elements: ['ghost'], edge: 'left' }, /ghost.*no box/);
    assert.strictEqual(ids(M.apply(doc, { type: 'restackElements', elements: ['ghost'], place: 'back' }))[0], 'ghost');
    assert.ok(!ids(M.apply(doc, { type: 'deleteElements', elements: ['ghost'] })).includes('ghost'));
});

test('each operation is one undo step, and undo and redo restore the layout exactly', () => {
    let h = M.createHistory(gt3());
    const start = h.present;
    const ops = [
        { type: 'setBoxes', boxes: { speed: { x: 90 } } },
        { type: 'deleteElements', elements: ['rpm', 'gear'] },
        { type: 'restackElements', elements: ['frame'], place: 'front' },
        { type: 'pasteElements', elements: M.copyElements(M.layoutScreen(start.layout), ['speed']), dx: 8, dy: 8 },
    ];
    const states = [start];
    for (const op of ops) { h = M.dispatch(h, op); states.push(h.present); }
    assert.strictEqual(h.past.length, ops.length);
    for (let i = ops.length - 1; i >= 0; i--) { h = M.undo(h); assert.deepStrictEqual(h.present.layout, states[i].layout); }
    for (let i = 1; i <= ops.length; i++) { h = M.redo(h); assert.deepStrictEqual(h.present.layout, states[i].layout); }
    assert.throws(() => M.dispatch(h, { type: 'deleteElements', elements: ['zip'] }), M.EditError);
    assert.strictEqual(h.past.length, ops.length, 'a refusal is no step');
});

test('the saved file differs from the opened one only where the author edited', () => {
    const doc = gt3();
    const next = M.apply(doc, { type: 'setBoxes', boxes: { speed: { x: 111 } } });
    const a = M.exportClusterLayout(doc).split('\n'), b = M.exportClusterLayout(next).split('\n');
    assert.strictEqual(a.length, b.length);
    const diff = a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y);
    assert.strictEqual(diff.length, 1);
    assert.match(diff[0][1], /"x": 111/);
});

test('the sport and M backdrop shaders are locked since ticket 12: moving them is refused (see cluster-locked-model.test.js)', () => {
    for (const [file, id] of [['sport.json', 'sport'], ['m.json', 'backdrop']]) {
        refused(M.openBytes(bytes(file)), { type: 'moveElements', elements: [id], dx: 3, dy: 0 }, /locked/);
    }
});
        assert.strictEqual(widget(next, id).x, widget(doc, id).x + 3);
    }
});
