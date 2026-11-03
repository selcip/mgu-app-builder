'use strict';
// The runtime on the head unit inside the HMI's page (runtime/mgu_headunit.js with a `page`). The page is the
// app's RHMI states on the page template, one per depth: the HMI shows and focuses them, draws their title bar, owns
// BACK (which closes the top one) and HOME, and, without the controller gate, moves its focus over hidden proxy
// buttons and reports their presses, or lets the app read the controller from FrontCCU. Both the render client and the
// page are stand-ins with their interfaces: the boundaries to the renderer and to the HMI.
const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const { EventEmitter } = require('node:events');

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { runOnHeadUnit } = require(path.join(ROOT, 'runtime', 'mgu_headunit.js'));
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', name), 'utf8');
const NAVIGATION = fixture('navigation.json');
const INFO = { modes: ['layer', 'embed'], embedBox: { x: 0, y: 0, w: 1796, h: 632 }, controller: false, touch: true };

class FakeClient extends EventEmitter {
    constructor() {
        super();
        this.calls = [];
        this.frames = 0;
        this.shown = false;
    }
    connect() { this.calls.push(['connect']); }
    mode(m) { this.calls.push(['mode', m]); }
    place(p) { this.calls.push(['place', p]); }
    show(on) { this.calls.push(['show', on]); this.shown = on; }
    claim(rects) { this.calls.push(['claim', rects]); }
    grab(on) { this.calls.push(['grab', on]); }
    frame() { this.frames++; return true; }
    last(name) { const c = this.calls.filter((x) => x[0] === name); return c.length ? c[c.length - 1][1] : undefined; }
}

/** The HMI's page as the adapter sees it: states by depth (1 = the entry state), opened and closed by the app. */
class FakePage extends EventEmitter {
    constructor() {
        super();
        this.depths = 4;
        this.proxyCount = 48;
        this.opened = [];        // depths open, as the app asked
        this.titles = {};
        this.labels = {};
        this.left = 0;
    }
    open(depth) { this.opened.push(depth); }
    close(depth) { this.opened = this.opened.filter((d) => d !== depth); }
    title(depth, text) { this.titles[depth] = text; }
    proxies(depth, labels) { this.labels[depth] = labels; }
    leave() { this.left++; }
    /** The HMI shows the entry state with the focus on it (the driver opened the app). */
    enter() { this.emit('visible', 1, true); this.emit('focus', 1, true); }
    /** The driver presses the HMI's BACK on the page at `depth`: the HMI closes it, the one below gets the focus. */
    back(depth) {
        this.close(depth);
        this.emit('visible', depth, false);
        if (depth > 1) this.emit('focus', depth - 1, true);
    }
}

function run(screens, info) {
    const client = new FakeClient();
    const page = new FakePage();
    const lines = [];
    const put = (m) => lines.push(String(m));
    const rt = runOnHeadUnit({ client, page, screens: screens || NAVIGATION, log: { error: put, warn: put, info() {} }, kit });
    const actions = [], changes = [], leaves = [];
    rt.on('action', (a) => actions.push(a));
    rt.on('screen', (s) => changes.push(s));
    rt.on('leave', (s) => leaves.push(s));
    client.emit('ready', 0, info || INFO);
    return { client, page, rt, actions, changes, leaves, lines };
}

test('the screen shows only while the HMI shows the app’s page, and touches are claimed only then', () => {
    const { client, page } = run();
    assert.strictEqual(client.last('mode'), 'embed');
    assert.ok(!client.shown, 'not shown before the HMI shows the page');
    assert.notDeepStrictEqual(client.last('claim'), [{ x: 0, y: 0, w: 1796, h: 632 }]);
    const before = client.frames;
    page.enter();
    assert.ok(client.shown);
    assert.deepStrictEqual(client.last('claim'), [{ x: 0, y: 0, w: 1796, h: 632 }]);
    assert.ok(client.frames > before, 'a frame as it shows');
    page.back(1);                   // BACK on the entry state: the HMI leaves the app
    assert.strictEqual(client.shown, false);
    assert.deepStrictEqual(client.last('claim'), []);
});
