'use strict';
// Distributing elements (designer/src/canvas/arrange.ts): three or more are spaced with equal gaps between the
// outermost two, which stay where they are; fewer than three can't be distributed.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let A;
before(async () => { A = await import(pathToFileURL(path.join(__dirname, '..', 'designer', 'src', 'canvas', 'arrange.ts')).href); });

const el = (name, x, y, w, h) => ({ name, rtype: 'gpu', gpu: 'rect', x, y, w, h });
const screen = { name: 's', components: [el('a', 0, 0, 100, 50), el('c', 900, 300, 100, 50), el('b', 200, 100, 200, 80), el('x', 50, 500, 10, 10)] };

test('across: equal gaps between the outermost two, which stay put', () => {
    // span 0..1000, sizes 100 + 200 + 100: gaps of 300
    assert.deepStrictEqual(A.distribute(screen, ['a', 'b', 'c'], 'across'), { a: { x: 0 }, b: { x: 400 }, c: { x: 900 } });
});

test('down: by y, with the elements\' heights', () => {
    // span 0..350, heights 50 + 80 + 50: gaps of 85
    assert.deepStrictEqual(A.distribute(screen, ['c', 'a', 'b'], 'down'), { a: { y: 0 }, b: { y: 135 }, c: { y: 300 } });
});

test('fewer than three named elements of the screen: nothing to distribute', () => {
    assert.strictEqual(A.distribute(screen, ['a', 'b'], 'across'), null);
    assert.strictEqual(A.distribute(screen, ['a', 'b', 'nope'], 'across'), null);
});
