'use strict';
// Seam 2, the cluster canvas: the Designer (its static build, in real Chromium) draws an open cluster layout, and its
// pixels must equal the apps repo's own stage (stage.js, unmodified) drawing the same scene.
//
// The reference is built here, not recorded: the layout runs through the vendored engine in Node (cluster/node.js, no
// signals fed), and the apps repo's stage.js (the vendored copy engine/bench/stage.js, which test/sync-engine.test.js
// keeps equal to the apps checkout) draws that scene and its pixel rects on a plain page in the same Chromium, at the
// time t the Designer drew its frame (u_time = t / 1000). A fake clock (Playwright's) fixes `new Date()` and the
// frame times. So this catches the Designer's wiring of scene, pixels and redraws differing from the stage's contract,
// and the browser engine's layers differing from Node's. It does not compare against a recording of the car's
// cluster-render (that is the car).
// Also: the zoom, pan and fit-to-view of the canvas, and a layout the engine refuses. Needs Playwright's Chromium;
// skipped without it.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
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

let DIST, browser;
before(async () => {
    if (skip) return;
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
    // every cluster frame, as the Designer announces it: its time, and the canvas's pixels read back at once
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
    return { page, errors };
}

const FRAME_BASE64 = () => {
    const d = window.__last.data;
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.readAsDataURL(new Blob([d])); });
};

/** The layout through the engine in Node: the scene and each image layer's whole pixels. */
async function nodeScene(layout, settings) {
    const { createEngine } = require('../cluster/node.js');
    // the engine's clock text reads `new Date()`: the same minute as the browser's fake clock (as the apps bench's fixed-clock.js)
    const RealDate = Date;
    const fixed = CLOCK.getTime();
    global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } };
    const engine = createEngine({ name: 'design', layout, settings });
    try {
        const t0 = Date.now();
        for (;;) {
            const s = engine.scene();
            if (s.length && /layers/.test(engine.status())) break;
            if (Date.now() - t0 > 10000) throw new Error('the engine drew nothing: ' + engine.status());
            await new Promise((r) => setTimeout(r, 25));
        }
        await new Promise((r) => setTimeout(r, 600));       // let the rebuild settle
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

/** The apps repo's stage.js drawing that scene at t on a plain page; the canvas's RGBA as base64. */
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
            return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve({ w: canvas.width, h: canvas.height, b64: String(r.result).split(',')[1], animated: stage.animated() }); r.readAsDataURL(new Blob([d])); });
        }, { scene: ref.scene, pixels: ref.pixels, targets: ref.targets, t });
    } finally {
        await page.close();
    }
}

function firstDifference(a, b) {
    let first = null, n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < a.length; i += 4) {
        if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
        const x = (i >> 2) % 1920, y = Math.floor((i >> 2) / 1920);
        if (!first) first = `pixel ${x},${y}: rgba(${a.slice(i, i + 4)}) vs rgba(${b.slice(i, i + 4)})`;
        n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return n ? `${first}; ${n} pixels differ within ${x0},${y0} to ${x1},${y1}` : null;
}

/** The Designer opened on a layout: when its frame is on the canvas, the frame's time and RGBA. */
async function designerFrame(page, layers, name) {
    await page.setInputFiles('header input[type=file]', { name: name + '.json', mimeType: 'application/json', buffer: layoutFile(name) });
    await page.locator('[data-cluster-canvas]').waitFor();
    await page.waitForFunction((n) => window.__last && window.__last.layers === n, layers, { timeout: 30000 });
    await page.waitForTimeout(1500);                       // pixels arrive after the layers; the clock is still running
    await page.clock.pauseAt(new Date(CLOCK.getTime() + 10000));
    await page.clock.runFor(48);                           // animated layers draw again, at a time we know
    const info = await page.evaluate(() => ({ t: window.__last.t, w: window.__last.w, h: window.__last.h, frames: window.__frames }));
    return { ...info, b64: await page.evaluate(FRAME_BASE64) };
}

for (const name of ['gt3', 'sport', 'm', 'grid']) {
    test(`${name}: the canvas's pixels equal the apps repo's stage drawing the same scene`, { skip }, async () => {
        const layout = JSON.parse(layoutFile(name).toString('utf8'));
        const ref = await nodeScene(layout);
        assert.ok(ref.scene.length > 0, 'the engine in Node registers layers for ' + name);
        const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
        try {
            await context.clock.install({ time: CLOCK });
            const { page, errors } = await openDesigner(context);
            const got = await designerFrame(page, ref.scene.length, name);
            assert.deepStrictEqual([got.w, got.h], [1920, 720]);
            const want = await referenceFrame(context, ref, got.t);
            assert.deepStrictEqual([want.w, want.h], [1920, 720]);
            const a = Buffer.from(got.b64, 'base64'), b = Buffer.from(want.b64, 'base64');
            assert.ok(b.some((v, i) => i % 4 === 3 && v !== 0), 'the reference drew something');
            assert.strictEqual(a.length, b.length);
            assert.ok(a.equals(b), `${name} at t=${got.t}: the canvas differs from the stage's drawing, first at ${firstDifference(a, b)}`);
            assert.deepStrictEqual(errors, []);
        } finally {
            await context.close();
        }
    });
}

test('zoom, pan and fit-to-view work on the cluster canvas, and the canvas stays 1920 x 720', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openDesigner(context);
        await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: layoutFile('gt3') });
        const canvas = page.locator('[data-cluster-canvas]');
        await canvas.waitFor();
        const zoom = async () => Number(await page.locator('[data-viewport]').getAttribute('data-zoom'));
        const box = async () => canvas.boundingBox();
        assert.deepStrictEqual(await canvas.evaluate((c) => [c.width, c.height]), [1920, 720]);
        // opens fitted: all of it in view
        const vp = await page.locator('[data-viewport]').boundingBox();
        let b = await box();
        assert.ok(b.x >= vp.x - 1 && b.x + b.width <= vp.x + vp.width + 1, 'fitted across');
        const fitted = await zoom();
        await page.locator('[data-zoom-reset]').click();
        assert.strictEqual(await zoom(), 1);
        await page.locator('[data-zoom-in]').click();
        assert.ok(await zoom() > 1);
        await page.keyboard.press('Control+0');
        assert.strictEqual(await zoom(), 1);
        await page.keyboard.press('Shift+Digit1');
        assert.strictEqual(await zoom(), fitted);
        // the wheel pans
        b = await box();
        await page.mouse.move(vp.x + 200, vp.y + 200);
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(200);
        const moved = await box();
        assert.ok(moved.y < b.y, 'the wheel pans');
        assert.deepStrictEqual(await canvas.evaluate((c) => [c.width, c.height]), [1920, 720]);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('a layout the engine refuses opens with the engine\'s own reason, not a blank canvas', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openDesigner(context);
        const bad = JSON.parse(layoutFile('gt3').toString('utf8'));
        bad.widgets = [{ id: 'x', type: 'nope', x: 0, y: 0, w: 10, h: 10 }];
        await page.setInputFiles('header input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
        const refusal = page.locator('[data-cluster-refusal]');
        await refusal.waitFor();
        assert.match(await refusal.innerText(), /unknown type "nope"/);
        // a layout the engine draws shows none
        await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: layoutFile('gt3') });
        await page.waitForFunction(() => window.__last && window.__last.layers === 8, null, { timeout: 30000 });
        assert.strictEqual(await page.locator('[data-cluster-refusal]').count(), 0);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('a changed layout is drawn again (the engine reloads it)', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        const { page, errors } = await openDesigner(context);
        await page.setInputFiles('header input[type=file]', { name: 'gt3.json', mimeType: 'application/json', buffer: layoutFile('gt3') });
        await page.waitForFunction(() => window.__last && window.__last.layers === 8, null, { timeout: 30000 });
        await page.waitForTimeout(1500);
        const before = await page.evaluate(() => window.__frames);
        const name = page.locator('[data-layout-name] input');
        await name.fill('Renamed GT3');
        await name.press('Enter');
        await page.waitForFunction((n) => window.__frames > n, before, { timeout: 15000 });
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});

test('flipping "Leave room for the map" on GT3 cuts the map window out of the canvas, pixel-equal to the engine with that setting', { skip }, async () => {
    const context = await browser.newContext({ viewport: { width: 2400, height: 1300 } });
    try {
        await context.clock.install({ time: CLOCK });
        const layout = JSON.parse(layoutFile('gt3').toString('utf8'));
        const off = await nodeScene(layout);
        const on = await nodeScene(layout, { mapWindow: true });
        assert.notStrictEqual(on.scene.length, 0);
        const { page, errors } = await openDesigner(context);
        const first = await designerFrame(page, off.scene.length, 'gt3');
        // the pixel in the middle of the map window: opaque before, see-through after
        const [hx, hy, hw, hh] = layout.widgets.find((w) => w.hole).hole;
        const at = (b64) => Buffer.from(b64, 'base64')[(Math.floor(hy + hh / 2) * 1920 + Math.floor(hx + hw / 2)) * 4 + 3];
        assert.ok(at(first.b64) > 0, 'the cluster is opaque where the map goes');
        const sw = page.locator('[data-preview-switch="mapWindow"]');
        assert.strictEqual(await sw.getAttribute('aria-checked'), 'false');
        await page.clock.resume();
        await sw.click();
        assert.strictEqual(await sw.getAttribute('aria-checked'), 'true');
        await page.waitForFunction((n) => window.__last && window.__last.layers === n, on.scene.length, { timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
        await page.clock.runFor(48);
        const t = await page.evaluate(() => window.__last.t);
        const got = await page.evaluate(FRAME_BASE64);
        assert.strictEqual(at(got), 0, 'the map window is see-through');
        const want = await referenceFrame(context, on, t);
        const a = Buffer.from(got, 'base64'), b = Buffer.from(want.b64, 'base64');
        assert.ok(a.equals(b), 'the canvas differs from the stage drawing the engine with mapWindow on, first at ' + firstDifference(a, b));
        // nothing was saved or made undoable by the switch
        assert.strictEqual(await page.locator('[data-undo]').isDisabled(), true);
        assert.deepStrictEqual(errors, []);
    } finally {
        await context.close();
    }
});
