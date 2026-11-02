'use strict';
// The Designer edits a list element's default rows and the preview shows them: in the built Designer (Playwright's
// Chromium), the app author adds, edits, moves and deletes rows of a list in the property panel; the screen file
// keeps them as lines, and the preview's frame equals Node's recording of a screen file with those lines.
// Needs Playwright's Chromium (require('playwright')); skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DESIGNER = path.join(ROOT, 'designer');
const DIST = path.join(DESIGNER, 'dist');
const ORIGIN = 'http://designer.test';

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

const { zipSync, strToU8 } = require(require.resolve('fflate', { paths: [DESIGNER] }));

const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));

function drawInNode(file) {
    let got = null;
    const rt = createRuntime({
        kit, log: { error() {}, warn() {}, info() {}, log() {} },
        sink: { frame(rec) { const w = rec.words(); got = Buffer.from(w.buffer, w.byteOffset, w.byteLength); return true; } },
    });
    assert.ok(rt.load(file));
    rt.start();
    return got;
}

const design = (items) => ({
    schema: 1, first: 'faults', design: { w: 1796, h: 632 },
    screens: [{ name: 'faults', kind: 'gpu', title: 'Faults', theme: 'm_red', bg: 'theme', components: [
        { name: 'list', rtype: 'gpu', gpu: 'list', x: 40, y: 40, w: 1000, h: 500, opts: { items, rowH: 90 } }] }],
});

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let browser;

before(async () => {
    if (skip) return;
    execFileSync('npm', ['run', 'build'], { cwd: DESIGNER, stdio: 'pipe' });
    browser = await playwright.chromium.launch();
});

after(async () => { if (browser) await browser.close(); });

async function openDesigner() {
    const page = await browser.newPage({ viewport: { width: 2100, height: 1200 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(ORIGIN + '/**', (route) => {
        let p = new URL(route.request().url()).pathname;
        if (p === '/') p = '/index.html';
        const file = path.join(DIST, p);
        if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
        return route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
    });
    await page.addInitScript(() => {
        window.__frames = [];
        window.addEventListener('mgu-preview-frame', (e) => {
            const b = e.detail.words;
            let s = '';
            for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
            window.__frames.push(btoa(s));
        });
    });
    await page.goto(ORIGIN + '/');
    return { page, errors };
}

/** Waits until the preview's latest frame equals `want` (each edit redraws the preview). */
async function previewShows(page, want) {
    const b64 = want.toString('base64');
    await page.waitForFunction((w) => window.__frames.length && window.__frames[window.__frames.length - 1] === w, b64, { timeout: 15000 })
        .catch(() => assert.fail('the preview does not show the rows Node draws'));
}

async function setField(page, row, field, value) {
    const input = page.locator(`[data-rows] [data-row="${row}"] [data-field="${field}"] input`);
    await input.fill(value);
    await input.press('Enter');
}

test('the app author edits a list\'s default rows and the preview shows them', { skip }, async () => {
    const { page, errors } = await openDesigner();
    try {
        const zip = Buffer.from(zipSync({ 'screens.json': strToU8(JSON.stringify(design(''))), 'images/': new Uint8Array(0) }));
        await page.setInputFiles('input[type=file]', { name: 'design.zip', mimeType: 'application/zip', buffer: zip });
        await previewShows(page, drawInNode(design('')));
        await page.locator('[data-element="list"]').click();

        const rows = page.locator('[data-rows]');
        assert.deepStrictEqual(await rows.locator('th').allTextContents(), ['Badge', 'Title', 'Small line', '']);
        await rows.locator('[data-add-row]').click();
        await setField(page, 0, 0, '3');
        await setField(page, 0, 1, 'Engine electronics');
        await setField(page, 0, 2, '0x12 · 2 active');
        await previewShows(page, drawInNode(design('3, Engine electronics, 0x12 · 2 active')));

        await rows.locator('[data-add-row]').click();
        await setField(page, 1, 1, 'Seats');
        await rows.locator('[data-row="1"] [data-move-up]').click();
        await previewShows(page, drawInNode(design(', Seats\n3, Engine electronics, 0x12 · 2 active')));

        await rows.locator('[data-row="0"] [data-delete-row]').click();
        await previewShows(page, drawInNode(design('3, Engine electronics, 0x12 · 2 active')));

        // a field the rows can't hold is refused with the reason shown, and nothing changes
        await setField(page, 0, 1, 'Engine, electronics');
        assert.match(await page.locator('[role=alert]').textContent(), /comma/);
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});
