'use strict';
// Seam 2 for the Layer budget (ticket 08), in real Chromium: the Designer's static build with a cluster layout open.
// The counter shows GT3's numbers (8 layers on connection 1, 8 in all, the apps golden's pixel memory); putting an
// element on connection 3 changes the per-connection counts, and undo brings them back; a layout over the cap is
// marked with the limit's name and can still be downloaded. Finds things by data-* hooks and ARIA roles.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

let DIST;
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const layoutBytes = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', 'cluster-layouts', n + '.json'));

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

async function open(context, name, buffer) {
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
    await page.goto(ORIGIN + '/');
    await page.locator('[data-doc-kind]').waitFor();
    await page.setInputFiles('header input[type=file]', { name: name + '.json', mimeType: 'application/json', buffer });
    await page.locator('[data-cluster-canvas]').waitFor();
    await page.locator('[data-element]').first().waitFor();
    return { page, errors };
}

/** The budget as shown: layers per connection (by 0-based connection), in all, and pixel bytes. */
const shown = (page) => page.evaluate(() => {
    const n = (sel) => { const e = document.querySelector(sel); return e ? Number(e.getAttribute('data-value')) : null; };
    const conns = {};
    document.querySelectorAll('[data-budget-conn]').forEach((e) => { conns[e.getAttribute('data-budget-conn')] = { layers: Number(e.getAttribute('data-value')), over: e.getAttribute('data-over') === 'true' }; });
    return { conns, total: n('[data-budget-total]'), pixels: n('[data-budget-pixels]') };
});
const settled = async (page, ok) => {
    await page.waitForFunction(ok, undefined, { timeout: 10000 });
    return shown(page);
};

test('GT3 shows 8 layers on connection 1, 8 in all and the pixel memory of the apps golden', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await open(context, 'gt3', layoutBytes('gt3'));
        await page.locator('[data-budget-total]').waitFor();
        const b = await shown(page);
        assert.deepStrictEqual(b.conns, { 0: { layers: 8, over: false } });
        assert.strictEqual(b.total, 8);
        assert.strictEqual(b.pixels, 8411712);
        assert.strictEqual(await page.locator('[data-budget-over]').count(), 0);
        assert.match(await page.locator('[data-budget]').innerText(), /Layers on connection 1\s+8 of 8/);
        assert.match(await page.locator('[data-budget]').innerText(), /Pixel memory\s+8\.0 of 16\.0 MiB/);
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});

test('putting an element on connection 3 moves its layer there, in one undo step, and undo moves it back', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await open(context, 'gt3', layoutBytes('gt3'));
        await page.locator('[data-budget-total]').waitFor();
        await page.locator('[data-element="speed"]').click();
        const select = page.getByRole('combobox', { name: 'Connection' });
        assert.strictEqual(await select.inputValue(), '0');
        await select.selectOption('2');
        const b = await settled(page, () => !!document.querySelector('[data-budget-conn="2"]'));
        assert.strictEqual(b.conns[2].layers, 1);
        assert.strictEqual(b.conns[0].layers, 8, 'speed shared a sheet with others, which stays');
        assert.strictEqual(b.total, 9, 'one layer more in all');
        await page.locator('[data-undo]').click();
        const back = await settled(page, () => !document.querySelector('[data-budget-conn="2"]'));
        assert.deepStrictEqual(back.conns, { 0: { layers: 8, over: false } });
        assert.strictEqual(await page.getByRole('combobox', { name: 'Connection' }).inputValue(), '0');
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});

test('a layout over the per-connection cap is marked, names the limit, and can still be downloaded', { skip }, async () => {
    const layout = JSON.parse(layoutBytes('gt3').toString('utf8'));
    for (let i = 0; i < 10; i++) layout.widgets.push({ id: 'extra' + i, type: 'fill', x: 0, y: 0, w: 100, h: 100, color: 'bg' });
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 }, acceptDownloads: true });
    try {
        const { page, errors } = await open(context, 'crowded', Buffer.from(JSON.stringify(layout)));
        const b = await settled(page, () => document.querySelector('[data-budget-conn="0"]')?.getAttribute('data-over') === 'true');
        assert.strictEqual(b.conns[0].layers, 15);
        assert.match(await page.getByRole('alert').filter({ hasText: 'limit is 8' }).innerText(), /Connection 1 has 15 layers; the limit is 8 on each connection/);
        const d = page.waitForEvent('download');
        await page.locator('[data-main-menu]').click();
        await page.locator('[data-menu-download]').click();
        assert.strictEqual(JSON.parse(fs.readFileSync(await (await d).path(), 'utf8')).widgets.length, layout.widgets.length);
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});
