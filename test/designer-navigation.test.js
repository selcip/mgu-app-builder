'use strict';
// Navigation in the Designer, in its static build in real Chromium: the app author links an element to a screen,
// sees the links in the navigation view, is warned about links to screens that no longer exist (also after deleting
// a screen; renaming one keeps its links), and walks through the app in Try mode, links and BACK included. Each
// preview frame equals Node's recording after the same walk. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const { buildDesigner } = require('./designer-dist.js');

const ROOT = path.join(__dirname, '..');
const DESIGNER = path.join(ROOT, 'designer');
let DIST;     // this file's own build of the Designer (designer-dist.js)
const ORIGIN = 'http://designer.test';

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

const { zipSync, strToU8 } = require(require.resolve('fflate', { paths: [DESIGNER] }));
const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'navigation.json'), 'utf8'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let browser;

before(async () => {
    if (skip) return;
    DIST = buildDesigner();
    browser = await playwright.chromium.launch();
});

after(async () => { if (browser) await browser.close(); });

async function openWithFile(file) {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } });
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
            window.__frames.push({ screen: e.detail.screen, words: btoa(s) });
        });
    });
    await page.goto(ORIGIN + '/');
    await page.waitForFunction(() => window.__frames.length >= 1);
    const zip = Buffer.from(zipSync({ 'screens.json': strToU8(JSON.stringify(file)) }));
    await page.setInputFiles('input[type=file]', { name: 'design.zip', mimeType: 'application/zip', buffer: zip });
    await tab(page, 'prototype');           // links, the link field and the navigation view are in the inspector's Prototype tab
    await page.locator('[data-link="home:toSettings"]').waitFor();
    return { page, errors };
}

/** Shows one of the inspector's tabs: 'design' or 'prototype'. */
const tab = (page, name) => page.locator(`[data-inspector-tab="${name}"]`).click();

const lastFrame = async (page) => {
    const f = await page.evaluate(() => window.__frames[window.__frames.length - 1]);
    return { screen: f.screen, words: Buffer.from(f.words, 'base64') };
};
const title = (page) => page.locator('[data-hmi-title]').textContent();
const listed = (page, attr) => page.locator(`[data-try-panel] [${attr}]`).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), attr);
const deadCount = async (page) => {
    const p = page.locator('[data-dead-links]');
    return (await p.count()) ? Number(await p.getAttribute('data-dead-links')) : 0;
};

/** Node's recording after the same walk: start (on the first screen, then `open` if given) and the inputs. */
function nodeAfter(file, open, inputs) {
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
    if (open) rt.open(open);
    for (const i of inputs) rt.controller(i);
    return got;
}

test('walking through the app in Try mode: links and BACK, drawn as in Node, screen changes and leaving listed', { skip }, async () => {
    const { page, errors } = await openWithFile(FILE);
    try {
        await page.locator('[data-try-toggle]').check();
        await page.keyboard.press('Enter');                 // toSettings -> settings
        assert.strictEqual(await title(page), 'Settings');
        let f = await lastFrame(page);
        assert.strictEqual(f.screen, 'settings');
        assert.ok(f.words.equals(nodeAfter(FILE, null, ['press'])), 'settings as in Node');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');                 // more -> details
        assert.strictEqual(await title(page), 'Details');
        await page.keyboard.press('Escape');                // BACK -> settings, highlight on more
        assert.strictEqual(await title(page), 'Settings');
        f = await lastFrame(page);
        assert.ok(f.words.equals(nodeAfter(FILE, null, ['press', 'right', 'right', 'press', 'back'])), 'back on settings as in Node');
        await page.keyboard.press('Escape');                // BACK -> home
        await page.keyboard.press('Escape');                // BACK on the first screen: leaves the app
        assert.strictEqual(await title(page), 'Home');
        assert.deepStrictEqual(await listed(page, 'data-screen-change'), ['home', 'settings', 'details', 'settings', 'home']);
        assert.deepStrictEqual(await listed(page, 'data-leave'), ['home']);
        assert.deepStrictEqual(await listed(page, 'data-action'), ['toSettings', 'more']);
        // stopping the walk on a screen goes on editing it
        await page.keyboard.press('Enter');                 // -> settings
        await page.locator('[data-try-toggle]').uncheck();
        assert.strictEqual(await page.locator('[data-screen][aria-current="true"]').getAttribute('data-screen'), 'settings');
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});

test('trying from a screen that is not the first: the walk starts there, BACK leads to the first screen', { skip }, async () => {
    const { page, errors } = await openWithFile(FILE);
    try {
        await page.locator('[data-screen="settings"]').click();
        await page.locator('[data-try-toggle]').check();
        assert.strictEqual(await title(page), 'Settings');
        assert.ok((await lastFrame(page)).words.equals(nodeAfter(FILE, 'settings', [])), 'settings as in Node');
        await page.keyboard.press('Escape');
        assert.strictEqual(await title(page), 'Home');
        assert.ok((await lastFrame(page)).words.equals(nodeAfter(FILE, 'settings', ['back'])), 'home as in Node');
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});

test('linking an element, the navigation view and dead-link warnings, also after deleting or renaming a screen', { skip }, async () => {
    const { page, errors } = await openWithFile(FILE);
    try {
        assert.strictEqual(await deadCount(page), 1, 'details links to a screen that is not in the file');
        assert.match(await page.locator('[data-link="details:gone"]').textContent(), /nowhere \(missing\)/);
        // link ping to about
        await page.locator('[data-element="ping"]').click();
        assert.strictEqual(await page.locator('[data-link-field]').inputValue(), '');
        await page.locator('[data-link-field]').selectOption('about');
        assert.match(await page.locator('[data-link="home:ping"]').textContent(), /ping → about/);
        // the help button reports 'help': the view names the element and its action
        assert.match(await page.locator('[data-link="home:help"]').textContent(), /helpButton \[help\] → about/);
        // deleting about leaves both links dead, flagged in the link field too
        await page.locator('[data-screen="about"]').click();
        await tab(page, 'design');
        await page.locator('[data-delete-screen]').click();
        await tab(page, 'prototype');
        assert.strictEqual(await deadCount(page), 3);
        await page.locator('[data-link="home:ping"] button').click();          // selects home and ping
        assert.match(await page.locator('[data-link-problem]').textContent(), /“about” no longer exists/);
        await page.locator('[data-link-field]').selectOption('');               // unlink
        assert.strictEqual(await deadCount(page), 2);
        // renaming settings keeps the link to it
        await page.locator('[data-screen="settings"]').click();
        await tab(page, 'design');
        const name = page.locator('[data-screen-name] input');
        await name.fill('options');
        await name.press('Enter');
        await tab(page, 'prototype');
        assert.match(await page.locator('[data-link="home:toSettings"]').textContent(), /→ options$/);
        assert.strictEqual(await deadCount(page), 2);
        assert.deepStrictEqual(errors, []);
    } finally {
        await page.close();
    }
});
