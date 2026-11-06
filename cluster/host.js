'use strict';
/**
 * The host of the vendored cluster engine (ADR 0005): runs the apps repo's `shared/hud.js` against the in-memory
 * stand-in for cluster-render, with no socket, no disk and no car. Plain CommonJS so Node's tests and the Designer's
 * bundle (virtual:cluster-engine) run this very file.
 *
 *   const engine = createEngine({ name: 'gt3', layout, fonts, settings: { mapWindow: true } });
 *   engine.scene()                     // every layer (and asset) with rect, class, z, state, warnings
 *   engine.pixelRect({ key, x, y, w, h })   // an image layer's RGBA rows, or null
 *   engine.feed('de.bmw.infotainment.vehicle.CDS', 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: 18000 })
 *   engine.setSetting('mapWindow', true)    // the engine rebuilds its layers
 *   engine.setLayout(layout)                // a new layout of the same name: the engine's watcher reloads it
 *   engine.status()                         // the status row text the car's centre screen shows
 *   engine.stop()
 *
 * Options: name (the layout's file name, default its "name"), layout (the apps repo's layout JSON), fonts (the baked
 * fonts as { 'fonts/big.json': text }, from engine/apps/cluster_themes/hud/fonts), settings (overrides of the app's
 * setting defaults), layerCap, pixelBytes (as render_protocol's createRenderer), onChange(), onPixels(layer, x, y, w, h),
 * onStatus(text), onLog(level, text).
 *
 * The shimmed Node pieces (what the engine would need injectable if shims became heavy): `net` (shims/net.js),
 * `fs` (shims/fs.js), `events` (shims/events.js), `process.env` and `Buffer` (the bundle injects them), __dirname (the
 * bundle defines it), the kit's ctx (below), and the timers, which are recorded so stop() ends them (kit/car.js starts a
 * 50 ms interval it never clears). Timers are recorded only while the engine's own code runs (the constructor, start(),
 * and the calls setLayout / setSetting / feed make), never left patched, so several engines can live side by side; a
 * stopped engine ignores those calls.
 */
const Hud = require('../engine/shared/hud.js');
const { createRenderer, TARGETS } = require('../engine/bench/render_protocol.js');
const APP = require('../engine/apps/cluster_themes/app.json');
const memfs = require('./shims/fs.js');
const net = require('./shims/net.js');

let seq = 0;

function layoutFileName(s) {
    const n = String(s || 'layout').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return n || 'layout';
}

/** Runs fn with setInterval / setTimeout recorded, so stop() can end what the engine started. */
function recordTimers(fn, into) {
    const si = globalThis.setInterval, st = globalThis.setTimeout;
    globalThis.setInterval = function () { const h = si.apply(this, arguments); into.push(['i', h]); return h; };
    globalThis.setTimeout = function () { const h = st.apply(this, arguments); into.push(['t', h]); return h; };
    try { return fn(); } finally { globalThis.setInterval = si; globalThis.setTimeout = st; }
}

function createEngine(o) {
    o = o || {};
    if (!o.layout) throw new Error('createEngine needs a layout');
    const id = ++seq;
    const name = layoutFileName(o.name || o.layout.name);
    const base = '/cluster-engine/' + id;
    const dataDir = base + '/data';
    const socketPath = base + '/render.sock';
    const timers = [];
    const logs = [];
    const say = (level) => (...a) => {
        const text = a.map((x) => (x && x.stack) || (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
        logs.push({ level, text });
        if (o.onLog) o.onLog(level, text);
    };
    const log = { info: say('info'), warn: say('warn'), error: say('error'), debug() {} };

    // the baked fonts: where shared/hud_data.js looks for them (<shared>/hud/fonts/x.json)
    Object.keys(o.fonts || {}).forEach((rel) => memfs.host.write('/engine/shared/hud/' + rel, o.fonts[rel]));
    memfs.host.write(dataDir + '/layouts/' + name + '.json', JSON.stringify(o.layout));

    // the kit's context: the app's settings (schema from app.json, our layout added to the choice)
    const schema = JSON.parse(JSON.stringify(APP.settings));
    const pick = schema.find((s) => s.key === 'hudLayout');
    if (!pick.options.some((p) => p[0] === name)) pick.options.push([name, o.layout.name || name]);
    const values = {};
    schema.forEach((s) => { values[s.key] = s.default; });
    Object.assign(values, { hudLayout: name, byMode: false, demo: 'off' }, o.settings || {});
    const changeListeners = [];
    const settings = {
        values,
        item: (k) => schema.find((s) => s.key === k),
        get: (k) => values[k],
        set(k, v) { values[k] = v; changeListeners.forEach((cb) => cb(k, v)); },
        onChange: (cb) => { changeListeners.push(cb); },
    };
    const watched = {};
    const signals = {
        watch(iface, version, fields) { watched[iface] = fields; return Promise.resolve({ available: true }); },
    };
    const config = Object.assign({}, APP.config, { socketPath });
    delete config.dme;       // the engine-unit boost reads the car's diagnostics; nothing to read here
    const ctx = { log, spec: Object.assign({}, APP, { config, settings: schema }), settings, signals, dataDir };

    // the stand-in for cluster-render, listening on our made-up socket path
    const renderer = createRenderer({
        layerCap: o.layerCap || 0, pixelBytes: o.pixelBytes,
        log: (level, text) => log[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info']('[render] ' + text),
        onChange: o.onChange || (() => {}), onPixels: o.onPixels || (() => {}),
    });
    net.host.listen(socketPath, renderer);

    const hud = recordTimers(() => new Hud(ctx), timers);
    if (o.onStatus) hud.onStatus(o.onStatus);
    recordTimers(() => hud.start(), timers);

    let stopped = false;
    return {
        renderer, hud, ctx, logs, targets: TARGETS,
        scene: () => renderer.sceneMeta(),
        pixelRect: (r) => renderer.pixelRect(r),
        status: () => hud.statusText(),
        settings: () => Object.assign({}, values),
        setSetting: (k, v) => { if (!stopped) recordTimers(() => settings.set(k, v), timers); },
        // the engine's watcher answers on the spot and starts its reload debounce (a setTimeout): recorded, so stop() ends it
        setLayout(layout) {
            if (stopped) return;
            memfs.host.write(dataDir + '/layouts/' + name + '.json', JSON.stringify(layout));
            recordTimers(() => memfs.host.notify(dataDir + '/layouts'), timers);
        },
        /** One signal field as the car's watch would deliver it (the raw SOME/IP values, see kit/runtime/car.js). */
        feed(iface, field, value) {
            const f = watched[iface] && watched[iface][field];
            if (!f) throw new Error('the engine does not watch ' + iface + '.' + field);
            if (!stopped) recordTimers(() => f(value), timers);
        },
        watched: () => Object.keys(watched).map((i) => ({ iface: i, fields: Object.keys(watched[i]) })),
        stop() {
            if (stopped) return;
            stopped = true;
            hud.stop();
            timers.forEach(([k, h]) => (k === 'i' ? clearInterval(h) : clearTimeout(h)));
            net.host.close(socketPath);
            memfs.host.removeTree(base);
        },
    };
}

module.exports = { createEngine };
