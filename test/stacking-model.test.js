'use strict';
// Seam 2: the document model's stacking order (designer/src/model/ops/stacking.ts): moving elements forward, backward,
// to the front, to the back or to a drop place, several at once, as one undo step, leaving the focus order alone.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const screen = (doc) => doc.file.screens.find((s) => s.name === 'main');
const order = (doc) => screen(doc).components.map((c) => c.name);
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));
const restack = (doc, elements, place) => M.apply(doc, { type: 'restackElements', screen: 'main', elements, place });

/** main with a, b, c, d, e bottom to top (buttons renamed), and an explicit focus order. */
function five() {
    let d = M.newDocument();
    for (const n of ['a', 'b', 'c', 'd', 'e']) {
        d = edit([{ type: 'addElement', screen: 'main', widget: 'button', x: 0, y: 0, w: 100, h: 40 }], d);
        const added = screen(d).components[screen(d).components.length - 1].name;
        d = edit([{ type: 'renameElement', screen: 'main', element: added, name: n }], d);
    }
    return edit([{ type: 'setFocusOrder', screen: 'main', order: ['e', 'a', 'c'] }], d);
}

test('one element moves forward, backward, to the front and to the back', () => {
    const d = five();
    assert.deepStrictEqual(order(restack(d, ['b'], 'forward')), ['a', 'c', 'b', 'd', 'e']);
    assert.deepStrictEqual(order(restack(d, ['b'], 'backward')), ['b', 'a', 'c', 'd', 'e']);
    assert.deepStrictEqual(order(restack(d, ['b'], 'front')), ['a', 'c', 'd', 'e', 'b']);
    assert.deepStrictEqual(order(restack(d, ['d'], 'back')), ['d', 'a', 'b', 'c', 'e']);
});

test('a selection that is not contiguous keeps its relative order', () => {
    const d = five();
    assert.deepStrictEqual(order(restack(d, ['d', 'b'], 'front')), ['a', 'c', 'e', 'b', 'd']);
    assert.deepStrictEqual(order(restack(d, ['b', 'd'], 'back')), ['b', 'd', 'a', 'c', 'e']);
    assert.deepStrictEqual(order(restack(d, ['b', 'd'], 'forward')), ['a', 'c', 'b', 'e', 'd']);
    assert.deepStrictEqual(order(restack(d, ['b', 'd'], 'backward')), ['b', 'a', 'd', 'c', 'e']);
    // a run steps past one element as a block
    assert.deepStrictEqual(order(restack(d, ['b', 'c'], 'forward')), ['a', 'd', 'b', 'c', 'e']);
});

test('a drop place is an index among the elements not moved', () => {
    const d = five();
    // the rest is a, c, e: 0 = under a, 3 = over e
    assert.deepStrictEqual(order(restack(d, ['b', 'd'], 0)), ['b', 'd', 'a', 'c', 'e']);
    assert.deepStrictEqual(order(restack(d, ['b', 'd'], 2)), ['a', 'c', 'b', 'd', 'e']);
    assert.deepStrictEqual(order(restack(d, ['b', 'd'], 3)), ['a', 'c', 'e', 'b', 'd']);
    refused(() => restack(d, ['b'], 5), /stacking order/);
    refused(() => restack(d, ['b'], -1), /stacking order/);
    refused(() => restack(d, ['b'], 'up'), /stacking order/);
});

test('moving past an end changes nothing, and canRestack says so', () => {
    const d = five();
    assert.deepStrictEqual(order(restack(d, ['e'], 'forward')), order(d));
    assert.deepStrictEqual(order(restack(d, ['d', 'e'], 'front')), order(d));
    assert.deepStrictEqual(order(restack(d, ['a'], 'backward')), order(d));
    const s = screen(d);
    assert.strictEqual(M.canRestack(s, ['e'], 'forward'), false);
    assert.strictEqual(M.canRestack(s, ['d', 'e'], 'front'), false);
    assert.strictEqual(M.canRestack(s, ['a', 'b'], 'back'), false);
    assert.strictEqual(M.canRestack(s, ['a'], 'forward'), true);
    assert.strictEqual(M.canRestack(s, ['a', 'c'], 'back'), true);
    assert.strictEqual(M.canRestack(s, [], 'front'), false);
});

test('restacking leaves boxes, options and the focus order alone, and refuses unknown elements', () => {
    const d = five();
    const after = restack(d, ['a', 'c'], 'front');
    assert.deepStrictEqual(screen(after).focus, ['e', 'a', 'c']);
    const byName = (doc) => Object.fromEntries(screen(doc).components.map((c) => [c.name, c]));
    assert.deepStrictEqual(byName(after), byName(d));
    refused(() => restack(d, ['nope'], 'front'), /no element/);
});

test('a restack is one undo step', () => {
    const d = five();
    let h = M.dispatch(M.createHistory(d), { type: 'restackElements', screen: 'main', elements: ['b', 'd'], place: 'front' });
    assert.deepStrictEqual(order(h.present), ['a', 'c', 'e', 'b', 'd']);
    h = M.undo(h);
    assert.deepStrictEqual(order(h.present), ['a', 'b', 'c', 'd', 'e']);
    h = M.redo(h);
    assert.deepStrictEqual(order(h.present), ['a', 'c', 'e', 'b', 'd']);
});
