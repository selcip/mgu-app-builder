'use strict';
// The editing commands the menus and keys share, on the editor store with a cluster layout open (ticket 05): the
// same selection, copy, paste, duplicate, delete, nudge and stacking commands as for screens, each one undo step.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'designer', 'src');
let C, S, M;
before(async () => {
    C = await import(pathToFileURL(path.join(SRC, 'shell', 'commands.ts')).href);
    S = await import(pathToFileURL(path.join(SRC, 'store', 'editor.ts')).href);
    M = await import(pathToFileURL(path.join(SRC, 'model', 'index.ts')).href);
});

const open = () => {
    const doc = M.openBytes(new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', 'gt3.json'))));
    return S.createEditorStore(doc);
};
const ids = (st) => S.layoutOf(st.getState()).widgets.map((w) => w.id);
const widget = (st, id) => S.layoutOf(st.getState()).widgets.find((w) => w.id === id);
const steps = (st) => st.getState().history.past.length;

test('the layout is listed as elements named by widget id, bottom first, with kind and box', () => {
    const st = open();
    const screen = S.screenOf(st.getState());
    assert.deepStrictEqual(screen.components.map((c) => c.name), ids(st));
    const speed = screen.components.find((c) => c.name === 'speed');
    assert.deepStrictEqual([speed.gpu, speed.x, speed.y, speed.w, speed.h], ['text', 128, 268, 206, 93]);
});

test('select, nudge: arrows move the selection 1 px, Shift a grid step, Alt resizes; one undo step each', () => {
    const st = open();
    st.getState().select(['speed', 'rpm']);
    const x = widget(st, 'speed').x;
    assert.ok(C.nudge(st, 'ArrowRight', false, false));
    assert.strictEqual(widget(st, 'speed').x, x + 1);
    assert.ok(C.nudge(st, 'ArrowDown', true, false));
    assert.strictEqual(steps(st), 2);
    st.getState().select(['speed']);
    const w = widget(st, 'speed').w;
    assert.ok(C.nudge(st, 'ArrowRight', false, true));
    assert.strictEqual(widget(st, 'speed').w, w + 1);
    st.getState().undo();
    assert.strictEqual(widget(st, 'speed').w, w);
    assert.deepStrictEqual(st.getState().selection, ['speed'], 'the selection survives undo');
});

test('delete removes the selection and clears it; undo brings the widgets back in place', () => {
    const st = open();
    const order = ids(st);
    st.getState().select(['speed', 'rpm']);
    assert.ok(C.deleteSelection(st));
    assert.ok(!ids(st).includes('speed') && !ids(st).includes('rpm'));
    assert.deepStrictEqual(st.getState().selection, []);
    st.getState().undo();
    assert.deepStrictEqual(ids(st), order);
    st.getState().redo();
    assert.ok(!ids(st).includes('speed'));
});

test('duplicate selects the copies, a step down and right, under free ids; copy and paste go a step further each time', () => {
    const st = open();
    st.getState().select(['speed']);
    assert.ok(C.duplicate(st));
    assert.deepStrictEqual(st.getState().selection, ['speed1']);
    assert.strictEqual(widget(st, 'speed1').x, widget(st, 'speed').x + 16);
    assert.strictEqual(ids(st)[ids(st).length - 1], 'speed1');
    assert.strictEqual(steps(st), 1);
    st.getState().select(['rpm']);
    assert.ok(C.copy(st));
    assert.ok(C.paste(st));
    assert.ok(C.paste(st));
    assert.deepStrictEqual(ids(st).slice(-2), ['rpm1', 'rpm2']);
    assert.strictEqual(widget(st, 'rpm2').x - widget(st, 'rpm').x, 32);
    assert.deepStrictEqual(st.getState().selection, ['rpm2']);
    assert.ok(C.cut(st) === true);
    assert.ok(!ids(st).includes('rpm2'));
});

test('elements of a screen file are not pasted into a layout, nor the other way', () => {
    const screens = S.createEditorStore();
    assert.ok(screens.getState().edit({ type: 'addElement', screen: 'main', widget: 'button', name: 'a', x: 1, y: 1 }));
    screens.getState().select(['a']);
    assert.ok(C.copy(screens));
    const st = open();
    st.getState().setClipboard(screens.getState().clipboard);
    assert.strictEqual(C.paste(st), false);
    assert.strictEqual(steps(st), 0);
    st.getState().select(['speed']);
    C.copy(st);
    screens.getState().setClipboard(st.getState().clipboard);
    assert.strictEqual(C.paste(screens), false);
});

test('stacking: the four commands and a drop index reorder widgets[]; a no-op makes no step', () => {
    const st = open();
    const order = ids(st);
    st.getState().select(['frame']);
    assert.ok(C.canStack(st.getState(), 'front'));
    assert.ok(!C.canStack(st.getState(), 'back'), 'frame is already at the bottom');
    assert.strictEqual(C.stack(st, 'back'), false);
    assert.strictEqual(steps(st), 0);
    assert.ok(C.stack(st, 'front'));
    assert.strictEqual(ids(st)[ids(st).length - 1], 'frame');
    assert.ok(C.stack(st, 'back'));
    assert.deepStrictEqual(ids(st), order);
    assert.ok(C.stack(st, 'forward'));
    assert.strictEqual(ids(st)[1], 'frame');
    assert.ok(C.stack(st, 'backward'));
    assert.ok(C.stack(st, 3));
    assert.strictEqual(ids(st)[3], 'frame');
    assert.strictEqual(steps(st), 5);
});

test('select all selects every widget; a refused edit sets the problem and changes nothing', () => {
    const st = open();
    C.selectAll(st);
    assert.strictEqual(st.getState().selection.length, ids(st).length);
    assert.strictEqual(st.getState().edit({ type: 'setBoxes', boxes: { speed: { w: 0 } } }), null);
    assert.match(st.getState().problem, /speed/);
    assert.strictEqual(steps(st), 0);
});
