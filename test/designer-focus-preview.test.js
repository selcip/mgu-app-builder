'use strict';
// The Designer's focus order and its preview, in its static build in real Chromium: the app author sees the focus
// order numbered on the screen, edits it and an element's action in the inspector, and tries the screen with arrow
// keys, Enter and clicks; the preview lists the actions reported, and each preview frame equals Node's recording
// after the same input. Needs Playwright's Chromium (require('playwright')); skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DESIGNER = path.join(ROOT, 'designer');
const DIST = path.join(DESIGNER, 'dist');
const ORIGIN = 'http://designer.test';

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

const { zipSync, strToU8 } = require(require.resolve('fflate', { paths: [DESIGNER] }));
const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'focus.json'), 'utf8'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let browser;

before(async () => {
    if (skip) return;
    execFileSync('npm', ['run', 'build'], { cwd: DESIGNER, stdio: 'pipe', shell: process.platform === 'win32' });     // npm is npm.cmd on Windows
    browser = await playwright.chromium.launch();
});

after(async () => { if (browser) await browser.close(); });

async function openWithFile(file) {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(ORIGIN + '/**', (route) => {
        let p = new URL(route.request().url()).pathname;
        if (p === '/') p = '/index.html';
        const f = path.join(DIST, p);
        if (!f.startsWith(DIST) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
        return route.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream' });
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
    await page.waitForFunction(() => window.__frames.length >= 1);
    const zip = Buffer.from(zipSync({ 'screens.json': strToU8(JSON.stringify(file)) }));
    await page.setInputFiles('input[type=file]', { name: 'design.zip', mimeType: 'application/zip', buffer: zip });
    await page.locator('[data-inspector-tab="prototype"]').click();      // focus order and actions are in the inspector's Prototype tab
    await page.locator('[data-focus-item]').first().waitFor();
    return { page, errors };
}

const badges = (page) => page.locator('[data-focus]').evaluateAll((els) => els.map((e) => [e.textContent, e.dataset.focus]));
const lastFrame = async (page) => Buffer.from(await page.evaluate(() => window.__frames[window.__frames.length - 1]), 'base64');

/** Node's recording of the screen after the same input: the runtime and kit, fresh module state. */
function nodeAfter(file, inputs) {
    for (const k of Object.keys(require.cache)) {
        if (k.startsWith(path.join(ROOT, 'kit') + path.sep) || k.startsWith(path.join(ROOT, 'runtime') + path.sep)) delete require.cache[k];
    }
    const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
    const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
    let got = null;
    const quiet = { error() {}, warn() {}, info() {} };
    const rt = createRuntime({ kit, log: quiet, sink: { frame(rec) { const w = rec.words(); got = Buffer.from(w.buffer, w.byteOffset, w.byteLength); return true; } } });
    rt.load(file);
    rt.start();
    for (const i of inputs) (Array.isArray(i) ? rt.touch(...i) : rt.controller(i));
    return got;
}

test('the focus order is numbered on the screen and edited in the inspector', { skip }, async () => {
    const { page, errors } = await openWithFile(FILE);
    try {
        assert.deepStrictEqual(await badges(page), [['1', 'wifi'], ['2', 'lights'], ['3', 'volume'], ['4', 'cancel'], ['5', 'save']]);
        await page.locator('[data-focus-item="save"] button[title="Earlier"]').click();
        await page.locator('[data-focus-item="lights"] button[title^="Leave out"]').click();
        assert.deepStrictEqual(await badges(page), [['1', 'wifi'], ['2', 'volume'], ['3', 'save'], ['4', 'cancel']]);
        await page.locator('[data-focus-out="heading"] button').click();
        assert.deepStrictEqual((await badges(page)).map((b) => b[1]), ['wifi', 'volume', 'save', 'cancel', 'heading']);
        await page.locator('[data-reset-focus]').click();
        assert.deepStrictEqual((await badges(page)).map((b) => b[1]), ['wifi', 'lights', 'volume', 'cancel', 'save']);
        // the action field: the element's name until another is named
        await page.locator('[data-element="cancel"]').click();
        const action = page.locator('[data-action-field] input');
        assert.strictEqual(await action.inputValue(), 'cancel');
        await action.fill('close');
        await action.press('Enter');
        assert.strictEqual(await action.inputValue(), 'close');
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});

test('trying the preview: arrow keys and Enter as the controller, clicks as taps, actions listed, drawn as in Node', { skip }, async () => {
    const { page, errors } = await openWithFile(FILE);
    try {
        await page.locator('[data-try-toggle]').check();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        assert.ok((await lastFrame(page)).equals(nodeAfter(FILE, ['right', 'right'])), 'highlight on volume as in Node');
        await page.keyboard.press('Enter');
        await page.locator('canvas').click({ position: { x: 1300, y: 540 } });     // save
        assert.ok((await lastFrame(page)).equals(nodeAfter(FILE, ['right', 'right', ['down', 1300, 540], ['up', 1300, 540]])),
            'highlight on save after the tap, as in Node');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Enter');
        const listed = await page.locator('[data-action]').evaluateAll((els) => els.map((e) => e.dataset.action));
        assert.deepStrictEqual(listed, ['volume', 'save', 'cancel']);
        assert.match(await page.locator('[data-action]').first().textContent(), /screen: 'main', element: 'volume', action: 'volume'/);
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});

test('trying a field in the preview opens the keyboard screen, drawn as in Node; the typed text is listed as its value', { skip }, async () => {
    const TEXT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'text-entry.json'), 'utf8'));
    const { page, errors } = await openWithFile(TEXT);
    try {
        await page.locator('[data-try-toggle]').check();
        await page.keyboard.press('Enter');                 // the field: the keyboard screen
        assert.ok((await lastFrame(page)).equals(nodeAfter(TEXT, ['press'])), 'keyboard screen as in Node');
        await page.locator('canvas').click({ position: { x: 100, y: 210 } });       // '1'
        for (let i = 0; i < 45; i++) await page.keyboard.press('ArrowRight');      // OK
        assert.ok((await lastFrame(page)).equals(nodeAfter(TEXT, ['press', ['down', 100, 210], ['up', 100, 210], ...Array(45).fill('right')])),
            'typed and on OK, as in Node');
        await page.keyboard.press('Enter');
        assert.ok((await lastFrame(page)).equals(nodeAfter(TEXT, ['press', ['down', 100, 210], ['up', 100, 210], ...Array(45).fill('right'), 'press'])),
            'back on the field, as in Node');
        await page.keyboard.press('Enter');                 // again, then cancel
        await page.keyboard.press('Escape');
        const listed = await page.locator('[data-action]').evaluateAll((els) => els.map((e) => e.textContent));
        assert.deepStrictEqual(listed, ["{ screen: 'main', element: 'name', action: 'rename', value: 'Bob1' }"]);
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});
