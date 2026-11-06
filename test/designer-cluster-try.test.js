'use strict';
// Seam 2, Trying a cluster layout: the Designer (its static build, in real Chromium) runs the layout on demo signals.
// A slider moved to a value must give the pixels the apps repo's stage draws for the Node engine fed the same signals
// (the reference is built as in designer-cluster-golden.test.js: the vendored engine in Node, fed through feed(), the
// vendored engine/bench/stage.js drawing its scene at the frame's time, a fixed clock). GT3's shift lights turn red at
// the shift point (redline 7000 less 300), so the frame at 6800 rpm must equal the reference and differ from 3000.
// Also: the demo drive starts and the frames change, and leaving Trying leaves the layout, its undo history and its
// frame as they were. Needs Playwright's Chromium; skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildDesigner } = require('./designer-dist.js');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'cluster-layouts');
const STAGE_JS = path.join(ROOT, 'engine', 'bench', 'stage.js');
const ORIGIN = 'http://designer.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const CLOCK = new Date(2026, 10, 6, 13, 37, 0);

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* skipped below */ }
const skip = playwright ? false : 'playwright is not installed';

let DIST, browser, SIG;
before(async () => {
    if (skip) return;
    SIG = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'store', 'signals.ts')).href);
    DIST = buildDesigner();
    browser = await playwright.chromium.launch();
});
after(async () => { if (browser) await browser.close(); });

const layoutFile = (name) => fs.readFileSync(path.join(FIXTURES, name + '.json'));

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
    await page.addInitScript(() => {
        window.__frames = 0;
        window.__last = null;
        window.addEventListener('mgu-cluster-frame', (e) => {
            const c = document.querySelector('[data-cluster-canvas]');
            window.__frames++;
            window.__last = { t: e.detail.t, layers: e.detail.layers, w: c.width, h: c.height, data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
        });
    });
    await page.goto(ORIGIN + '/');
    await page.locator('[data-doc-kind]').waitFor();
    await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: layoutFile('gt3') });
    await page.locator('[data-cluster-canvas]').waitFor();
    await page.waitForFunction(() => window.__last && window.__last.layers === 8, null, { timeout: 30000 });
    return { page, errors };
}

const FRAME_BASE64 = () => {
    const d = window.__last.data;
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.readAsDataURL(new Blob([d])); });
};

/** The layout through the engine in Node, fed the signals as the car sends them: the scene and each image layer's pixels. */
async function nodeScene(layout, signals) {
    const { createEngine } = require('../cluster/node.js');
    const RealDate = Date;
    const fixed = CLOCK.getTime();
    global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } };
    const engine = createEngine({ name: 'design', layout });
    try {
        if (signals) SIG.feedsOf(signals).forEach((f) => engine.feed(f.iface, f.field, f.value));
        const t0 = Date.now();
        for (;;) {
            const s = engine.scene();
            if (s.length && /layers/.test(engine.status())) break;
            if (Date.now() - t0 > 10000) throw new Error('the engine drew nothing: ' + engine.status());
            await new Promise((r) => setTimeout(r, 25));
        }
        await new Promise((r) => setTimeout(r, 600));
        const scene = JSON.parse(JSON.stringify(engine.scene()));
        const pixels = {};
        scene.filter((l) => l.kind !== 'effect').forEach((l) => {
            const px = engine.pixelRect({ key: l.key, x: 0, y: 0, w: l.iw, h: l.ih });
            if (px) pixels[l.key] = Buffer.from(px).toString('base64');
        });
        return { scene, pixels, targets: engine.targets };
    } finally {
        engine.stop();
        global.Date = RealDate;
    }
}

async function referenceFrame(context, ref, t) {
    const page = await context.newPage();
    try {
        await page.setContent('<canvas id="c"></canvas>');
        await page.addScriptTag({ content: 'var module = { exports: {} };' });
        await page.addScriptTag({ path: STAGE_JS });
        return await page.evaluate(async ({ scene, pixels, targets, t }) => {
            const canvas = document.getElementById('c');
            const stage = module.exports.createStage({ canvas });
            stage.setView('panel', targets);
            stage.setScene(scene);
            const bytes = (b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
            scene.forEach((l) => { if (pixels[l.key]) stage.putPixels(l.key, l.iw, l.ih, 0, 0, l.iw, l.ih, bytes(pixels[l.key])); });
            stage.draw(t);
            const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve({ w: canvas.width, h: canvas.height, b64: String(r.result).split(',')[1] }); r.readAsDataURL(new Blob([d])); });
        }, { scene: ref.scene, pixels: ref.pixels, targets: ref.targets, t });
    } finally {
        await page.close();
    }
}

function firstDifference(a, b) {
    let first = null, n = 0;
    for (let i = 0; i < a.length; i += 4) {
        if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
        if (!first) first = `pixel ${(i >> 2) % 1920},${Math.floor((i >> 2) / 1920)}: rgba(${a.slice(i, i + 4)}) vs rgba(${b.slice(i, i + 4)})`;
        n++;
    }
    let x0=1e9,y0=1e9,x1=-1,y1=-1; for (let i=0;i<a.length;i+=4){ if (a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){const x=(i>>2)%1920,y=Math.floor((i>>2)/1920);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);} }
    return n ? `${first}; ${n} pixels differ in ${x0},${y0}-${x1},${y1}` : null;
}

/** Waits for the current frame to settle, then reads the frame at a known time. */
async function settledFrame(page) {
    await page.waitForTimeout(1800);
    // pause a moment ahead of the page's own clock (a long jump would age the fed signals past the engine's 3 s freshness)
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 20));
    await page.clock.runFor(48);
    const t = await page.evaluate(() => window.__last.t);
    return { t, b64: await page.evaluate(FRAME_BASE64) };
}

const newContext = async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    await context.clock.install({ time: CLOCK });
    return context;
};

test('a slider moves the shift lights: the frame at the shift point equals the stage over the Node engine fed the same, and differs from a low rpm', { skip }, async () => {
    const layout = JSON.parse(layoutFile('gt3').toString('utf8'));
    const context = await newContext();
    try {
        const { page, errors } = await openDesigner(context);
        await page.locator('[data-try-toggle]').click();
        const rpm = page.getByRole('slider', { name: 'Engine speed' });
        await rpm.waitFor();
        const frames = {};
        for (const value of [3000, 6800]) {
            const before = await page.evaluate(() => window.__frames);
            await rpm.fill(String(value));
            await page.waitForFunction((n) => window.__frames > n, before, { timeout: 15000 });
            const got = await settledFrame(page);
            const ref = await nodeScene(layout, { ...SIG.defaultSignals(), rpm: value });
            const want = await referenceFrame(context, ref, got.t);
            const a = Buffer.from(got.b64, 'base64'), b = Buffer.from(want.b64, 'base64');
            assert.strictEqual(a.length, b.length);
            assert.ok(a.equals(b), `rpm ${value} at t=${got.t}: the canvas differs from the stage's drawing, first at ${firstDifference(a, b)}`);
            frames[value] = a;
            await context.clock.resume();
        }
        assert.ok(!frames[3000].equals(frames[6800]), 'the shift lights change with the rpm');
        const reds = (f) => { let n = 0; for (let i = 0; i < f.length; i += 4) if (f[i] > 180 && f[i + 1] < 70 && f[i + 2] < 70 && f[i + 3] > 0) n++; return n; };
        assert.ok(reds(frames[6800]) > reds(frames[3000]) + 200, `GT3 turns red at the shift point (${reds(frames[3000])} red pixels at 3000 rpm, ${reds(frames[6800])} at 6800)`);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('the demo drive starts, the frames change by themselves, and it stops with the sliders back', { skip }, async () => {
    const context = await newContext();
    try {
        const { page, errors } = await openDesigner(context);
        await page.locator('[data-try-toggle]').click();
        const demo = page.locator('[data-demo-drive]');
        const rpm = page.getByRole('slider', { name: 'Engine speed' });
        assert.strictEqual(await demo.getAttribute('aria-checked'), 'false');
        assert.ok(await rpm.isEnabled());
        await demo.click();
        assert.strictEqual(await demo.getAttribute('aria-checked'), 'true');
        assert.ok(await rpm.isDisabled(), 'the sliders step aside while the demo drive runs');
        const sample = async () => { await page.waitForTimeout(1500); return page.evaluate(FRAME_BASE64); };
        const a = await sample();
        const f0 = await page.evaluate(() => window.__frames);
        const b = await sample();
        const c = await sample();
        assert.ok(await page.evaluate((n) => window.__frames > n, f0), 'frames keep coming');
        assert.ok(a !== b || b !== c, 'the drawn frame changes while the demo drive runs');
        await demo.click();
        assert.strictEqual(await demo.getAttribute('aria-checked'), 'false');
        assert.ok(await rpm.isEnabled());
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('leaving Trying leaves the layout, its undo history and its frame as they were', { skip }, async () => {
    const context = await newContext();
    try {
        const { page, errors } = await openDesigner(context);
        const name = page.locator('[data-layout-name] input');
        await name.fill('Renamed GT3');
        await name.press('Enter');
        await page.waitForTimeout(800);
        const undo = page.locator('[data-undo]');
        assert.ok(await undo.isEnabled(), 'the rename can be undone');
        const idle = await settledFrame(page);
        await context.clock.resume();
        await page.locator('[data-try-toggle]').click();
        assert.ok(await undo.isDisabled(), 'editing is off while trying');
        await page.getByRole('slider', { name: 'Engine speed' }).fill('6800');
        await page.locator('[data-demo-drive]').click();
        await page.waitForTimeout(1000);
        await page.locator('[data-try-toggle]').click();
        assert.strictEqual(await page.locator('[data-signals-panel]').count(), 0);
        assert.strictEqual(await name.inputValue(), 'Renamed GT3');
        assert.ok(await undo.isEnabled(), 'the history is as it was');
        assert.ok(await page.locator('[data-redo]').isDisabled());
        await page.waitForFunction(() => window.__last && window.__last.layers === 8, null, { timeout: 30000 });
        const after = await settledFrame(page);
        const a = Buffer.from(idle.b64, 'base64'), b = Buffer.from(after.b64, 'base64');
        assert.ok(a.equals(b), 'the frame after trying equals the one before: ' + firstDifference(a, b));
        await undo.click();
        assert.strictEqual(await name.inputValue(), 'GT3');
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('toggling Try 20 times does not make 20 WebGL contexts: one stage serves the canvas', { skip }, async () => {
    const context = await newContext();
    try {
        const { page, errors } = await openDesigner(context);
        await page.evaluate(() => {
            const get = HTMLCanvasElement.prototype.getContext;
            window.__gl = 0;
            HTMLCanvasElement.prototype.getContext = function (id, ...rest) {
                const had = this.__gl;
                const r = get.call(this, id, ...rest);
                if (r && /webgl/.test(id) && !had) { this.__gl = true; window.__gl++; }
                return r;
            };
        });
        const toggle = page.locator('[data-try-toggle]');
        for (let i = 0; i < 20; i++) {
            const before = await page.evaluate(() => window.__frames);
            await toggle.click();
            await page.waitForFunction((n) => window.__frames > n, before, { timeout: 15000 });
        }
        await page.waitForFunction(() => window.__last && window.__last.layers === 8, null, { timeout: 30000 });
        assert.ok(await page.evaluate(() => window.__gl) <= 1, 'WebGL contexts made after the toggles: ' + await page.evaluate(() => window.__gl));
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
