'use strict';
// Seam 2 for the car's view (ticket 09), in real Chromium: the Designer's static build with GT3 open. The Car's view
// switch (on by default) shows the hood, BMW's gear box and the belt light as masks over the engine's canvas and
// hides them again; dragging an element under the hood puts its warning (the engine's reason) in the element list and
// the inspector while it is dragged, moving it away removes it; the masks are not in the engine's canvas and not in
// the downloaded file; warnings never stop saving.
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


const boxOf = async (page, name) => {
    const v = await page.locator(`[data-box="${name}"] input`).evaluateAll((els) => els.map((e) => Number(e.value)));
    return { x: v[0], y: v[1], w: v[2], h: v[3] };
};
async function download(page) {
    const d = page.waitForEvent('download');
    await page.locator('[data-main-menu]').click();
    await page.locator('[data-menu-download]').click();
    return JSON.parse(fs.readFileSync(await (await d).path(), 'utf8'));
}
const masks = (page) => page.locator('[data-car-mask]').evaluateAll((els) => els.map((e) => e.getAttribute('data-car-mask')));

test('the car\'s view is on by default with the three masks at the measured positions; the switch hides and shows them without touching the engine canvas', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors, frame } = await openGt3(context);
        const sw = page.getByRole('switch', { name: /car.s view/i });
        assert.strictEqual(await sw.getAttribute('aria-checked'), 'true');
        assert.deepStrictEqual((await masks(page)).sort(), ['belt', 'gear-box', 'hood']);
        const f0 = await frame();
        const gb = await page.locator('[data-car-mask=gear-box]').boundingBox();
        const cv = await page.locator('[data-cluster-canvas]').boundingBox();
        const k = cv.width / 1920;
        assert.ok(Math.abs(gb.x - (cv.x + 1406 * k)) < 1.5 && Math.abs(gb.width - 191 * k) < 1.5, 'gear box at x 1406, 191 wide');
        assert.ok(Math.abs(gb.y - (cv.y + 342 * k)) < 1.5 && Math.abs(gb.height - 77 * k) < 1.5, 'gear box at y 342, 77 high');
        const belt = await page.locator('[data-car-mask=belt]').boundingBox();
        assert.ok(Math.abs(belt.x - (cv.x + 587 * k)) < 1.5 && Math.abs(belt.y - (cv.y + 663 * k)) < 1.5, 'belt light at 587,663');
        await sw.click();
        assert.strictEqual(await sw.getAttribute('aria-checked'), 'false');
        assert.deepStrictEqual(await masks(page), []);
        assert.strictEqual(await frame(), f0, 'the masks were never in the engine canvas');
        await sw.click();
        assert.strictEqual((await masks(page)).length, 3);
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});

test('dragging an element under the hood adds its warning live, in the list and the inspector; moving it away removes it; saving still works', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openGt3(context);
        const warn = page.locator('[data-element="speed"] [data-warning]');
        await page.locator('[data-element="speed"]').click();
        assert.strictEqual(await warn.count(), 0, 'speed is clear in GT3');
        assert.strictEqual(await page.locator('[data-warning-text]').count(), 0);
        const from = await boxOf(page, 'speed');

        const sb = await page.locator('[data-canvas-element="speed"]').boundingBox();
        const k = sb.width / from.w;
        const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx, cy - 20 * k, { steps: 4 });
        await page.mouse.move(cx, cy - (from.y + 30) * k, { steps: 8 });
        await warn.waitFor();                                  // while the mouse is still down
        await page.mouse.up();
        const moved = await boxOf(page, 'speed');
        assert.ok(moved.y < 0, 'moved above the top edge, y ' + moved.y);
        assert.match(await page.locator('[data-warning-text="speed"]').first().textContent(), /px under the hood/);
        assert.match(await warn.getAttribute('title'), /px under the hood/);

        const saved = await download(page);       // warnings do not stop saving
        assert.strictEqual(saved.widgets.find((w) => w.id === 'speed').y, moved.y);

        await page.locator('[data-undo]').click();
        assert.deepStrictEqual(await boxOf(page, 'speed'), from);
        assert.strictEqual(await warn.count(), 0, 'back where it was, the warning is gone');
        assert.strictEqual(await page.locator('[data-warning-text]').count(), 0);
        await page.locator('[data-redo]').click();
        await warn.waitFor();

        // moving it away with the box fields removes the warning
        const y = page.locator('[data-box="speed"] input').nth(1);
        await y.fill(String(from.y));
        await y.press('Enter');
        await page.waitForFunction(() => !document.querySelector('[data-element="speed"] [data-warning]'));
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});

test('the downloaded file has no trace of the car\'s view, on or off', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openGt3(context);
        assert.deepStrictEqual(await download(page), ORIGINAL);
        await page.getByRole('switch', { name: /car.s view/i }).click();
        assert.deepStrictEqual(await download(page), ORIGINAL);
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});
