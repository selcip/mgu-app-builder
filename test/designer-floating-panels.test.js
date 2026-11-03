'use strict';
// Docked and floating panels, in the Designer's static build in real Chromium: each panel floats and docks on its
// own (the HMI page stays put on screen), a floating panel drags by its header and collapses to it, the inner edge
// resizes, the layout survives a reload, Ctrl+\ hides and shows both, and a floating panel can't be lost off screen,
// also when the window shrinks. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DESIGNER = path.join(__dirname, '..', 'designer');
const DIST = path.join(DESIGNER, 'dist');
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

let browser;
before(async () => {
    if (skip) return;
    execFileSync('npm', ['run', 'build'], { cwd: DESIGNER, stdio: 'pipe', shell: process.platform === 'win32' });     // npm is npm.cmd on Windows
    browser = await playwright.chromium.launch();
});
after(async () => { if (browser) await browser.close(); });

async function open() {
    const context = await browser.newContext({ viewport: { width: 2000, height: 1200 } });
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

const panel = (page, side) => page.locator(`[data-panel="${side}"]`);
const boxOf = (l) => l.boundingBox();
const mode = (page, side) => panel(page, side).getAttribute('data-panel-mode');

async function drag(page, from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
}
/** A point on a panel's header away from its buttons. */
async function grip(page, side) {
    const h = await boxOf(panel(page, side).locator('[data-panel-header]'));
    return { x: h.x + 40, y: h.y + h.height / 2 };
}

test('each panel floats and docks on its own; floating, it drags by its header, collapses and resizes; a reload keeps it all', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const hmi = () => boxOf(page.locator('[data-hmi-page]'));
        const area = await boxOf(page.locator('[data-panel-area]'));
        const before = await hmi();
        // float the left panel: the canvas takes the whole left side, the page stays where it was on screen
        await panel(page, 'left').locator('[data-panel-float-toggle]').click();
        assert.deepStrictEqual([await mode(page, 'left'), await mode(page, 'right')], ['floating', 'docked']);
        assert.ok(Math.abs((await boxOf(page.locator('[data-viewport]'))).x - area.x) < 1, 'the canvas starts at the left edge');
        const after = await hmi();
        assert.ok(Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1, 'the page stays put');
        let left = await boxOf(panel(page, 'left'));
        assert.deepStrictEqual([Math.round(left.x - area.x), Math.round(left.y - area.y), Math.round(left.width)], [12, 12, 240]);
        // drag it by its header
        const g = await grip(page, 'left');
        await drag(page, g, { x: g.x + 300, y: g.y + 100 });
        left = await boxOf(panel(page, 'left'));
        assert.deepStrictEqual([Math.round(left.x - area.x), Math.round(left.y - area.y)], [312, 112]);
        // resize the docked right panel from its inner (left) edge, and the floating left one from its right edge
        const r = await boxOf(panel(page, 'right').locator('[data-panel-resize]'));
        await drag(page, { x: r.x + r.width / 2, y: r.y + 300 }, { x: r.x + r.width / 2 - 80, y: r.y + 300 });
        assert.strictEqual(Math.round((await boxOf(panel(page, 'right'))).width), 400);
        const l = await boxOf(panel(page, 'left').locator('[data-panel-resize]'));
        await drag(page, { x: l.x + l.width / 2, y: l.y + 200 }, { x: l.x + l.width / 2 + 60, y: l.y + 200 });
        assert.strictEqual(Math.round((await boxOf(panel(page, 'left'))).width), 300);
        // collapse it to its header
        await panel(page, 'left').locator('[data-panel-collapse]').click();
        assert.strictEqual(await panel(page, 'left').getAttribute('data-collapsed'), 'true');
        assert.ok((await boxOf(panel(page, 'left'))).height <= 42);
        assert.strictEqual(await page.locator('[data-screen="main"]').isVisible(), false);
        // a reload keeps the layout
        await page.reload();
        await page.locator('[data-zoom-level]').waitFor();
        assert.deepStrictEqual([await mode(page, 'left'), await mode(page, 'right')], ['floating', 'docked']);
        left = await boxOf(panel(page, 'left'));
        assert.deepStrictEqual([Math.round(left.x - area.x), Math.round(left.y - area.y), Math.round(left.width)], [312, 112, 300]);
        assert.strictEqual(await panel(page, 'left').getAttribute('data-collapsed'), 'true');
        assert.strictEqual(Math.round((await boxOf(panel(page, 'right'))).width), 400);
        // expand and dock it again: back beside the canvas at its width
        await panel(page, 'left').locator('[data-panel-collapse]').click();
        assert.ok(await page.locator('[data-screen="main"]').isVisible());
        await panel(page, 'left').locator('[data-panel-float-toggle]').click();
        assert.strictEqual(await mode(page, 'left'), 'docked');
        assert.ok(Math.abs((await boxOf(page.locator('[data-viewport]'))).x - (area.x + 300)) < 1);
        // the right panel floats on its own, in its own top corner
        await panel(page, 'right').locator('[data-panel-float-toggle]').click();
        const right = await boxOf(panel(page, 'right'));
        assert.deepStrictEqual([await mode(page, 'left'), await mode(page, 'right')], ['docked', 'floating']);
        assert.ok(Math.abs(right.x + right.width - (area.x + area.width - 12)) < 1 && Math.abs(right.y - (area.y + 12)) < 1);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('Ctrl+\\ hides and shows both panels', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        await page.locator('[data-viewport]').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press('Control+\\');
        assert.strictEqual(await page.locator('[data-panel]').count(), 0);
        const area = await boxOf(page.locator('[data-panel-area]'));
        const vp = await boxOf(page.locator('[data-viewport]'));
        assert.ok(Math.abs(vp.width - area.width) < 1, 'the canvas takes the whole width');
        await page.keyboard.press('Control+\\');
        assert.strictEqual(await page.locator('[data-panel]').count(), 2);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('a floating panel cannot be dragged off screen, and comes back on screen when the window shrinks', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const inside = async () => {
            const a = await boxOf(page.locator('[data-panel-area]'));
            const p = await boxOf(panel(page, 'right'));
            return p.x >= a.x - 0.5 && p.x + p.width <= a.x + a.width + 0.5 && p.y >= a.y - 0.5 && p.y + 40 <= a.y + a.height + 0.5;
        };
        await panel(page, 'right').locator('[data-panel-float-toggle]').click();
        const g = await grip(page, 'right');
        await drag(page, g, { x: 1990, y: 1190 });
        assert.ok(await inside(), 'kept inside after dragging past the corner');
        await drag(page, await grip(page, 'right'), { x: 5, y: 5 });
        assert.ok(await inside(), 'kept inside after dragging past the other corner');
        await drag(page, await grip(page, 'right'), { x: 1700, y: 900 });
        await page.setViewportSize({ width: 1200, height: 700 });
        await page.waitForTimeout(100);
        assert.ok(await inside(), 'pulled back after the window shrank');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
