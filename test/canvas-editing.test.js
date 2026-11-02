'use strict';
// Seam 2: the document model's canvas edits (designer/src/model/ops/canvas.ts): moving and resizing elements,
// several at once, aligning, deleting and pasting them, and undoing each as one step. Plus the canvas's snapping
// (designer/src/canvas/snap.ts), a pure function of a box and the lines it can snap to.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M, S;
before(async () => {
    M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
    S = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'canvas', 'snap.ts')).href);
});

const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const screen = (doc, name) => doc.file.screens.find((s) => s.name === name);
const el = (doc, s, name) => screen(doc, s).components.find((c) => c.name === name);
const box = (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h });
const elNames = (doc, s) => screen(doc, s).components.map((c) => c.name);
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));

/** main with button1 at 100,50 and toggle1 at 600,300 (catalog sizes). */
const two = () => edit([
    { type: 'addElement', screen: 'main', widget: 'button', x: 100, y: 50, w: 300, h: 80 },
    { type: 'addElement', screen: 'main', widget: 'toggle', x: 600, y: 300, w: 100, h: 60 },
]);

test('typed or dragged boxes set the x, y, width and height of one or several elements at once', () => {
    const d = M.apply(two(), { type: 'setBoxes', screen: 'main', boxes: {
        button1: { x: 20, y: 30, w: 400, h: 90 }, toggle1: { x: 640 },
    } });
    assert.deepStrictEqual(box(el(d, 'main', 'button1')), { x: 20, y: 30, w: 400, h: 90 });
    assert.deepStrictEqual(box(el(d, 'main', 'toggle1')), { x: 640, y: 300, w: 100, h: 60 });
});

test('a box must be whole pixels with no negative size, on elements that exist', () => {
    const d = two();
    const set = (b) => () => M.apply(d, { type: 'setBoxes', screen: 'main', boxes: { button1: b } });
    refused(set({ x: 1.5 }), /whole/);
    refused(set({ w: -1 }), /negative/);
    refused(set({ y: 'a' }), /whole/);
    refused(() => M.apply(d, { type: 'setBoxes', screen: 'main', boxes: { nope: { x: 1 } } }), /no element/);
    // a line is 0 high
    assert.strictEqual(el(M.apply(d, { type: 'setBoxes', screen: 'main', boxes: { button1: { h: 0 } } }), 'main', 'button1').h, 0);
});

test('the arrow keys move every selected element by the same step', () => {
    const d = M.apply(two(), { type: 'moveElements', screen: 'main', elements: ['button1', 'toggle1'], dx: -8, dy: 1 });
    assert.deepStrictEqual(box(el(d, 'main', 'button1')), { x: 92, y: 51, w: 300, h: 80 });
    assert.deepStrictEqual(box(el(d, 'main', 'toggle1')), { x: 592, y: 301, w: 100, h: 60 });
    refused(() => M.apply(two(), { type: 'moveElements', screen: 'main', elements: ['nope'], dx: 1, dy: 0 }), /no element/);
    refused(() => M.apply(two(), { type: 'moveElements', screen: 'main', elements: ['button1'], dx: 0.5, dy: 0 }), /whole/);
});

test('selected elements align to the edges or centre of the box around them; one element aligns to the screen', () => {
    // button1 100,50 300x80 (right 400, bottom 130); toggle1 600,300 100x60 (right 700, bottom 360)
    const align = (edge, elements, doc) => {
        const d = M.apply(doc || two(), { type: 'alignElements', screen: 'main', elements: elements || ['button1', 'toggle1'], edge });
        return [box(el(d, 'main', 'button1')), box(el(d, 'main', 'toggle1'))].map((b) => [b.x, b.y]);
    };
    assert.deepStrictEqual(align('left'), [[100, 50], [100, 300]]);
    assert.deepStrictEqual(align('right'), [[400, 50], [600, 300]]);
    assert.deepStrictEqual(align('centre'), [[250, 50], [350, 300]]);
    assert.deepStrictEqual(align('top'), [[100, 50], [600, 50]]);
    assert.deepStrictEqual(align('bottom'), [[100, 280], [600, 300]]);
    assert.deepStrictEqual(align('middle'), [[100, 165], [600, 175]]);
    // alone: to the 1796 x 632 screen
    assert.deepStrictEqual(align('right', ['toggle1']), [[100, 50], [1696, 300]]);
    assert.deepStrictEqual(align('middle', ['toggle1']), [[100, 50], [600, 286]]);
    refused(() => align('diagonal'), /edge/);
});

test('several selected elements are deleted together, and leave the focus order', () => {
    let d = edit([{ type: 'addElement', screen: 'main', widget: 'slider' }], two());
    d = { file: Object.assign({}, d.file, { screens: [Object.assign({}, d.file.screens[0], { focus: ['slider1', 'toggle1', 'button1'] })] }), images: {} };
    d = M.apply(d, { type: 'deleteElements', screen: 'main', elements: ['button1', 'toggle1'] });
    assert.deepStrictEqual(elNames(d, 'main'), ['slider1']);
    assert.deepStrictEqual(screen(d, 'main').focus, ['slider1']);
    refused(() => M.apply(two(), { type: 'deleteElements', screen: 'main', elements: ['button1', 'nope'] }), /no element/);
});

test('copied elements paste on top, within or between screens, with names kept unique on the screen', () => {
    let d = edit([
        { type: 'renameElement', screen: 'main', element: 'toggle1', name: 'fog' },
        { type: 'setOption', screen: 'main', element: 'button1', key: 'text', value: 'Go' },
        { type: 'addScreen', name: 'b' },
        { type: 'addElement', screen: 'b', widget: 'rect' },
    ], two());
    const clip = M.copyElements(screen(d, 'main'), ['button1', 'fog']);
    // the clipboard is a copy: later edits to the source don't reach it
    d = M.apply(d, { type: 'setOption', screen: 'main', element: 'button1', key: 'text', value: 'Changed' });
    assert.strictEqual(clip[0].opts.text, 'Go');

    // same screen: renamed, moved by the offset
    assert.deepStrictEqual(M.pastedNames(screen(d, 'main'), clip), ['button2', 'fog1']);
    d = M.apply(d, { type: 'pasteElements', screen: 'main', elements: clip, dx: 16, dy: 16 });
    assert.deepStrictEqual(elNames(d, 'main'), ['button1', 'fog', 'button2', 'fog1']);
    assert.deepStrictEqual(el(d, 'main', 'button2'), Object.assign({}, clip[0], { name: 'button2', x: 116, y: 66 }));
    d = M.apply(d, { type: 'pasteElements', screen: 'main', elements: clip });
    assert.deepStrictEqual(elNames(d, 'main').slice(4), ['button3', 'fog2']);

    // another screen: names that are free stay, at the same place
    d = M.apply(d, { type: 'pasteElements', screen: 'b', elements: clip });
    assert.deepStrictEqual(elNames(d, 'b'), ['rect1', 'button1', 'fog']);
    assert.deepStrictEqual(el(d, 'b', 'fog'), clip[1]);

    refused(() => M.apply(d, { type: 'pasteElements', screen: 'b', elements: [{ name: 'x', gpu: 'rect', x: 0.5, y: 0, w: 1, h: 1, opts: {} }] }), /whole/);
    refused(() => M.apply(d, { type: 'pasteElements', screen: 'b', elements: [{ x: 0, y: 0, w: 1, h: 1, opts: {} }] }), /widget/);
});

test('each canvas edit is one undo step, however many elements it touches, and redoes the same', () => {
    const ops = [
        { type: 'setBoxes', screen: 'main', boxes: { button1: { x: 8, y: 8 }, toggle1: { w: 120 } } },
        { type: 'moveElements', screen: 'main', elements: ['button1', 'toggle1'], dx: 8, dy: 0 },
        { type: 'alignElements', screen: 'main', elements: ['button1', 'toggle1'], edge: 'top' },
        { type: 'pasteElements', screen: 'main', elements: [{ name: 'r', gpu: 'rect', x: 0, y: 0, w: 10, h: 10, opts: {} }] },
        { type: 'deleteElements', screen: 'main', elements: ['button1', 'toggle1'] },
    ];
    let h = M.createHistory(two());
    const files = [h.present.file];
    for (const op of ops) {
        h = M.dispatch(h, op);
        files.push(h.present.file);
    }
    for (let i = ops.length - 1; i >= 0; i--) {
        h = M.undo(h);
        assert.deepStrictEqual(h.present.file, files[i], `undo ${ops[i].type}`);
    }
    for (let i = 1; i <= ops.length; i++) {
        h = M.redo(h);
        assert.deepStrictEqual(h.present.file, files[i], `redo ${ops[i - 1].type}`);
    }
});

// --- snapping

/** main: button1 100,50 300x80 and toggle1 600,300 100x60; lines to snap button1 to (toggle1, screen, guides). */
const linesFor = (guides) => S.snapLines(screen(two(), 'main'), ['button1'], guides || { xs: [], ys: [] }, { w: 1796, h: 632 });

test('the lines an element snaps to: the other elements’ edges and centres, the screen edges, the focus-ring margin and guides', () => {
    const l = linesFor({ xs: [1200], ys: [] });
    for (const x of [600, 650, 700, 0, 898, 1796, 8, 1788, 1200]) assert.ok(l.xs.includes(x), `x ${x}`);
    for (const y of [300, 330, 360, 0, 316, 632, 8, 624]) assert.ok(l.ys.includes(y), `y ${y}`);
    assert.ok(!l.xs.includes(100) && !l.xs.includes(400), 'not the moved element itself');
});

test('a moved box snaps any of its edges or its centre to the nearest line close enough, else to the grid', () => {
    const l = linesFor({ xs: [1200], ys: [] });
    const opt = { grid: 16, threshold: 6 };
    // left edge 597 -> 600 (toggle1's left); nothing near the top, middle or bottom: the top to the grid (37 -> 32)
    let r = S.snapMove({ x: 597, y: 37, w: 250, h: 80 }, l, opt);
    assert.deepStrictEqual(r.box, { x: 600, y: 32, w: 250, h: 80 });
    assert.deepStrictEqual(r.shown, { xs: [600], ys: [] });
    // centre 652 -> 650 (toggle1's centre); bottom 626 -> 624 (the focus-ring margin above the screen's bottom)
    r = S.snapMove({ x: 502, y: 546, w: 300, h: 80 }, l, opt);
    assert.deepStrictEqual(r.box, { x: 500, y: 544, w: 300, h: 80 });
    assert.deepStrictEqual(r.shown, { xs: [650], ys: [624] });
    // the nearest line wins: left 897 is 1 from the screen's centre (898), right 1197 is 3 from the guide
    assert.strictEqual(S.snapMove({ x: 897, y: 0, w: 300, h: 80 }, l, opt).box.x, 898);
    assert.strictEqual(S.snapMove({ x: 903, y: 0, w: 300, h: 80 }, l, opt).box.x, 900, 'right edge to the guide at 1200');
    // grid off: whole pixels
    assert.deepStrictEqual(S.snapMove({ x: 310.4, y: 200.6, w: 300, h: 80 }, l, { grid: 0, threshold: 6 }).box, { x: 310, y: 201, w: 300, h: 80 });
    // snapping off altogether (Alt held): only whole pixels
    assert.deepStrictEqual(S.snapMove({ x: 597.4, y: 37, w: 300, h: 80 }, l, { grid: 0, threshold: 0 }).box, { x: 597, y: 37, w: 300, h: 80 });
});

test('a resized box snaps only the edges being dragged, and never gets a negative size', () => {
    const l = linesFor();
    const opt = { grid: 16, threshold: 6 };
    // dragging the right edge to 603: snaps to 600; left stays
    let r = S.snapResize({ x: 100, y: 50, w: 503, h: 80 }, 'e', l, opt);
    assert.deepStrictEqual(r.box, { x: 100, y: 50, w: 500, h: 80 });
    assert.deepStrictEqual(r.shown, { xs: [600], ys: [] });
    // dragging the top-left corner to 101, 297: x to the grid (96), y to toggle1's top (300); right/bottom stay
    r = S.snapResize({ x: 101, y: 297, w: 299, h: 33 }, 'nw', l, opt);
    assert.deepStrictEqual(r.box, { x: 96, y: 300, w: 304, h: 30 });
    // dragged past the opposite edge: 0 size
    assert.deepStrictEqual(S.snapResize({ x: 100, y: 50, w: -40, h: 80 }, 'e', l, { grid: 0, threshold: 0 }).box, { x: 100, y: 50, w: 0, h: 80 });
});
