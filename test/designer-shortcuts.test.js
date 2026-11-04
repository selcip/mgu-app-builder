'use strict';
// Figma's editing shortcuts, in the Designer's static build in real Chromium: undo/redo, copy/cut/paste/duplicate,
// Delete and Backspace, arrow nudges (Shift: a grid step; Alt: resize), select all, Escape. Typing in a field never
// triggers one, and while trying the keys are the controller's. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let DIST;

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

/** The Designer with two buttons, a and b, on the 8 px grid; a selected (the focus on its row in the element list). */
async function open() {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
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
    for (let i = 0; i < 2; i++) {
        await page.locator('[data-insert]').click();
        await page.locator('[data-insert-menu] [data-widget="button"]').click();
        await page.locator('[data-insert-menu]').waitFor({ state: 'detached' });
    }
    await page.locator('[data-element="button1"]').click();
    await page.locator('[data-box="button1"]').waitFor();
    return { context, page, errors };
}

/** The selected screen's elements in stacking order, bottom first (as the canvas lays them out). */
const elements = (page) => page.locator('[data-canvas-element]').evaluateAll((els) => els.map((e) => e.getAttribute('data-canvas-element')));
const selection = (page) => page.locator('[data-element][aria-current="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element')));
const box = (page) => page.locator('[data-box] input').evaluateAll((els) => els.map((e) => Number(e.value)));

test('copy, cut, paste, duplicate, delete, undo, redo and select all from the keyboard', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const k = (key) => page.keyboard.press(key);
        await k('Control+d');
        assert.deepStrictEqual([await elements(page), await selection(page)], [['button1', 'button2', 'button3'], ['button3']]);
        await k('Control+c');
        await k('Control+v');
        assert.deepStrictEqual([await elements(page), await selection(page)], [['button1', 'button2', 'button3', 'button4'], ['button4']]);
        await k('Control+x');
        assert.deepStrictEqual([await elements(page), await selection(page)], [['button1', 'button2', 'button3'], []]);
        await k('Control+v');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2', 'button3', 'button4']);
        await k('Delete');
        await page.locator('[data-element="button3"]').click();
        await k('Backspace');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2']);
        await k('Control+z');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2', 'button3']);
        await k('Control+Shift+z');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2']);
        await k('Control+z');
        await k('Control+y');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2']);
        await k('Control+a');
        assert.deepStrictEqual(await selection(page), ['button1', 'button2']);
        await k('Escape');
        assert.deepStrictEqual(await selection(page), []);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('stacking order from the keyboard, the main menu and the canvas’s right-click menu', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const k = (key) => page.keyboard.press(key);
        await k('Control+d');                                                    // button3, selected, on top
        await page.locator('[data-element="button1"]').click();
        await k('Control+]');
        assert.deepStrictEqual(await elements(page), ['button2', 'button1', 'button3']);
        await k('Control+Shift+]');
        assert.deepStrictEqual(await elements(page), ['button2', 'button3', 'button1']);
        await k('Control+[');
        assert.deepStrictEqual(await elements(page), ['button2', 'button1', 'button3']);
        await k('Control+Shift+[');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2', 'button3']);
        await k('Control+z');
        assert.deepStrictEqual(await elements(page), ['button2', 'button1', 'button3']);
        // the main menu: at the bottom, Send backward and Send to back are disabled
        await k('Control+Shift+[');
        await page.locator('[data-main-menu]').click();
        assert.strictEqual(await page.locator('[data-menu-stack="back"]').getAttribute('aria-disabled'), 'true');
        await page.locator('[data-menu-stack="front"]').click();
        assert.deepStrictEqual(await elements(page), ['button2', 'button3', 'button1']);
        // right-click an element that isn't selected: it is selected, and the menu acts on it
        await page.locator('[data-canvas-element="button2"]').click({ button: 'right' });
        await page.locator('[data-canvas-menu]').waitFor();
        assert.deepStrictEqual(await selection(page), ['button2']);
        await page.locator('[data-canvas-stack="forward"]').click();
        assert.deepStrictEqual(await elements(page), ['button3', 'button2', 'button1']);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('the element list shows the top element first, and dragging rows (one or a selection) restacks them', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const rows = () => page.locator('[data-element]').evaluateAll((els) => els.map((e) => e.getAttribute('data-element')));
        await page.keyboard.press('Control+d');                                 // button3 on top
        assert.deepStrictEqual(await rows(), ['button3', 'button2', 'button1']);
        const row = (n) => page.locator(`[data-element="${n}"]`);
        // button1 dragged onto the top half of button3's row: above it, so on top
        await row('button1').dragTo(row('button3'), { targetPosition: { x: 20, y: 3 } });
        assert.deepStrictEqual(await elements(page), ['button2', 'button3', 'button1']);
        assert.deepStrictEqual(await rows(), ['button1', 'button3', 'button2']);
        assert.deepStrictEqual(await selection(page), ['button1']);
        // button1 and button3 selected, dragged below button2: to the bottom, button1 still over button3
        await row('button3').click({ modifiers: ['Shift'] });
        await row('button3').dragTo(row('button2'), { targetPosition: { x: 20, y: 24 } });
        assert.deepStrictEqual(await elements(page), ['button3', 'button1', 'button2']);
        await page.keyboard.press('Control+z');
        assert.deepStrictEqual(await elements(page), ['button2', 'button3', 'button1'], 'one undo step');
        assert.strictEqual(await page.locator('[data-drop-line]').count(), 0, 'no drop line left over');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('arrows move the selection 1 px, with Shift a grid step; Alt + arrows resize it', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const [x, y, w, h] = await box(page);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowUp');
        assert.deepStrictEqual(await box(page), [x + 2, y - 1, w, h]);
        await page.keyboard.press('Shift+ArrowDown');
        await page.keyboard.press('Shift+ArrowLeft');
        assert.deepStrictEqual(await box(page), [x + 2 - 8, y - 1 + 8, w, h]);
        await page.keyboard.press('Alt+ArrowRight');
        await page.keyboard.press('Alt+ArrowDown');
        assert.deepStrictEqual(await box(page), [x - 6, y + 7, w + 1, h + 1]);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('typing in a field never triggers a shortcut; while trying the keys are the controller\'s', { skip }, async () => {
    const { context, page, errors } = await open();
    try {
        const name = page.locator('[data-properties] [data-option] input').first();     // the button's text
        await name.click();
        await name.press('Control+a');
        await name.press('Backspace');
        await page.keyboard.type('Save');
        await name.press('ArrowLeft');
        await name.press('Delete');
        await name.press('Control+d');
        await name.press('Control+z');
        assert.deepStrictEqual(await elements(page), ['button1', 'button2'], 'no element was deleted, duplicated or undone');
        assert.deepStrictEqual(await selection(page), ['button1']);
        assert.strictEqual(await name.inputValue(), 'Save', 'the field kept its own keys (Ctrl+Z there is the input undoing its Delete)');
        await name.press('Enter');
        // trying: Delete and Ctrl+D do nothing to the design, Escape is BACK
        await page.locator('[data-try-toggle]').click();
        await page.keyboard.press('Delete');
        await page.keyboard.press('Control+d');
        await page.locator('[data-try-toggle]').click();
        assert.deepStrictEqual(await elements(page), ['button1', 'button2']);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
