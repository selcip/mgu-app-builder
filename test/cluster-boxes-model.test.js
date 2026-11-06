'use strict';
// Seam 1 for the boxes inside GT3's frame (ticket 07): the document model in Node. Each entry of a boxes widget's
// `boxes` array is an element, a child of the widget named "<widget id>/<box id>"; edits write into that array only.
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
const frame = (doc) => doc.layout.widgets.find((w) => w.id === 'frame');
const boxOf = (doc, id) => frame(doc).boxes.find((b) => b.id === id);
const refused = (doc, op, re) => assert.throws(() => M.apply(doc, op), (e) => e instanceof M.EditError && re.test(e.message));
const children = (doc) => M.layoutScreen(doc.layout).components.filter((c) => c.parent === 'frame');

test('the engine draws as many boxes as the shader holds, and MAX_BOXES says so', () => {
    const shaders = fs.readFileSync(path.join(ROOT, 'engine', 'shared', 'shaders.js'), 'utf8');
    const hud = fs.readFileSync(path.join(ROOT, 'engine', 'shared', 'hud.js'), 'utf8');
    assert.strictEqual(Number(/uniform vec4 u_box\[(\d+)\]/.exec(shaders)[1]), M.MAX_BOXES);
    assert.ok(hud.includes('.slice(0, ' + M.MAX_BOXES + ')'), 'the engine slices the list to the same number');
});

test('each box of the frame is an element, a child of the frame, right after it', () => {
    const doc = gt3();
    const s = M.layoutScreen(doc.layout);
    const names = s.components.map((c) => c.name);
    const at = names.indexOf('frame');
    const kids = frame(doc).boxes.map((b) => 'frame/' + b.id);
    assert.deepStrictEqual(names.slice(at + 1, at + 1 + kids.length), kids);
    const speed = s.components.find((c) => c.name === 'frame/speed_box');
    assert.deepStrictEqual([speed.x, speed.y, speed.w, speed.h, speed.parent], [120, 210, 280, 210, 'frame']);
    assert.strictEqual(M.layoutScreen(doc.layout), s, 'the same layout gives the same screen');
});

test('move and resize write into the box only; every other key and the key order stay', () => {
    const doc = gt3();
    const before = structuredClone(boxOf(doc, 'speed_box'));
    const moved = M.apply(doc, { type: 'moveElements', elements: ['frame/speed_box'], dx: 10, dy: -5 });
    const resized = M.apply(moved, { type: 'setBoxes', boxes: { 'frame/speed_box': { w: 300, h: 100 } } });
    const b = boxOf(resized, 'speed_box');
    assert.deepStrictEqual([b.x, b.y, b.w, b.h], [130, 205, 300, 100]);
    assert.deepStrictEqual(Object.keys(b), Object.keys(before));
    assert.deepStrictEqual({ ...b, x: before.x, y: before.y, w: before.w, h: before.h }, before);
    const rest = structuredClone(resized.layout);
    rest.widgets.find((w) => w.id === 'frame').boxes = frame(doc).boxes;
    assert.deepStrictEqual(rest, doc.layout, 'nothing outside the box changed');
    assert.deepStrictEqual(boxOf(doc, 'speed_box'), before, 'the document opened is not changed');
    refused(doc, { type: 'setBoxes', boxes: { 'frame/speed_box': { w: 0 } } }, /width/);
    refused(doc, { type: 'moveElements', elements: ['frame/nope'], dx: 1, dy: 1 }, /no element/);
});

test('add puts a box on top under a unique id, one undo step; past the limit it is refused with a reason', () => {
    let doc = gt3();
    const n0 = frame(doc).boxes.length;
    const h0 = M.createHistory(doc);
    const h1 = M.dispatch(h0, { type: 'addBox', widget: 'frame' });
    const added = frame(h1.present).boxes;
    assert.strictEqual(added.length, n0 + 1);
    const id = added[n0].id;
    assert.ok(!frame(doc).boxes.some((b) => b.id === id), 'a new id');
    assert.strictEqual(children(h1.present).at(-1).name, 'frame/' + id);
    assert.deepStrictEqual(M.undo(h1).present, doc, 'undo restores');
    doc = h1.present;
    while (frame(doc).boxes.length < M.MAX_BOXES) doc = M.apply(doc, { type: 'addBox', widget: 'frame' });
    assert.strictEqual(new Set(frame(doc).boxes.map((b) => b.id)).size, M.MAX_BOXES, 'ids stay unique');
    refused(doc, { type: 'addBox', widget: 'frame' }, new RegExp('at most ' + M.MAX_BOXES));
    refused(gt3(), { type: 'addBox', widget: 'speed' }, /not a boxes widget/);
});

test('delete takes the box out of the widget; deleting the widget takes its boxes with it', () => {
    const doc = gt3();
    const n0 = frame(doc).boxes.length;
    const one = M.apply(doc, { type: 'deleteElements', elements: ['frame/rpm_box'] });
    assert.strictEqual(frame(one).boxes.length, n0 - 1);
    assert.ok(!boxOf(one, 'rpm_box'));
    assert.strictEqual(one.layout.widgets.length, doc.layout.widgets.length);
    const both = M.apply(doc, { type: 'deleteElements', elements: ['frame/rpm_box', 'frame'] });
    assert.strictEqual(both.layout.widgets.length, doc.layout.widgets.length - 1);
    assert.ok(!both.layout.widgets.some((w) => w.id === 'frame'));
    const names = M.layoutScreen(both.layout).components.map((c) => c.name);
    assert.ok(!names.some((n) => n.startsWith('frame/')));
});

test('reorder restacks a box among the widget boxes only, and the widgets are not reordered', () => {
    const doc = gt3();
    const ids = frame(doc).boxes.map((b) => b.id);
    const top = M.apply(doc, { type: 'restackElements', elements: ['frame/speed_box'], place: 'front' });
    assert.deepStrictEqual(frame(top).boxes.map((b) => b.id), ids.filter((i) => i !== 'speed_box').concat('speed_box'));
    assert.deepStrictEqual(top.layout.widgets.map((w) => w.id), doc.layout.widgets.map((w) => w.id));
    const sel = M.layoutScreen(doc.layout);
    assert.ok(M.canRestack(M.stackScope(sel, ['frame/speed_box']), ['frame/speed_box'], 'front'));
    const first = 'frame/' + ids[0];
    assert.ok(!M.canRestack(M.stackScope(sel, [first]), [first], 'back'), 'the bottom box cannot go lower');
    refused(doc, { type: 'restackElements', elements: ['frame/speed_box', 'speed'], place: 'front' }, /./);
    const w = M.apply(doc, { type: 'restackElements', elements: ['speed'], place: 'back' });
    assert.strictEqual(w.layout.widgets[0].id, 'speed');
});

test('saving a layout whose boxes were not touched gives the file as it was; the parent still moves alone', () => {
    const doc = gt3();
    const out = M.exportDocument(doc);
    const text = Buffer.from(out.bytes || out).toString('utf8');
    assert.deepStrictEqual(JSON.parse(text), JSON.parse(Buffer.from(bytes('gt3.json')).toString('utf8')));
    const moved = M.apply(doc, { type: 'moveElements', elements: ['frame'], dx: 3, dy: 0 });
    assert.strictEqual(frame(moved).x, 3);
    assert.deepStrictEqual(frame(moved).boxes, frame(doc).boxes, 'moving the parent leaves the boxes');
});
