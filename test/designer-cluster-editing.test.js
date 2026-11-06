'use strict';
// Seam 2 for editing a cluster layout (ticket 05), in real Chromium: the Designer's static build with GT3 open. The
// app author selects (list, click, Shift-click, marquee), moves and resizes on the canvas, nudges with the keys,
// deletes, duplicates, copies and pastes, restacks, and undoes; the engine's canvas follows each edit (its pixels
// change and come back with undo) and the downloaded file differs from the one opened only by what was changed.
// Finds things by data-* hooks and ARIA roles. Needs Playwright's Chromium; skipped without it.
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
        await page.waitForTimeout(400);
        return page.evaluate(() => window.__frames.sum);
    };
    await page.waitForFunction(() => window.__frames.n > 0);
    return { page, errors, frame };
}

const order = (page) => page.locator('[data-element]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element')));
const selected = (page) => page.locator('[data-element][aria-current=true]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element')));
const boxOf = async (page, name) => {
    const v = await page.locator(`[data-box="${name}"] input`).evaluateAll((els) => els.map((e) => Number(e.value)));
    return { x: v[0], y: v[1], w: v[2], h: v[3] };
};
const widgetBox = (id) => { const w = ORIGINAL.widgets.find((x) => x.id === id); return { x: w.x, y: w.y, w: w.w, h: w.h }; };

async function download(page) {
    const d = page.waitForEvent('download');
    await page.locator('[data-main-menu]').click();
    await page.locator('[data-menu-download]').click();
    return JSON.parse(fs.readFileSync(await (await d).path(), 'utf8'));
}

test('the element list shows each widget by id with its kind, and the inspector its name, kind and box', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openGt3(context);
        const ids = ORIGINAL.widgets.map((w) => w.id);
        assert.deepStrictEqual(await order(page), ids.slice().reverse(), 'top first, as for screens');
        assert.strictEqual(await page.locator('[data-element="speed"]').getAttribute('data-element-kind'), 'text');
        assert.strictEqual(await page.locator('[data-element="frame"]').getAttribute('data-element-kind'), 'boxes');
        await page.locator('[data-element="speed"]').click();
        assert.deepStrictEqual(await selected(page), ['speed']);
        assert.strictEqual(await page.locator('[data-info="name"]').innerText(), 'speed');
        assert.strictEqual(await page.locator('[data-info="kind"]').innerText(), 'text');
        assert.deepStrictEqual(await boxOf(page, 'speed'), widgetBox('speed'));
        assert.strictEqual(await page.locator('[data-canvas-element="speed"]').count(), 1);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('drag moves the background and the canvas follows; undo and redo bring it back; resize with a handle', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors, frame } = await openGt3(context);
        const undo = page.locator('[data-undo]'), redo = page.locator('[data-redo]');
        const f0 = await frame();

        // the frame (the full-cluster boxes widget) is under everything: grab it where nothing else is
        const fb = await page.locator('[data-canvas-element="frame"]').boundingBox();
        const k = fb.width / 1920;
        const at = (x, y) => [fb.x + x * k, fb.y + y * k];
        await page.mouse.move(...at(1000, 20));
        await page.mouse.down();
        await page.mouse.move(...at(1040, 20), { steps: 5 });
        await page.mouse.move(...at(1080, 40), { steps: 5 });
        await page.mouse.up();
        assert.deepStrictEqual(await selected(page), ['frame']);
        const moved = await boxOf(page, 'frame');
        assert.ok(moved.x > 40 && moved.y > 0, `moved right and down (x ${moved.x}, y ${moved.y})`);
        assert.deepStrictEqual([moved.w, moved.h], [1920, 720], 'a move does not resize');
        const f1 = await frame();
        assert.notStrictEqual(f1, f0, 'the engine drew the layout with the frame moved');

        await undo.click();
        assert.deepStrictEqual(await boxOf(page, 'frame'), widgetBox('frame'));
        assert.strictEqual(await frame(), f0, 'undo redraws the layout as it was');
        await redo.click();
        assert.deepStrictEqual(await boxOf(page, 'frame'), moved);
        assert.strictEqual(await frame(), f1);
        await undo.click();

        // resize: the south-east handle of "speed"
        await page.locator('[data-element="speed"]').click();
        const sb = await page.locator('[data-canvas-element="speed"]').boundingBox();
        const handle = page.locator('[data-canvas-element="speed"] > span').nth(4);         // nw n ne e SE s sw w
        const hb = await handle.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(hb.x + hb.width / 2 + 20 * k, hb.y + hb.height / 2 + 16 * k, { steps: 6 });
        await page.mouse.up();
        const was = widgetBox('speed'), grown = await boxOf(page, 'speed');
        assert.deepStrictEqual([grown.x, grown.y], [was.x, was.y], 'the north-west corner stays');
        assert.ok(grown.w > was.w && grown.h > was.h, `grew (${grown.w}x${grown.h})`);
        assert.ok(sb.width > 0);
        await undo.click();
        assert.deepStrictEqual(await boxOf(page, 'speed'), was);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('select several (Shift-click, marquee, select all), nudge them together, delete, duplicate, copy and paste, each one undo step', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openGt3(context);
        const undo = page.locator('[data-undo]');
        const count = async () => (await order(page)).length;
        const total = ORIGINAL.widgets.length;

        // Shift-click on the canvas adds to the selection
        await page.locator('[data-element="speed"]').click();
        await page.locator('[data-canvas-element="rpm"]').click({ modifiers: ['Shift'], position: { x: 4, y: 4 } });
        assert.deepStrictEqual((await selected(page)).sort(), ['rpm', 'speed']);

        // arrow keys move them together, by one undo step per press
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Shift+ArrowDown');
        assert.strictEqual((await boxOf(page, 'speed')).x, undefined, 'one box field only for a single selection');
        await undo.click();
        await undo.click();

        // delete the frame, then a marquee over the left columns (nothing is under it any more)
        await page.locator('[data-element="frame"]').click();
        await page.keyboard.press('Delete');
        assert.strictEqual(await count(), total - 1);
        const layer = await page.locator('[data-canvas]').boundingBox();
        const k = layer.width / 1920;
        const at = (x, y) => [layer.x + x * k, layer.y + y * k];
        const marquee = async () => {
            await page.mouse.move(...at(100, 200));
            await page.mouse.down();
            await page.mouse.move(...at(300, 400), { steps: 4 });
            await page.mouse.move(...at(430, 700), { steps: 4 });
            await page.mouse.up();
        };
        await marquee();
        const picked = await selected(page);
        for (const n of ['speed_head', 'speed', 'speed_unit', 'rpm_head', 'rpm']) assert.ok(picked.includes(n), `${n} inside the marquee`);
        assert.ok(!picked.includes('gear'), 'gear is outside it');

        // duplicate: copies selected, on top, under free names; one step
        const before = await count();
        await page.keyboard.press('Control+d');
        assert.strictEqual(await count(), before + picked.length);
        assert.ok((await order(page))[0].endsWith('1'), 'the copies are on top');
        await undo.click();
        assert.strictEqual(await count(), before);

        // copy, paste twice (undo dropped the copies from the selection: select the columns again)
        await marquee();
        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');
        await page.keyboard.press('Control+v');
        assert.strictEqual(await count(), before + 2 * picked.length);
        assert.ok((await order(page)).includes('speed2'));

        // delete the selection (the last paste), then undo, undo, undo back to the frame deleted
        await page.keyboard.press('Delete');
        assert.strictEqual(await count(), before + picked.length);
        for (let i = 0; i < 3; i++) await undo.click();
        assert.strictEqual(await count(), before);
        await undo.click();
        assert.strictEqual(await count(), total, 'the frame is back');
        assert.strictEqual((await order(page))[total - 1], 'frame', 'at the bottom where it was');

        // select all
        await page.keyboard.press('Control+a');
        assert.strictEqual((await selected(page)).length, total);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('stacking from the four commands and the list drag; the list is flipped, top first', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openGt3(context);
        const ids = ORIGINAL.widgets.map((w) => w.id);
        const top = (await order(page));
        assert.deepStrictEqual(top, ids.slice().reverse());
        // (widgets[] order only stacks widgets of one class and z in the engine, so these edits are checked on the
        // order, not on pixels: the frame is class 'ambient', z -10, and is drawn under the rest wherever it is listed)
        await page.locator('[data-element="frame"]').click();
        await page.keyboard.press('Control+Shift+BracketRight');         // to front
        assert.strictEqual((await order(page))[0], 'frame');
        await page.keyboard.press('Control+BracketLeft');                // backward
        assert.strictEqual((await order(page))[1], 'frame');
        await page.keyboard.press('Control+Shift+BracketLeft');          // to back
        assert.deepStrictEqual(await order(page), top);
        await page.keyboard.press('Control+BracketRight');               // forward
        assert.strictEqual((await order(page)).indexOf('frame'), top.length - 2);

        // the canvas menu has the four commands
        await page.locator('[data-canvas-element="speed"]').click({ button: 'right' });
        await page.locator('[data-canvas-menu]').waitFor();
        assert.strictEqual(await page.locator('[data-canvas-stack]').count(), 4);
        await page.locator('[data-canvas-stack="back"]').click();
        assert.strictEqual((await order(page))[top.length - 1], 'speed');

        // drag a row of the list to the top
        await page.locator('[data-element="rpm"]').dragTo(page.locator('[data-element]').first(), { targetPosition: { x: 20, y: 1 } });
        assert.strictEqual((await order(page))[0], 'rpm');
        const undo = page.locator('[data-undo]');
        for (let i = 0; i < 6; i++) await undo.click();
        assert.deepStrictEqual(await order(page), top, 'every command was one undo step');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('the downloaded file differs from the one opened only by what was edited', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 }, acceptDownloads: true });
    try {
        const { page, errors } = await openGt3(context);
        await page.locator('[data-element="speed"]').click();
        for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
        await page.locator('[data-element="rpm"]').click();
        await page.keyboard.press('Delete');
        const saved = await download(page);
        const expected = JSON.parse(GT3.toString('utf8'));
        expected.widgets.find((w) => w.id === 'speed').x += 3;
        expected.widgets = expected.widgets.filter((w) => w.id !== 'rpm');
        assert.deepStrictEqual(saved, expected);
        assert.deepStrictEqual(Object.keys(saved), Object.keys(expected));
        assert.deepStrictEqual(Object.keys(saved.widgets.find((w) => w.id === 'speed')), Object.keys(ORIGINAL.widgets.find((w) => w.id === 'speed')));
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
