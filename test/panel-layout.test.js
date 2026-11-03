'use strict';
// The panels' layout (designer/src/shell/panels.ts): where a floating panel first shows, keeping it inside the area,
// width limits, and reading back what the browser kept (or the defaults when that is missing or broken).
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let P;
before(async () => { P = await import(pathToFileURL(path.join(__dirname, '..', 'designer', 'src', 'shell', 'panels.ts')).href); });

const memory = (init = {}) => {
    const m = { ...init };
    return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m };
};

test('a panel first floats in its own top corner, and always stays inside the area with its header on screen', () => {
    const area = { w: 1600, h: 900 };
    const left = { ...P.DEFAULT_PANELS.left, mode: 'floating' };
    const right = { ...P.DEFAULT_PANELS.right, mode: 'floating' };
    assert.deepStrictEqual(P.floatingAt(left, 'left', area), { x: 12, y: 12 });
    assert.deepStrictEqual(P.floatingAt(right, 'right', area), { x: 1600 - 320 - 12, y: 12 });
    // dragged off the right and the bottom: pulled back; then the window shrinks: pulled back again
    assert.deepStrictEqual(P.clampPosition(1500, 2000, 320, area), { x: 1280, y: 860 });
    assert.deepStrictEqual(P.floatingAt({ ...right, x: 1268, y: 400 }, 'right', { w: 1000, h: 300 }), { x: 680, y: 260 });
    assert.deepStrictEqual(P.clampPosition(-50, -10, 320, area), { x: 0, y: 0 });
});

test('widths stay between 200 and 560 px', () => {
    assert.deepStrictEqual([P.clampWidth(10), P.clampWidth(333.4), P.clampWidth(9000)], [200, 333, 560]);
});

test('the left inset is the docked, shown left panel\'s width', () => {
    const d = P.DEFAULT_PANELS;
    assert.strictEqual(P.leftInset(d, false), 240);
    assert.strictEqual(P.leftInset(d, true), 0);
    assert.strictEqual(P.leftInset({ ...d, left: { ...d.left, mode: 'floating' } }, false), 0);
});

test('layouts are kept and read back; missing, broken or odd values read as the defaults', () => {
    const s = memory();
    assert.deepStrictEqual(P.readPanels(s), P.DEFAULT_PANELS);
    const mine = { left: { mode: 'floating', width: 300, x: 40, y: 60, collapsed: true }, right: P.DEFAULT_PANELS.right };
    P.writePanels(s, mine);
    assert.deepStrictEqual(P.readPanels(s), mine);
    assert.deepStrictEqual(P.readPanels(memory({ 'mgu-designer.panels': '{not json' })), P.DEFAULT_PANELS);
    const odd = P.readPanels(memory({ 'mgu-designer.panels': JSON.stringify({ left: { mode: 'sideways', width: 5, x: 'a' } }) }));
    assert.deepStrictEqual(odd.left, { mode: 'docked', width: 200, x: null, y: null, collapsed: false });
    assert.deepStrictEqual(odd.right, P.DEFAULT_PANELS.right);
    assert.deepStrictEqual(P.readPanels(null), P.DEFAULT_PANELS);
    P.writePanels({ setItem() { throw new Error('full'); } }, mine);      // a refusing storage is ignored
});
