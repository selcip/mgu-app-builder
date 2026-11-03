'use strict';
// Seam 1, the golden test: the Designer's preview (its static build, in real Chromium) and Node draw the same
// screen files into identical recordings. An app author uploads a zip, the Designer lists its screens and previews
// the first; selecting each screen in turn previews it. Every preview frame's draw commands must equal the ones the
// runtime and the vendored kit produce in Node for the same screen, drawn in the same order from a fresh start.
// Needs Playwright's Chromium (require('playwright')); skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const DESIGNER = path.join(ROOT, 'designer');
const DIST = path.join(DESIGNER, 'dist');
const ORIGIN = 'http://designer.test';

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

const { zipSync, strToU8 } = require(require.resolve('fflate', { paths: [DESIGNER] }));

// --- Node side: the runtime and kit, fresh module state per screen file (ramp/layer ids are process-global)

function freshNode() {
    for (const k of Object.keys(require.cache)) {
        if (k.startsWith(path.join(ROOT, 'kit') + path.sep) || k.startsWith(path.join(ROOT, 'runtime') + path.sep)) {
            delete require.cache[k];
        }
    }
    const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
    const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
    return (file, screen, images) => {
        let got = null;
        const quiet = { error() {}, warn() {}, info() {}, log() {} };
        const rt = createRuntime({
            kit, log: quiet, readImage: (p) => (images && images[p]) || null,
            sink: { frame(rec) { const w = rec.words(); got = Buffer.from(w.buffer, w.byteOffset, w.byteLength); return true; } },
        });
        assert.ok(rt.load(file), `Node loads ${screen}`);
        assert.ok(rt.start(screen), `Node starts on ${screen}`);
        return got;
    };
}

// --- browser side: the built Designer served from dist/ through Playwright's router (no server)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let browser;

before(async () => {
    if (skip) return;
    execFileSync('npm', ['run', 'build'], { cwd: DESIGNER, stdio: 'pipe' });
    browser = await playwright.chromium.launch();
});

after(async () => { if (browser) await browser.close(); });

async function openDesigner() {
    const page = await browser.newPage({ viewport: { width: 2100, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(ORIGIN + '/**', (route) => {
        let p = new URL(route.request().url()).pathname;
        if (p === '/') p = '/index.html';
        const file = path.join(DIST, p);
        if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
        return route.fulfill({ body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
    });
    // every preview frame, as the Designer announces it: { screen, words (bytes, little-endian) }
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
    return { page, errors };
}

const framesOf = (page) => page.evaluate(() => window.__frames);

async function waitFrames(page, n) {
    await page.waitForFunction((k) => window.__frames.length >= k, n, { timeout: 30000 });
    return framesOf(page);
}

function zipOf(file, images) {
    return Buffer.from(zipSync(Object.assign({ 'screens.json': strToU8(JSON.stringify(file, null, 2)), 'images/': new Uint8Array(0) }, images)));
}

async function previewEveryScreen(file, images, onPage) {
    const { page, errors } = await openDesigner();
    try {
        // the Designer opens on a new screen file and previews it; count the frames from the upload on
        await waitFrames(page, 1);
        await page.evaluate(() => { window.__frames = []; });
        await page.setInputFiles('header input[type=file]', { name: 'design.zip', mimeType: 'application/zip', buffer: zipOf(file, images) });
        const names = file.screens.map((s) => s.name);
        const first = file.first !== undefined ? file.first : names[0];
        await waitFrames(page, 1);
        // the list shows every screen, in file order
        assert.deepStrictEqual(await page.locator('[data-screen]').evaluateAll((els) => els.map((e) => e.dataset.screen)), names);
        // selecting each screen previews it (the one already shown is not drawn again)
        let shown = first;
        let n = 1;
        for (const name of names) {
            await page.locator(`[data-screen="${name}"]`).click();
            if (name !== shown) { n++; shown = name; }
            const frames = await waitFrames(page, n);
            assert.strictEqual(frames[frames.length - 1].screen, name);
            // the HMI page's title bar shows the screen's title (or its name, when it has none)
            const screen = file.screens.find((s) => s.name === name);
            assert.strictEqual(await page.locator('[data-hmi-title]').textContent(), screen.title || screen.name);
        }
        assert.deepStrictEqual(errors, []);
        if (onPage) await onPage(page);
        const frames = await framesOf(page);
        assert.strictEqual(frames.length, n, 'one frame per screen shown');
        return frames.map((f) => ({ screen: f.screen, words: Buffer.from(f.words, 'base64') }));
    } finally {
        await page.close();
    }
}

async function assertSameAsNode(file, images, onPage) {
    const frames = await previewEveryScreen(file, images, onPage);
    const draw = freshNode();
    for (const f of frames) {
        const want = draw(file, f.screen, images);
        assert.ok(want.length > 0);
        assert.ok(f.words.equals(want), `preview of ${f.screen}: ${f.words.length} bytes differ from Node's ${want.length}`);
    }
}

test('a schema 1 screen file previews in the browser exactly as Node draws it', { skip }, async () => {
    const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'two-screens.json'), 'utf8'));
    await assertSameAsNode(file);
});

test('every Store iDrive 7 screen previews in the browser exactly as Node draws it', { skip }, async () => {
    const { compact } = require(path.join(__dirname, 'fixtures', 'mgu-store', 'store_compact.js'));
    await assertSameAsNode(JSON.parse(JSON.stringify(compact(1796, 632))));
});

test('pictures under images/ preview in the browser exactly as Node draws them', { skip }, async () => {
    const { Canvas } = require(path.join(ROOT, 'kit', 'kit_canvas.js'));
    const red = new Canvas(16, 16);
    for (let i = 0; i < red.d.length; i += 4) red.d.set([255, 0, 0, 255], i);
    const file = {
        schema: 1, first: 'main', design: { w: 1796, h: 632 },
        screens: [{ name: 'main', kind: 'gpu', title: 'Main', theme: 'm_tricolour', bg: '#000000', components: [
            { name: 'logo', rtype: 'gpu', gpu: 'image', x: 100, y: 100, w: 200, h: 100, opts: { src: 'images/red.png', radius: 0 } },
            { name: 'app', rtype: 'gpu', gpu: 'appIcon', x: 400, y: 100, w: 187, h: 187, opts: { icon: 'images/red.png', vicon: 'gauge' } },
            { name: 'lost', rtype: 'gpu', gpu: 'image', x: 700, y: 100, w: 200, h: 100, opts: { src: 'images/lost.png', radius: 0 } },
        ] }],
    };
    await assertSameAsNode(file, { 'images/red.png': new Uint8Array(red.png()) }, async (page) => {
        // the PNG is on the canvas, and the picture the design lacks is reported
        const px = await page.evaluate(() => Array.from(document.querySelector('.hmi-page canvas').getContext('2d').getImageData(200, 150, 1, 1).data));
        assert.deepStrictEqual(px, [255, 0, 0, 255]);
        assert.match(await page.locator('[data-missing]').textContent(), /images\/lost\.png.*main \/ lost/);
    });
});
