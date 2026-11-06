'use strict';
// Seam 2 for locked backdrop elements (ticket 12), in real Chromium: M and Sport open, their whole-theme widget is
// marked locked in the element list, the inspector says what it draws and shows its parameters read-only, an edit
// of its box is refused (and says why), another element can be edited, and the downloaded file equals the one
// opened but for that edit. Finds things by data-* hooks and ARIA roles. Skipped without Playwright's Chromium.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

let DIST;
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const file = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', 'cluster-layouts', n));

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

async function openLayout(context, name, firstId) {
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
    await page.setInputFiles('header input[type=file]', { name, mimeType: 'application/json', buffer: file(name) });
    await page.locator('[data-cluster-canvas]').waitFor();
    await page.locator(`[data-element="${firstId}"]`).waitFor();
    return { page, errors };
}

async function download(page) {
    const d = page.waitForEvent('download');
    await page.locator('[data-main-menu]').click();
    await page.locator('[data-menu-download]').click();
    return JSON.parse(fs.readFileSync(await (await d).path(), 'utf8'));
}

for (const [name, locked, other] of [['m.json', 'backdrop', 'speed'], ['sport.json', 'sport', 'speed']]) {
    test(`${name}: the locked element is marked, explained, refuses a box edit, and the file round-trips around it`, { skip }, async () => {
        const context = await browser.newContext({ viewport: { width: 2400, height: 1300 }, acceptDownloads: true });
        try {
            const { page, errors } = await openLayout(context, name, locked);
            const original = JSON.parse(file(name).toString('utf8'));

            // marked in the list; ordinary elements are not
            await page.locator(`[data-element="${locked}"] [data-lock-marker]`).waitFor();
            assert.strictEqual(await page.locator(`[data-element="${other}"] [data-lock-marker]`).count(), 0);
            assert.strictEqual(await page.locator('[data-element][data-locked]').first().getAttribute('data-element') !== null, true);

            // the note says what it draws and why it is locked; the parameters are shown read-only
            await page.locator(`[data-element="${locked}"]`).click();
            const note = page.locator(`[data-locked-note="${locked}"]`);
            await note.waitFor();
            const text = await note.innerText();
            assert.match(text, /draws/);
            assert.match(text, /cannot be edited|cannot be moved|can.t be/i);
            const params = await page.locator(`[data-locked-params="${locked}"]`).innerText();
            const w = original.widgets.find((x) => x.id === locked);
            assert.ok(params.includes(`"${Object.keys(w).find((k) => !['id', 'type', 'x', 'y', 'w', 'h'].includes(k))}"`));
            assert.strictEqual(await page.locator(`[data-locked-params="${locked}"]`).evaluate((e) => e.tagName), 'PRE');

            // try an edit of its box: refused with the reason, nothing changes
            const x = page.locator(`[data-box="${locked}"] input`).first();
            await x.fill('37');
            await x.press('Enter');
            await page.getByRole('alert').filter({ hasText: /locked/ }).waitFor();
            await page.keyboard.press('ArrowRight');
            await page.getByRole('alert').filter({ hasText: /locked/ }).waitFor();

            // another element is edited; the download equals the file but for that edit (the shader parameters untouched)
            await page.locator(`[data-element="${other}"]`).click();
            for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
            await page.locator(`[data-element="${locked}"]`).click();
            const saved = await download(page);
            const expected = JSON.parse(file(name).toString('utf8'));
            expected.widgets.find((x2) => x2.id === other).x += 3;
            assert.deepStrictEqual(saved, expected);
            assert.strictEqual(JSON.stringify(saved.widgets.find((x2) => x2.id === locked)), JSON.stringify(w), 'parameters and key order exactly');
            assert.deepStrictEqual(errors, []);
        } finally {
            await context.close();
        }
    });
}
