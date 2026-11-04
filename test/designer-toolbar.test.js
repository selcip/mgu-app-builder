'use strict';
// The toolbar, in the Designer's static build in real Chromium: the insert menu finds a widget and adds it by click
// or by dragging it onto the screen; the View menu sets the grid, snapping, the focus numbers and guides; the main
// menu's editing commands and Download; Play tries the app with the panels out of the way and brings them back. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

const DESIGNER = path.join(__dirname, '..', 'designer');
let DIST;     // this file's own build of the Designer (designer-dist.js)
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const W = 1796, H = 632;

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

async function open() {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 }, acceptDownloads: true });
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
    await page.locator('[data-zoom-level]').waitFor();
    return { context, page, errors };
}

/** Closes any open menu or popover (Escape once per level) and waits until it is gone. */
async function closeMenus(page) {
    const open = page.locator('[data-slot="dropdown-menu-content"], [data-slot="popover-content"]');
    for (let i = 0; i < 3 && (await open.count()); i++) await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-slot="dropdown-menu-content"], [data-slot="popover-content"]'));
}

const elements = (page) => page.locator('[data-element]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element')));
const box = (page) => page.locator('[data-box] input').evaluateAll((els) => els.map((e) => Number(e.value)));

test('the insert menu finds widgets by name and adds one by click or by dragging it onto the screen', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        await page.locator('[data-insert]').click();
        await page.locator('[data-insert-search]').fill('slid');
        assert.deepStrictEqual(await page.locator('[data-insert-menu] [data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget'))), ['slider']);
        await page.locator('[data-insert-menu] [data-widget="slider"]').click();
        await page.locator('[data-insert-menu]').waitFor({ state: 'detached' });       // the menu closes
        assert.deepStrictEqual(await elements(page), ['slider1']);
        assert.strictEqual(await page.locator('[data-element="slider1"]').getAttribute('aria-current'), 'true');
        // Enter adds the first match
        await page.locator('[data-insert]').click();
        await page.locator('[data-insert-search]').fill('qr');
        await page.keyboard.press('Enter');
        await page.locator('[data-insert-menu]').waitFor({ state: 'detached' });
        assert.deepStrictEqual(await elements(page), ['slider1', 'qr1']);
        // drag a button onto the middle of the screen: it lands centred there (on the grid), selected
        await page.locator('[data-insert]').click();
        const layer = await page.locator('[data-canvas]').boundingBox();
        await page.locator('[data-insert-menu] [data-widget="button"]').dragTo(page.locator('[data-canvas]'), {
            targetPosition: { x: 900 * (layer.width / W), y: 300 * (layer.height / H) },
        });
        assert.deepStrictEqual(await elements(page), ['slider1', 'qr1', 'button1']);
        const [x, y, w, h] = await box(page);
        assert.ok(Math.abs(x + w / 2 - 900) <= 8 && Math.abs(y + h / 2 - 300) <= 8, `centred on the drop (${x},${y} ${w}x${h})`);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('the View menu sets the grid, snapping, the focus numbers and guides', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        await page.locator('[data-insert]').click();
        await page.locator('[data-insert-menu] [data-widget="button"]').click();
        // a 32 px grid: Shift+arrow moves a grid step
        await page.locator('[data-view-menu]').click();
        await page.locator('[data-view-grid]').click();
        await page.locator('[data-grid="32"]').click();
        await closeMenus(page);
        await page.locator('[data-element="button1"]').click();
        const [x0] = await box(page);
        await page.locator('body').press('Shift+ArrowRight');
        assert.strictEqual((await box(page))[0], x0 + 32);
        // snapping off, then the focus numbers off
        await page.locator('[data-view-menu]').click();
        assert.strictEqual(await page.locator('[data-view-snap]').getAttribute('aria-checked'), 'true');
        await page.locator('[data-view-snap]').click();
        await closeMenus(page);
        await page.locator('[data-view-menu]').click();
        assert.strictEqual(await page.locator('[data-view-snap]').getAttribute('aria-checked'), 'false');
        assert.strictEqual(await page.locator('[data-focus]').count(), 1);
        await page.locator('[data-view-focus]').click();
        await closeMenus(page);
        assert.strictEqual(await page.locator('[data-focus]').count(), 0);
        // guides across the middle, then removed
        await page.locator('[data-view-menu]').click();
        await page.locator('[data-view-add-vguide]').click();
        await closeMenus(page);
        await page.locator('[data-view-menu]').click();
        await page.locator('[data-view-add-hguide]').click();
        await closeMenus(page);
        assert.deepStrictEqual([await page.locator('.guide.v').count(), await page.locator('.guide.h').count()], [1, 1]);
        await page.locator('[data-view-menu]').click();
        await page.locator('[data-view-clear-guides]').click();
        assert.strictEqual(await page.locator('.guide').count(), 0);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('the main menu duplicates, copies and pastes, deletes, and downloads the design', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        await page.locator('[data-insert]').click();
        await page.locator('[data-insert-menu] [data-widget="button"]').click();
        const menu = async (item) => { await page.locator('[data-main-menu]').click(); await page.locator(`[data-menu-${item}]`).click(); };
        await menu('duplicate');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2']);
        await menu('copy');
        await menu('paste');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2', 'button3']);
        await menu('delete');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2']);
        const download = page.waitForEvent('download');
        await menu('download');
        assert.strictEqual((await download).suggestedFilename(), 'design.zip');
        await menu('new');
        assert.deepStrictEqual(await elements(page), []);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('Play tries the app: the panels step aside (the page stays put) for a report card; Stop brings them back as they were', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        await page.locator('[data-panel="right"] [data-panel-float-toggle]').click();      // one docked, one floating
        await page.locator('[data-insert]').click();
        await page.locator('[data-insert-menu] [data-widget="button"]').click();
        const before = await page.locator('[data-hmi-page]').boundingBox();
        await page.locator('[data-try-toggle]').click();
        assert.strictEqual(await page.locator('[data-try-toggle]').getAttribute('aria-checked'), 'true');
        assert.strictEqual(await page.locator('[data-panel]').count(), 0);
        assert.ok(await page.locator('[data-try-panel]').isVisible());
        const during = await page.locator('[data-hmi-page]').boundingBox();
        assert.ok(Math.abs(during.x - before.x) < 1 && Math.abs(during.y - before.y) < 1, 'the page stays put');
        assert.strictEqual(await page.locator('[data-insert]').count(), 0, 'no adding widgets while trying');
        await page.keyboard.press('Enter');                 // the controller presses the button
        await page.locator('[data-try-panel] [data-action="button1"]').waitFor();
        await page.locator('[data-try-toggle]').click();
        assert.strictEqual(await page.locator('[data-try-toggle]').getAttribute('aria-checked'), 'false');
        assert.strictEqual(await page.locator('[data-try-panel]').count(), 0);
        assert.deepStrictEqual([await page.locator('[data-panel="left"]').getAttribute('data-panel-mode'), await page.locator('[data-panel="right"]').getAttribute('data-panel-mode')], ['docked', 'floating']);
        const after = await page.locator('[data-hmi-page]').boundingBox();
        assert.ok(Math.abs(after.x - before.x) < 1, 'and after');
        // trying again starts with an empty report
        await page.locator('[data-try-toggle]').click();
        assert.strictEqual(await page.locator('[data-try-panel] [data-action]').count(), 0);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
