'use strict';
// Seam 2 for adding cluster elements and editing their options (ticket 06), in real Chromium: a layout built from
// nothing (a minimal file with a theme and no widgets). The app author inserts widgets from the Insert menu, edits
// options, picks a role from the palette, edits a text template with the token picker, font and alignment, is refused
// with the engine's reason, and the engine's canvas follows. Finds things by data-* hooks and ARIA roles. Needs
// Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildDesigner } = require('./designer-dist.js');

let DIST;
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const MINIMAL = Buffer.from(JSON.stringify({ schemaVersion: 2, name: 'mine', theme: 'gt3', widgets: [] }));

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

/** The Designer with a minimal layout open; `frame()` is a fingerprint of the engine's canvas as last drawn. */
async function openMinimal(context) {
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
            const url = c.toDataURL();
            let h = 0;
            for (let i = 0; i < url.length; i += 7) h = (h * 31 + url.charCodeAt(i)) | 0;
            window.__frames = { n: window.__frames.n + 1, sum: url.length + ':' + h };
        });
    });
    await page.goto(ORIGIN + '/');
    await page.locator('[data-doc-kind]').waitFor();
    await page.setInputFiles('header input[type=file]', { name: 'mine.json', mimeType: 'application/json', buffer: MINIMAL });
    await page.locator('[data-cluster-canvas]').waitFor();
    await page.waitForFunction(() => window.__frames.n > 0);
    const frame = async () => { await page.waitForTimeout(400); return page.evaluate(() => window.__frames.sum); };
    return { page, errors, frame };
}

async function insert(page, type) {
    await page.locator('[data-insert]').click();
    await page.locator(`[data-insert-menu] [data-widget="${type}"]`).click();
}
const field = (page, key) => page.locator(`[data-option-row="${key}"]`);
const commit = async (page, key, v) => { const i = field(page, key).locator('input'); await i.fill(String(v)); await i.press('Enter'); };

async function download(page) {
    const d = page.waitForEvent('download');
    await page.locator('[data-main-menu]').click();
    await page.locator('[data-menu-download]').click();
    return JSON.parse(fs.readFileSync(await (await d).path(), 'utf8'));
}

test('the Insert menu lists the generic cluster widgets, and inserting adds a selected element with its options in the inspector', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openMinimal(context);
        await page.locator('[data-insert]').click();
        const types = await page.locator('[data-insert-menu] [data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')));
        assert.deepStrictEqual(types.sort(), ['arc', 'atext', 'badge', 'boxes', 'fill', 'icon', 'lights', 'revbar', 'scale', 'segbar', 'shiftbar', 'stripe', 'text'].sort());
        await page.keyboard.press('Escape');
        await insert(page, 'text');
        await page.locator('[data-element="text1"][aria-current=true]').waitFor();
        await page.locator('[data-widget-options="text1"]').waitFor();
        await insert(page, 'text');
        await page.locator('[data-element="text2"][aria-current=true]').waitFor();
        await insert(page, 'lights');
        await page.locator('[data-widget-options="lights1"]').waitFor();
        assert.deepStrictEqual(await page.locator('[data-widget-options="lights1"] [data-option-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-option-row'))),
            ['count', 'from', 'tail', 'round', 'off', 'class', 'z', 'conn']);
        assert.strictEqual(await field(page, 'count').locator('input').getAttribute('placeholder'), '12', 'the default shows');
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});

test('editing options: choices, font, role and the text template with a token, the canvas following, and the file saved with them', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors, frame } = await openMinimal(context);
        const blank = await frame();
        await insert(page, 'text');
        await page.locator('[data-widget-options="text1"]').waitFor();
        const drawn = await frame();
        assert.notStrictEqual(drawn, blank, 'the inserted text is drawn');
        await commit(page, 'text', 'HELLO');
        const hello = await frame();
        assert.notStrictEqual(hello, drawn, 'the canvas follows the template');
        await page.locator('[data-token-picker]').selectOption('rpm');
        await page.waitForFunction(() => document.querySelector('[data-option-row="text"] input').value === 'HELLO{{rpm}}');
        await field(page, 'align').locator('select').selectOption('right');
        await field(page, 'font').locator('select').selectOption('big');
        const fonts = await field(page, 'font').locator('option').evaluateAll((els) => els.map((e) => e.value));
        assert.ok(fonts.includes('m_num') && fonts.includes('head'), 'the baked fonts are listed');
        await field(page, 'color').locator('select').selectOption('accent');
        await page.locator('[data-widget-options] [data-role-swatch="accent"]').waitFor();
        const colored = await frame();
        assert.notStrictEqual(colored, hello, 'the canvas follows the font and role');
        await commit(page, 'z', 7);
        const out = await download(page);
        const w = out.widgets[0];
        assert.deepStrictEqual([w.id, w.type, w.text, w.align, w.font, w.color, w.z], ['text1', 'text', 'HELLO{{rpm}}', 'right', 'big', 'accent', 7]);
        assert.deepStrictEqual(Object.keys(out), ['schemaVersion', 'name', 'theme', 'widgets']);
        // putting an option back to its default removes the key
        await field(page, 'align').locator('select').selectOption({ label: 'Default (left)' });
        await page.waitForFunction(() => document.querySelector('[data-option-row="align"] select').value === '');
        assert.ok(!('align' in (await download(page)).widgets[0]));
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});

test('an invalid value is refused with the engine\'s reason, the field goes back, and nothing changes', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page } = await openMinimal(context);
        await insert(page, 'text');
        await page.locator('[data-widget-options="text1"]').waitFor();
        await commit(page, 'conn', 5);
        const alert = page.getByRole('alert');
        await alert.waitFor();
        assert.match(await alert.innerText(), /"conn" must be 0\.\.3 \(the connection to cluster-render\)/);
        assert.strictEqual(await field(page, 'conn').locator('input').inputValue(), '', 'the field shows what the layout has');
        await commit(page, 'z', 1.5);            // the engine sets no range on z (any whole number), so a fraction is what is refused
        assert.match(await page.getByRole('alert').innerText(), /whole number/);
        assert.ok(!('conn' in (await download(page)).widgets[0]));
    } finally { await context.close(); }
});

test('the palette is shown read-only with each role\'s colour, and the role picker offers exactly those roles', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page } = await openMinimal(context);
        await page.locator('[data-palette]').waitFor();
        const roles = await page.locator('[data-palette] [data-palette-role]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-role')));
        assert.ok(roles.includes('fg') && roles.includes('accent') && roles.includes('bg'));
        const accent = await page.locator('[data-palette-swatch="accent"]').evaluate((e) => getComputedStyle(e).backgroundColor);
        assert.strictEqual(accent, 'rgb(255, 196, 0)', 'GT3 accent');
        assert.strictEqual(await page.locator('[data-palette] input, [data-palette] select, [data-palette] button').count(), 0, 'read-only');
        await insert(page, 'text');
        await page.locator('[data-widget-options="text1"]').waitFor();
        const offered = await field(page, 'color').locator('option').evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
        assert.deepStrictEqual(offered, roles);
    } finally { await context.close(); }
});

test('a layout built from nothing with every widget saves, reopens equal, and draws', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors, frame } = await openMinimal(context);
        const blank = await frame();
        for (const t of ['boxes', 'fill', 'text', 'atext', 'revbar', 'lights', 'arc', 'segbar', 'icon', 'badge', 'scale', 'stripe', 'shiftbar']) await insert(page, t);
        const drawn = await frame();
        assert.notStrictEqual(drawn, blank, 'something is drawn');
        assert.strictEqual(await page.locator('[data-cluster-refusal]').count(), 0, 'the engine accepts it');
        const file = await download(page);
        assert.strictEqual(file.widgets.length, 13);
        await page.setInputFiles('header input[type=file]', { name: 'again.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file, null, 2)) });
        await page.locator('[data-element="stripe1"]').waitFor();
        assert.deepStrictEqual(await download(page), file);
        assert.deepStrictEqual(errors, []);
    } finally { await context.close(); }
});
