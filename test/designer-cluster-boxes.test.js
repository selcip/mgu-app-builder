'use strict';
// Seam 2 for the boxes inside GT3's frame (ticket 07), in real Chromium: each box is a child row under the frame in
// the element list and a selectable, movable, resizable element on the canvas; the engine's canvas follows each edit
// and comes back with undo; adding past the engine's limit is refused with its reason. Finds things by data-* hooks
// and ARIA roles. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

let DIST;
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const GT3 = fs.readFileSync(path.join(__dirname, 'fixtures', 'cluster-layouts', 'gt3.json'));
const ORIGINAL = JSON.parse(GT3.toString('utf8'));

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

let browser;
before(async () => {
    if (skip) return;
    DIST = buildDesigner();
    browser = await playwright.chromium.launch();
});
after(async () => { if (browser) await browser.close(); });

/** The Designer with GT3 open; `frame()` is a fingerprint of the engine's canvas as last drawn. */
async function openGt3(context) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await context.route(ORIGIN + '/**', (route) => {
        let p = new URL(route.request().url()).pathname;
        if (p === '/') p = '/index.html';
        const f = path.join(DIST, p);
        if (!f.startsWith(DIST) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
        return route.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
    });
    await page.addInitScript(() => {
        window.__frames = { n: 0, sum: '' };
        window.addEventListener('mgu-cluster-frame', () => {
            const c = document.querySelector('[data-cluster-canvas]');
            const url = c.toDataURL();       // read in the frame's own task, before the browser clears the buffer
            let h = 0;
            for (let i = 0; i < url.length; i += 7) h = (h * 31 + url.charCodeAt(i)) | 0;
            window.__frames = { n: window.__frames.n + 1, sum: url.length + ':' + h };
        });
    });
    await page.goto(ORIGIN + '/');
    await page.locator('[data-doc-kind]').waitFor();
    await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: GT3 });
    await page.locator('[data-cluster-canvas]').waitFor();
    await page.locator('[data-element="speed"]').waitFor();
    const frame = async () => {         // let the engine and the stage settle, then read the fingerprint
        let last = null;                // under load the engine can be late: read until two reads agree
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(300);
            const now = await page.evaluate(() => window.__frames.sum);
            if (now === last) return now;
            last = now;
        }
        return last;
    };
    await page.waitForFunction(() => window.__frames.n > 0);
    return { page, errors, frame };
}

async function download(page) {
    const d = page.waitForEvent('download');
    await page.locator('[data-main-menu]').click();
    await page.locator('[data-menu-download]').click();
    return JSON.parse(fs.readFileSync(await (await d).path(), 'utf8'));
}

const boxRows = (page) => page.locator('[data-element-box]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element-box')));
const fields = async (page, name) => {
    const v = await page.locator(`[data-box="${name}"] input`).evaluateAll((els) => els.map((e) => Number(e.value)));
    return { x: v[0], y: v[1], w: v[2], h: v[3] };
};
const INNER = ORIGINAL.widgets.find((w) => w.id === 'frame').boxes;
const NAME = 'frame/speed_box';
const ROW = `[data-element-box="${NAME}"]`;

test('the frame lists its boxes as child rows; selecting one shows its box; the parent is selectable as before', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openGt3(context);
        assert.deepStrictEqual((await boxRows(page)).slice().sort(), INNER.map((b) => 'frame/' + b.id).sort());
        assert.strictEqual(await page.locator('[data-element-box]').first().getAttribute('data-parent'), 'frame');
        assert.strictEqual(await page.locator('[data-element]').count(), ORIGINAL.widgets.length, 'the widget rows are the widgets');
        await page.locator(ROW).click();
        assert.strictEqual(await page.locator(ROW).getAttribute('aria-current'), 'true');
        assert.strictEqual(await page.locator(`[data-canvas-element="${NAME}"]`).count(), 1);
        const b = INNER.find((x) => x.id === 'speed_box');
        assert.deepStrictEqual(await fields(page, NAME), { x: b.x, y: b.y, w: b.w, h: b.h });
        assert.strictEqual(await page.locator('[data-box-count]').innerText(), `${INNER.length} of 12`);
        await page.locator('[data-element="frame"]').click();
        assert.strictEqual(await page.locator('[data-info="name"]').innerText(), 'frame');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('drag a box and resize it with a handle: the engine canvas follows, undo restores; delete and undo', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors, frame } = await openGt3(context);
        const undo = page.locator('[data-undo]'), redo = page.locator('[data-redo]');
        const f0 = await frame();
        const b = INNER.find((x) => x.id === 'speed_box');
        await page.locator(ROW).click();
        const el = page.locator(`[data-canvas-element="${NAME}"]`);
        const r = await el.boundingBox();
        const k = r.width / b.w;
        await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
        await page.mouse.down();
        await page.mouse.move(r.x + r.width / 2 + 30 * k, r.y + r.height / 2, { steps: 5 });
        await page.mouse.move(r.x + r.width / 2 + 60 * k, r.y + r.height / 2 + 20 * k, { steps: 5 });
        await page.mouse.up();
        const moved = await fields(page, NAME);
        assert.ok(moved.x > b.x && moved.y > b.y, `moved right and down (${moved.x}, ${moved.y})`);
        assert.deepStrictEqual([moved.w, moved.h], [b.w, b.h]);
        const f1 = await frame();
        assert.notStrictEqual(f1, f0, 'the engine drew the box moved');
        await undo.click();
        assert.deepStrictEqual(await fields(page, NAME), { x: b.x, y: b.y, w: b.w, h: b.h });
        assert.strictEqual(await frame(), f0, 'undo redraws the frame as it was');
        await redo.click();
        assert.strictEqual(await frame(), f1);
        await undo.click();

        // resize: the south-east handle
        const handle = el.locator('> span').nth(4);
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(hb.x + hb.width / 2 + 20 * k, hb.y + hb.height / 2 + 10 * k, { steps: 5 });
        await page.mouse.up();
        const grown = await fields(page, NAME);
        assert.ok(grown.w > b.w && grown.h > b.h, `grew (${grown.w}x${grown.h})`);
        assert.deepStrictEqual([grown.x, grown.y], [b.x, b.y]);
        assert.notStrictEqual(await frame(), f0);
        await undo.click();
        assert.strictEqual(await frame(), f0);

        // delete: the row and the box go, the engine draws the frame without it
        await page.locator(ROW).click();
        await page.keyboard.press('Delete');
        assert.ok(!(await boxRows(page)).includes(NAME));
        assert.notStrictEqual(await frame(), f0);
        await undo.click();
        assert.ok((await boxRows(page)).includes(NAME));
        assert.strictEqual(await frame(), f0);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('add boxes up to the engine limit; the next is refused with a reason; each add is one undo step', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors, frame } = await openGt3(context);
        const f0 = await frame();
        await page.locator('[data-element="frame"]').click();
        const add = page.locator('[data-add-box]');
        for (let n = INNER.length; n < 12; n++) await add.click();
        assert.strictEqual((await boxRows(page)).length, 12);
        assert.strictEqual(await page.locator('[data-box-count]').innerText(), '12 of 12');
        assert.notStrictEqual(await frame(), f0, 'the new boxes are drawn');
        await add.click();
        assert.match(await page.locator('[role=alert]').innerText(), /at most 12/);
        assert.strictEqual((await boxRows(page)).length, 12, 'nothing was added');
        for (let n = INNER.length; n < 12; n++) await page.locator('[data-undo]').click();
        assert.strictEqual((await boxRows(page)).length, INNER.length);
        assert.strictEqual(await frame(), f0, 'undoing every add redraws the frame as opened');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('a saved layout differs from the file opened only in the box that was edited; boxes reorder by key', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 }, acceptDownloads: true });
    try {
        const { page, errors } = await openGt3(context);
        await page.locator(ROW).click();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Control+Shift+BracketRight');
        const saved = await download(page);
        const frameSaved = saved.widgets.find((w) => w.id === 'frame');
        const want = structuredClone(INNER.find((x) => x.id === 'speed_box'));
        want.x += 1;
        assert.deepStrictEqual(frameSaved.boxes.at(-1), want, 'the box moved a pixel and went on top');
        assert.deepStrictEqual(frameSaved.boxes.slice(0, -1), INNER.filter((x) => x.id !== 'speed_box'));
        const rest = structuredClone(saved);
        rest.widgets.find((w) => w.id === 'frame').boxes = INNER;
        assert.deepStrictEqual(rest, ORIGINAL, 'nothing else changed');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
