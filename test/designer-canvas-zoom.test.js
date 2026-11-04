'use strict';
// Editing and trying on the zoomed canvas, in the Designer's static build in real Chromium: at 50 %, 100 % and 200 %
// dragging an element, dragging its resize handle and a selection rectangle land on the same screen pixels, and
// while trying a tap lands on the element under it. Also: the toolbar's zoom steps, 100 % and fit, panning with
// Space + drag, the middle button and the wheel, and Ctrl + wheel zooming about the pointer. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

const ROOT = path.join(__dirname, '..');
const DESIGNER = path.join(ROOT, 'designer');
let DIST;     // this file's own build of the Designer (designer-dist.js)
const ORIGIN = 'http://designer.test';
const W = 1796, H = 632;

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

const { zipSync, strToU8 } = require(require.resolve('fflate', { paths: [DESIGNER] }));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// two buttons near the middle of the screen (so they stay in view at 200 %), on the 8 px grid; a opens 'next'
const button = (name, x, y) => ({ name, rtype: 'gpu', gpu: 'button', x, y, w: 360, h: 76, opts: { text: name } });
const FILE = {
    schema: 1, first: 'home', design: { w: W, h: H },
    screens: [
        { name: 'home', kind: 'gpu', title: 'Home', theme: 'm_tricolour', bg: 'theme', nav: { a: 'next' },
            components: [button('a', 512, 200), button('b', 960, 400)] },
        { name: 'next', kind: 'gpu', title: 'Next', theme: 'm_tricolour', bg: 'theme', components: [] },
    ],
};

let browser;
before(async () => {
    if (skip) return;
    DIST = buildDesigner();
    browser = await playwright.chromium.launch();
});
after(async () => { if (browser) await browser.close(); });

async function open() {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(ORIGIN + '/**', (route) => {
        let p = new URL(route.request().url()).pathname;
        if (p === '/') p = '/index.html';
        const f = path.join(DIST, p);
        if (!f.startsWith(DIST) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
        return route.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
    });
    await page.goto(ORIGIN + '/');
    await page.locator('[data-zoom-level]').waitFor();
    const zip = Buffer.from(zipSync({ 'screens.json': strToU8(JSON.stringify(FILE)) }));
    await page.setInputFiles('input[type=file]', { name: 'design.zip', mimeType: 'application/zip', buffer: zip });
    await page.locator('[data-element="b"]').waitFor();
    return { page, errors };
}

/** Sets the zoom with the toolbar: 100 %, then steps (0.75, 0.5 down; 1.5, 2 up). */
async function zoomTo(page, zoom) {
    await page.locator('[data-zoom-reset]').click();
    const steps = { 0.5: ['out', 'out'], 1: [], 2: ['in', 'in'] }[zoom];
    for (const s of steps) await page.locator(`[data-zoom-${s}]`).click();
    assert.strictEqual(await page.locator('[data-zoom-level]').textContent(), `${zoom * 100}%`);
}

/** The window position of screen pixel (x, y), from the on-screen box of `sel` (the screen's 1796 x 632). */
async function at(page, sel, x, y) {
    const r = await page.locator(sel).boundingBox();
    return { x: r.x + x * (r.width / W), y: r.y + y * (r.height / H) };
}

async function drag(page, from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
}

const box = (page) => page.locator('[data-box] input').evaluateAll((els) => els.map((e) => Number(e.value)));

for (const zoom of [0.5, 1, 2]) {
    test(`at ${zoom * 100} % moving, resizing and selecting land on the right screen pixels`, { skip }, async () => {
        const { page, errors } = await open();
        try {
            await zoomTo(page, zoom);
            const layer = '[data-canvas]';
            // move a by (96, 40)
            await drag(page, await at(page, layer, 692, 238), await at(page, layer, 692 + 96, 238 + 40));
            assert.deepStrictEqual(await box(page), [608, 240, 360, 76]);
            await page.keyboard.press('Control+z');
            assert.deepStrictEqual(await box(page), [512, 200, 360, 76]);
            // resize a from its bottom-right handle by (80, 28)
            await drag(page, await at(page, layer, 872, 276), await at(page, layer, 872 + 80, 276 + 28));
            assert.deepStrictEqual(await box(page), [512, 200, 440, 104]);
            // a selection rectangle from empty screen around both
            await drag(page, await at(page, layer, 480, 150), await at(page, layer, 1330, 490));
            assert.deepStrictEqual(await page.locator('[data-element][aria-current="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element')).sort()), ['a', 'b']);
            assert.deepStrictEqual(errors, []);
        } finally {
            await page.close();
        }
    });
}

for (const zoom of [0.5, 2]) {
    test(`at ${zoom * 100} % a tap while trying lands on the element under it`, { skip }, async () => {
        const { page, errors } = await open();
        try {
            await zoomTo(page, zoom);
            await page.locator('[data-try-toggle]').check();
            const p = await at(page, '[data-hmi-page] canvas', 692, 238);       // a's middle
            await page.mouse.click(p.x, p.y);
            await page.locator('[data-try-panel] [data-action="a"]').waitFor();
            await page.waitForFunction(() => document.querySelector('[data-hmi-title]').textContent === 'Next');
            assert.deepStrictEqual(errors, []);
        } finally {
            await page.close();
        }
    });
}

test('the toolbar zooms in steps, to 100 % and to fit; Space + drag pans; the page starts at 100 %', { skip }, async () => {
    const { page, errors } = await open();
    try {
        const level = () => page.locator('[data-zoom-level]').textContent();
        assert.strictEqual(await level(), '100%');
        await page.locator('[data-zoom-in]').click();
        assert.strictEqual(await level(), '150%');
        await page.locator('[data-zoom-fit]').click();
        const vp = await page.locator('[data-viewport]').boundingBox();
        const pg = await page.locator('[data-hmi-page]').boundingBox();
        assert.ok(pg.x >= vp.x && pg.x + pg.width <= vp.x + vp.width + 1 && pg.y >= vp.y && pg.y + pg.height <= vp.y + vp.height + 1, 'fitted inside');
        assert.ok(Math.abs((vp.x + vp.width / 2) - (pg.x + pg.width / 2)) < 2, 'centred');
        await page.keyboard.press('Control+0');
        assert.strictEqual(await level(), '100%');
        const before = await page.locator('[data-hmi-page]').boundingBox();
        await page.mouse.move(vp.x + 100, vp.y + 100);
        await page.keyboard.down('Space');
        await drag(page, { x: vp.x + 100, y: vp.y + 100 }, { x: vp.x + 160, y: vp.y + 130 });
        await page.keyboard.up('Space');
        const moved = await page.locator('[data-hmi-page]').boundingBox();
        assert.deepStrictEqual([Math.round(moved.x - before.x), Math.round(moved.y - before.y)], [60, 30]);
        assert.strictEqual(await page.locator('[data-element][aria-current="true"]').count(), 0, 'panning selects nothing');
        // the middle button pans too
        await page.mouse.move(vp.x + 200, vp.y + 200);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(vp.x + 180, vp.y + 190, { steps: 3 });
        await page.mouse.up({ button: 'middle' });
        const moved2 = await page.locator('[data-hmi-page]').boundingBox();
        assert.deepStrictEqual([Math.round(moved2.x - moved.x), Math.round(moved2.y - moved.y)], [-20, -10]);
        // the wheel pans; Ctrl + wheel zooms, keeping the screen pixel under the pointer where it was
        await page.mouse.wheel(0, 50);
        const moved3 = await page.locator('[data-hmi-page]').boundingBox();
        assert.deepStrictEqual([Math.round(moved3.x - moved2.x), Math.round(moved3.y - moved2.y)], [0, -50]);
        const p = await at(page, '[data-canvas]', 1000, 300);
        await page.mouse.move(p.x, p.y);
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -200);
        await page.keyboard.up('Control');
        assert.notStrictEqual(await level(), '100%');
        const q = await at(page, '[data-canvas]', 1000, 300);
        assert.ok(Math.abs(q.x - p.x) < 1.5 && Math.abs(q.y - p.y) < 1.5, `zoomed about the pointer (${p.x},${p.y} → ${q.x},${q.y})`);
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});
