'use strict';
// The starter app's example entry (starter/main.js) in an OnlineApp on the head unit: the oap-sdk (OnlineApp, its RHMI
// application with the states and components of the starter's generated uiDescription.json, someipBuilders) and the
// render client are stand-ins with their interfaces, the boundaries to the HMI and the renderer. The entry is laid out
// as the OAP linker lays it out: flat, beside the package's files.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const ROOT = path.join(__dirname, '..');
const STARTER = path.join(ROOT, 'starter');
const TREE = path.join(STARTER, 'app');
const UI = JSON.parse(fs.readFileSync(path.join(TREE, 'rhmiData', 'uiDescriptions', 'ID7', 'uiDescription.json'), 'utf8'));
const APP = JSON.parse(fs.readFileSync(path.join(TREE, 'rhmiData', 'application.json'), 'utf8')).application;
const tick = () => new Promise((r) => setTimeout(r, 5));

class Comp extends EventEmitter {
    constructor(world, name, id) { super(); this.world = world; this.name = name; this.id = id; }
    getId() { return this.id; }
    setValue(row, cell, value) { this.world.writes.push(`${this.name}.${cell}=${value}`); return Promise.resolve(); }
    setProperty(p, v) { this.world.writes.push(`${this.name}.${p}=${v}`); return Promise.resolve(); }
    updateResources() { return Promise.resolve(); }
}

/** The HMI as the app sees it through the oap-sdk, built from the app's own RHMI description. */
function world(language) {
    const w = { writes: [], states: [], byName: {}, gpu: null, statusCalls: [], exited: null, drawn: [] };
    Object.keys(UI.containers).forEach((cid) => {
        const c = UI.containers[cid];
        w.byName[c.name] = new Comp(w, c.name, cid);
        Object.keys(c.components).forEach((id) => { w.byName[c.components[id].name] = new Comp(w, c.components[id].name, id); });
    });
    class Rhmi extends EventEmitter {
        getByName(n) { return w.byName[n]; }
        openState(n) { w.states.push(`open ${n}`); return Promise.resolve(); }
        closeState(n) { w.states.push(`close ${n}`); return Promise.resolve(); }
        mapEntryState(uuid, st) { w.states.push(`map ${uuid} ${st.name}`); return Promise.resolve(); }
        openEntryState(uuid) { w.states.push(`enter ${uuid}`); return Promise.resolve(); }
    }
    const entry = APP.entryPoints[0];
    class OnlineApp extends EventEmitter {
        constructor() {
            super();
            w.app = this;
            this.rhmiApplication = new Rhmi();
            this.appDescription = { application: APP };
            this.startReason = 'ENTRY_POINT';
        }
        start() { setImmediate(() => this.emit('initialized')); return Promise.resolve(); }
        initialized() { w.initialized = true; return Promise.resolve(); }
        getEntryPoints() {
            return [{ getDescription: () => entry, init: () => Promise.resolve(),
                entryPoint: { setText: (t) => { w.tileText = t; }, setIcon: (i) => { w.tileIcon = i; } },
                setAvailability: (a) => { w.tile = a; } }];
        }
        registerActive() { w.statusCalls.push('active'); }
        registerHmiVisible() { w.statusCalls.push('visible'); }
        unregisterHmiVisible() { w.statusCalls.push('hidden'); }
        registerInactive() { w.statusCalls.push('inactive'); }
    }
    const someipBuilders = {
        buildTypedProxy: (iface, instance) => Promise.resolve({
            init: () => Promise.resolve(),
            waitUntilAvailable: () => Promise.resolve(),
            statusRotaryEncoderState: { subscribe: (cb) => { w.frontCcu = cb; return Promise.resolve(); } },
            currentDisplayLanguage: { subscribe: (cb) => { w.language = cb; w.hmiContext = `${iface} ${instance}`; return Promise.resolve(); },
                getValue: () => Promise.resolve(language || 'ENGLISCH__UK') },
        }),
    };
    class RenderClient extends EventEmitter {
        constructor(appId) { super(); w.gpu = this; this.appId = appId; this.shown = false; this.claims = []; }
        connect() {}
        close() { w.closed = true; }
        mode() {}
        place() {}
        show(on) { this.shown = on; }
        claim(r) { this.claims = r; }
        grab() {}
        frame() { return true; }
    }
    w.stubs = {
        'oap-sdk/src/core/OnlineApp.js': OnlineApp,
        'oap-sdk/src/someip/someipBuilders': someipBuilders,
        'oap-sdk/src/logging/logging': { getSDKLogger: () => ({ info() {}, warn(m) { (w.warned = w.warned || []).push(m); }, error(m) { (w.errors = w.errors || []).push(m); } }) },
        './mgu_render_client.js': { RenderClient },
    };
    w.state = (d) => w.byName[`ST_OnlineApps_MguPage${d}`];
    w.ready = () => w.gpu.emit('ready', 0, { modes: ['embed'], embedBox: { x: 0, y: 0, w: 1796, h: 632 }, controller: false });
    w.tap = (x, y) => { w.gpu.emit('touch', 'down', x, y); w.gpu.emit('touch', 'up', x, y); };
    return w;
}

/** Loads main.js as the linked app would run it: flat with lib/, in the package's javascript/ folder. */
function load(w) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-app-'));
    fs.cpSync(TREE, tmp, { recursive: true });
    const js = path.join(tmp, 'javascript');
    fs.mkdirSync(js);
    fs.copyFileSync(path.join(STARTER, 'main.js'), path.join(js, 'main.js'));
    for (const n of fs.readdirSync(path.join(STARTER, 'lib'))) fs.copyFileSync(path.join(STARTER, 'lib', n), path.join(js, n));
    const kitRecord = require(path.join(js, 'kit_record.js'));
    const text = kitRecord.Recorder.prototype.text;
    kitRecord.Recorder.prototype.text = function (s) { w.drawn.push(String(s)); return text.apply(this, arguments); };
    const loadModule = Module._load;
    Module._load = function (req) { return w.stubs[req] || loadModule.apply(this, arguments); };
    try {
        require(path.join(js, 'main.js'));
    } finally {
        Module._load = loadModule;
    }
    w.cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
    return w;
}

test('the app maps its tile to the entry page state, enables it and draws in the page when the HMI shows it', async () => {
    const w = load(world());
    try {
        await tick();
        assert.ok(w.initialized);
        assert.ok(w.states.indexOf(`map ${APP.entryPoints[0].uuid} ST_OnlineApps_MguPage1`) >= 0, w.states.join('\n'));
        assert.strictEqual(w.tile, 'ENABLED');
        assert.strictEqual(w.tileText, 'SID_APP_TITLE');
        assert.strictEqual(w.hmiContext, 'de.bmw.infotainment.hmi.hmicontext.HMIContext HMI_CID');
        w.ready();
        assert.ok(!w.gpu.shown);
        w.state(1).emit('visible', { visible: true });
        assert.ok(w.gpu.shown);
        await tick();
        assert.ok(w.writes.indexOf('ST_OnlineApps_MguPage1_Title.Text=Starter') >= 0, 'the screen’s title in the HMI’s title bar');
        assert.ok(w.writes.indexOf('mguPage1P1.Visible=1') >= 0 && w.writes.indexOf('mguPage1P2.Visible=0') >= 0,
            'a proxy per focus item (Refresh, Settings) shown, the rest hidden');
        await tick();
        assert.deepStrictEqual(w.statusCalls.slice(-2), ['active', 'visible']);
    } finally {
        w.cleanup();
    }
});

test('the example handles actions and sets values: Refresh counts and says when', async () => {
    const w = load(world());
    try {
        await tick();
        w.ready();
        w.state(1).emit('visible', { visible: true });
        w.drawn.length = 0;
        w.tap(300, 548);                            // Refresh
        assert.ok(w.drawn.some((s) => /^Refreshed at \d\d:\d\d$/.test(s)), w.drawn.join('|'));
        assert.ok(w.drawn.indexOf('1') >= 0, 'the count');
    } finally {
        w.cleanup();
    }
});

test('a link opens the next page state, the example loads its data, the HMI’s proxies drive it, and its BACK returns', async () => {
    const w = load(world());
    try {
        await tick();
        w.ready();
        w.state(1).emit('visible', { visible: true });
        w.drawn.length = 0;
        w.tap(860, 548);                            // Settings
        await tick();
        assert.ok(w.states.indexOf('open ST_OnlineApps_MguPage2') >= 0);
        assert.ok(w.writes.indexOf('ST_OnlineApps_MguPage2_Title.Text=Settings') >= 0);
        assert.ok(w.drawn.indexOf('60%') >= 0, 'the brightness the example knows: ' + w.drawn.join('|'));
        w.state(2).emit('visible', { visible: true });
        w.state(2).emit('focus', { focus: true });
        w.drawn.length = 0;
        w.byName.mguPage2P1.emit('focus', { value: true });     // the HMI's focus on the second proxy: Brightness
        w.byName.mguPage2P1.emit('action', {});                 // and its press
        assert.ok(w.drawn.indexOf('80%') >= 0, w.drawn.join('|'));
        w.state(2).emit('visible', { visible: false });         // the HMI's BACK closes the state
        w.state(1).emit('focus', { focus: true });
        w.drawn.length = 0;
        w.tap(300, 548);                            // Refresh: on the first screen again
        assert.ok(w.drawn.some((t) => /^Refreshed at/.test(t)), w.drawn.join('|'));
    } finally {
        w.cleanup();
    }
});

test('the HMI’s display language picks the screen file’s German', async () => {
    const w = load(world('DEUTSCH'));
    try {
        w.drawn.length = 0;
        await tick();
        w.ready();
        w.state(1).emit('visible', { visible: true });
        await tick();
        assert.ok(w.drawn.indexOf('Im Designer gestaltet') >= 0, w.drawn.join('|'));
        assert.ok(w.writes.indexOf('ST_OnlineApps_MguPage1_Title.Text=Starter') >= 0);
    } finally {
        w.cleanup();
    }
});

test('the manager’s shutdown closes the renderer connection and exits', async () => {
    const w = load(world());
    try {
        await tick();
        const exit = process.exit;
        process.exit = (code) => { w.exited = code; };
        try {
            w.app.emit('shutdown', 'test');
            await tick();
        } finally {
            process.exit = exit;
        }
        assert.ok(w.closed);
        assert.strictEqual(w.exited, 0);
    } finally {
        w.cleanup();
    }
});
