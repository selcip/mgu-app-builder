'use strict';
// The editing commands the menus and keys share (designer/src/shell/commands.ts), on an editor store without React:
// copy, cut, paste (a step further each time on the same screen), duplicate, delete, select all, arrow nudges and
// resizes, guides.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SRC = path.join(__dirname, '..', 'designer', 'src');
let C, S;
before(async () => {
    C = await import(pathToFileURL(path.join(SRC, 'shell', 'commands.ts')).href);
    S = await import(pathToFileURL(path.join(SRC, 'store', 'editor.ts')).href);
});

function store() {
    const st = S.createEditorStore();
    for (const op of [
        { type: 'addElement', screen: 'main', widget: 'button', name: 'a', x: 100, y: 100 },
        { type: 'addElement', screen: 'main', widget: 'button', name: 'b', x: 600, y: 100 },
        { type: 'addScreen', name: 'other' },
    ]) assert.ok(st.getState().edit(op));
    return st;
}
const names = (st) => S.screenOf(st.getState()).components.map((c) => c.name);
const box = (st, n) => { const c = S.screenOf(st.getState()).components.find((x) => x.name === n); return [c.x, c.y, c.w, c.h]; };

test('nothing selected: the commands do nothing', () => {
    const st = store();
    const h = st.getState().history;
    assert.deepStrictEqual([C.copy(st), C.cut(st), C.paste(st), C.duplicate(st), C.deleteSelection(st), C.nudge(st, 'ArrowLeft', false, false)],
        [false, false, false, false, false, false]);
    assert.strictEqual(st.getState().history, h);
});

test('copy and paste: each paste on the same screen a step further, selected; on another screen in place', () => {
    const st = store();
    st.getState().select(['a']);
    assert.ok(C.copy(st));
    assert.ok(C.paste(st));
    assert.deepStrictEqual(st.getState().selection, ['a1']);
    assert.deepStrictEqual(box(st, 'a1').slice(0, 2), [116, 116]);
    assert.ok(C.paste(st));
    assert.deepStrictEqual(box(st, st.getState().selection[0]).slice(0, 2), [132, 132]);
    st.getState().selectScreen('other');
    assert.ok(C.paste(st));
    assert.deepStrictEqual(box(st, 'a').slice(0, 2), [100, 100]);
});

test('cut removes the selection and keeps it to paste; delete removes it; select all selects every element', () => {
    const st = store();
    st.getState().select(['a', 'b']);
    assert.ok(C.cut(st));
    assert.deepStrictEqual(names(st), []);
    assert.deepStrictEqual(st.getState().selection, []);
    assert.ok(C.paste(st));
    assert.deepStrictEqual(names(st), ['a', 'b']);
    C.selectAll(st);
    assert.deepStrictEqual(st.getState().selection, ['a', 'b']);
    st.getState().select(['b']);
    assert.ok(C.deleteSelection(st));
    assert.deepStrictEqual(names(st), ['a']);
});

test('duplicate puts copies a step down and right, selected, and leaves the clipboard alone', () => {
    const st = store();
    st.getState().select(['b']);
    assert.ok(C.duplicate(st));
    assert.deepStrictEqual(st.getState().selection, ['b1']);
    assert.deepStrictEqual(box(st, 'b1').slice(0, 2), [616, 116]);
    assert.strictEqual(st.getState().clipboard, null);
});

test('arrows move by 1 px, with Shift by the grid step (10 without a grid), with Alt resize', () => {
    const st = store();
    st.getState().select(['a']);
    const [x, y, w, h] = box(st, 'a');
    C.nudge(st, 'ArrowRight', false, false);
    C.nudge(st, 'ArrowDown', true, false);                  // grid 8
    assert.deepStrictEqual(box(st, 'a'), [x + 1, y + 8, w, h]);
    st.getState().setSettings({ ...st.getState().settings, grid: 0 });
    C.nudge(st, 'ArrowLeft', true, false);
    assert.deepStrictEqual(box(st, 'a'), [x - 9, y + 8, w, h]);
    C.nudge(st, 'ArrowRight', false, true);
    C.nudge(st, 'ArrowUp', false, true);
    assert.deepStrictEqual(box(st, 'a'), [x - 9, y + 8, w + 1, h - 1]);
});

test('guides go across the middle of the screen, and clear', () => {
    const st = store();
    C.addGuide(st, 'xs');
    C.addGuide(st, 'ys');
    assert.deepStrictEqual(st.getState().settings.guides, { xs: [898], ys: [316] });
    C.clearGuides(st);
    assert.deepStrictEqual(st.getState().settings.guides, { xs: [], ys: [] });
});

test('stacking: forward, backward, front and back on the selection; nothing at an end, and no undo step', () => {
    const st = store();
    assert.ok(st.getState().edit({ type: 'addElement', screen: 'main', widget: 'button', name: 'c', x: 100, y: 300 }));
    assert.strictEqual(C.stackableOf(st.getState()), '0000', 'nothing selected');
    st.getState().select(['a']);
    // STACKING lists front, forward, backward, back
    assert.deepStrictEqual(C.STACKING.map((c) => c.place), ['front', 'forward', 'backward', 'back']);
    assert.strictEqual(C.stackableOf(st.getState()), '1100');
    const h = st.getState().history;
    assert.strictEqual(C.stack(st, 'back'), false);
    assert.strictEqual(st.getState().history, h);
    assert.ok(C.stack(st, 'forward'));
    assert.deepStrictEqual(names(st), ['b', 'a', 'c']);
    assert.ok(C.stack(st, 'front'));
    assert.deepStrictEqual(names(st), ['b', 'c', 'a']);
    assert.strictEqual(C.stackableOf(st.getState()), '0011');
    st.getState().select(['a', 'b']);
    assert.ok(C.stack(st, 'back'));
    assert.deepStrictEqual(names(st), ['b', 'a', 'c']);
    assert.strictEqual(C.stack(st, 5), false, 'a drop place past the end');
    assert.ok(C.stack(st, 1));
    assert.deepStrictEqual(names(st), ['c', 'b', 'a']);
    st.getState().undo();
    assert.deepStrictEqual(names(st), ['b', 'a', 'c']);
});
