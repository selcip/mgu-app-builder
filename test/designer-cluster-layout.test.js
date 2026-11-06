'use strict';
// Opening a cluster layout in the Designer's static build, in real Chromium: Open takes it from the same command as
// a screen file, the toolbar says which kind is open and hides the menus that don't apply, a rename shows and is
// autosaved and restored after a reload, and Download gives <name>.json equal to the file opened. Needs Playwright's
// Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

let DIST;
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const GT3 = fs.readFileSync(path.join(__dirname, 'fixtures', 'cluster-layouts', 'gt3.json'));

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

async function openDesigner(context) {
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
    return { page, errors };
}

test('Open takes a cluster layout, the kind shows, menus that do not apply go, rename is autosaved and Download is <name>.json', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 }, acceptDownloads: true });
    try {
        const { page, errors } = await openDesigner(context);
        const kind = () => page.locator('[data-doc-kind]').getAttribute('data-doc-kind');
        assert.strictEqual(await kind(), 'screen-file');
        assert.ok(await page.locator('[data-insert]').count());

        await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: GT3 });
        await page.locator('[data-layout-panel]').waitFor();
        assert.strictEqual(await kind(), 'cluster-layout');
        assert.match(await page.locator('[data-doc-kind]').innerText(), /Cluster layout/);
        await page.locator('[data-insert]').click();
        assert.strictEqual(await page.locator('[data-insert-menu] [data-widget="revbar"]').count(), 1, 'the insert menu offers cluster widgets');
        assert.strictEqual(await page.locator('[data-insert-menu] [data-widget="button"]').count(), 0, 'not the screens' widgets');
        await page.keyboard.press('Escape');
        assert.strictEqual(await page.locator('[data-zoom-level]').count(), 1, 'zoom works on the cluster canvas');
        await page.locator('[data-main-menu]').click();
        await page.locator('[data-menu-download]').waitFor();
        assert.strictEqual(await page.locator('[data-menu-copy]').count(), 1, 'editing commands apply to the layout elements');
        assert.strictEqual(await page.locator('[data-menu-stack]').count(), 4);
        await page.keyboard.press('Escape');

        // rename
        const name = page.locator('[data-layout-name] input');
        assert.strictEqual(await name.inputValue(), 'GT3');
        await name.fill('My GT3');
        await name.press('Enter');
        assert.strictEqual(await name.inputValue(), 'My GT3');

        // autosave keeps it; a reload offers it back
        await page.waitForTimeout(500);
        await page.reload();
        await page.locator('[role=dialog]').waitFor();
        await page.getByRole('button', { name: 'Restore' }).click();
        await page.locator('[data-layout-panel]').waitFor();
        assert.strictEqual(await kind(), 'cluster-layout');
        assert.strictEqual(await page.locator('[data-layout-name] input').inputValue(), 'My GT3');

        // download: <name>.json, equal to the file opened but for the name
        const download = page.waitForEvent('download');
        await page.locator('[data-main-menu]').click();
        await page.locator('[data-menu-download]').click();
        const d = await download;
        assert.strictEqual(d.suggestedFilename(), 'My GT3.json');
        const saved = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
        const original = JSON.parse(GT3.toString('utf8'));
        assert.deepStrictEqual({ ...saved, name: original.name }, original);
        assert.deepStrictEqual(Object.keys(saved), Object.keys(original));

        // a screen file opens again from the same command
        await page.locator('[data-main-menu]').click();
        await page.locator('[data-menu-new]').click();
        await page.locator('[data-insert]').waitFor();
        assert.strictEqual(await kind(), 'screen-file');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('the guide for a cluster layout names both routes to the car, from Help and from Download; a screen file keeps its guide', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openDesigner(context);
        const guide = page.locator('[data-guide]');
        const openFrom = async (hook) => {
            await page.locator('[data-main-menu]').click();
            await page.locator(hook).click();
            await guide.waitFor();
        };
        await openFrom('[data-menu-guide]');
        assert.strictEqual(await guide.getAttribute('data-guide'), 'screen-file');
        assert.match(await guide.innerText(), /design\.zip/);
        assert.doesNotMatch(await guide.innerText(), /deploy\.sh/);
        await page.keyboard.press('Escape');
        await guide.waitFor({ state: 'detached' });

        await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: GT3 });
        await page.locator('[data-layout-panel]').waitFor();
        for (const hook of ['[data-menu-guide]', '[data-menu-to-car]']) {
            await openFrom(hook);
            assert.strictEqual(await guide.getAttribute('data-guide'), 'cluster-layout');
            const text = await guide.innerText();
            assert.match(text, /Cluster layout/);
            assert.match(text, /apps\/cluster_themes\/hud\/layouts\//);
            assert.match(text, /APP=cluster_themes \.\/scripts\/deploy\.sh root@<car-ip-or-hostname> <name>\.json/);
            assert.match(text, /data\/layouts/);
            assert.match(text, /generators/);
            assert.doesNotMatch(text, /design\.zip/);
            assert.doesNotMatch(text, /\btheme\b/i);
            await page.keyboard.press('Escape');
            await guide.waitFor({ state: 'detached' });
        }
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('a file the Designer does not read is refused with a reason and the open design stays', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openDesigner(context);
        await page.setInputFiles('header input[type=file]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1}') });
        await page.locator('[role=alert]').waitFor();
        assert.match(await page.locator('[role=alert]').innerText(), /schemaVersion/);
        assert.strictEqual(await page.locator('[data-doc-kind]').getAttribute('data-doc-kind'), 'screen-file');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
