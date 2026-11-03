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

test('a link opens the next page state with the screen’s title; the HMI’s BACK closes it and the runtime goes back', () => {
    const { client, page, rt, actions, changes } = run();
    page.enter();
    assert.deepStrictEqual(page.titles, { 1: 'Home' });
    client.emit('touch', 'down', 300, 190);         // toSettings
    client.emit('touch', 'up', 300, 190);
    assert.strictEqual(rt.screen(), 'settings');
    assert.deepStrictEqual(page.opened, [2]);
    assert.strictEqual(page.titles[2], 'Settings');
    page.emit('visible', 2, true);
    page.emit('focus', 2, true);
    page.emit('focus', 1, false);
    assert.strictEqual(rt.screen(), 'settings', 'the HMI showing the new state changes nothing');
    page.back(2);
    assert.strictEqual(rt.screen(), 'home');
    assert.deepStrictEqual(changes.map((c) => [c.screen, c.by]), [['settings', 'link'], ['home', 'back']]);
    assert.deepStrictEqual(actions.map((a) => a.action), ['toSettings']);
    assert.ok(client.shown, 'still shown on the entry state');
});

test('BACK from the app’s own screens closes the page states above, and the HMI’s focus coming back changes nothing more', () => {
    const { client, page, rt } = run();
    page.enter();
    rt.open('settings');
    rt.open('details');
    assert.deepStrictEqual(page.opened, [2, 3]);
    rt.open('home');                                // back to a screen the driver came through
    assert.deepStrictEqual(page.opened, []);
    page.emit('visible', 3, false);
    page.emit('focus', 2, true);                    // late HMI events of the states closed
    page.emit('focus', 1, true);
    assert.strictEqual(rt.screen(), 'home');
});

test('the keyboard screen is a page state of its own: the HMI’s BACK cancels typing and stays on the screen', () => {
    const { client, page, rt, actions } = run(fixture('text-entry.json'));
    page.enter();
    client.emit('touch', 'down', 300, 200);         // the name field
    client.emit('touch', 'up', 300, 200);
    assert.strictEqual(rt.depth(), 2);
    assert.deepStrictEqual(page.opened, [2]);
    page.back(2);
    assert.strictEqual(rt.depth(), 1);
    assert.strictEqual(rt.screen(), 'main');
    assert.deepStrictEqual(actions, [], 'cancelled: nothing reported');
    assert.ok(client.shown);
});

test('the tile opening the app again shows the entry state: the runtime returns to the first screen', () => {
    const { page, rt } = run();
    page.enter();
    rt.open('settings');
    page.emit('visible', 2, false);                 // HOME: the HMI hides the app
    page.emit('visible', 1, false);
    rt.open('details');                             // the app's code while hidden: no state opened
    assert.deepStrictEqual(page.opened, [2]);
    page.enter();
    assert.strictEqual(rt.screen(), 'home');
});

test('BACK on the first screen from the app leaves the page', () => {
    const { page, rt, leaves } = run();
    page.enter();
    rt.controller('back');
    assert.strictEqual(leaves.length, 1);
    assert.strictEqual(page.left, 1);
});

test('while shown, the last frame is sent again after a second without one, so the renderer keeps the app', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
    const { client, page } = run();
    page.enter();
    const shownAt = client.frames;
    t.mock.timers.tick(999);
    assert.strictEqual(client.frames, shownAt);
    t.mock.timers.tick(1);
    assert.strictEqual(client.frames, shownAt + 1);
    for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
    assert.strictEqual(client.frames, shownAt + 4);
    page.back(1);
    for (let i = 0; i < 5; i++) t.mock.timers.tick(1000);
    assert.strictEqual(client.frames, shownAt + 4, 'hidden: silent');
});

test('the HMI’s focus on the proxy buttons moves the highlight and its press selects; the proxies list the focus items', () => {
    const { page, actions } = run(fixture('focus.json'));
    page.enter();
    const items = page.labels[1];
    assert.ok(items.length > 2);
    assert.ok(items.indexOf('volume') >= 0);
    page.emit('proxyFocus', 1, items.indexOf('volume'));
    page.emit('proxyPress', 1, items.indexOf('save'));
    page.emit('proxyPress', 2, 0);                  // a state not on top: ignored
    assert.deepStrictEqual(actions.map((a) => a.element), ['save']);
});

const fccu = (seq, knob, push) => ({ frontSequenceNumberOperatingElement: seq, frontRotaryEncoderOperation: knob,
    frontRotaryEncoderPushButton: push });

test('without the controller gate, FrontCCU turns and pushes drive the highlight while the page has the HMI’s focus', () => {
    const { page, actions } = run(fixture('focus.json'));
    page.emit('frontCcu', fccu(1, 10, 'KEINE_BETAETIGUNG'));
    page.emit('frontCcu', fccu(2, 11, 'DREHGEBER_KURZ_GEDRUECKT'));     // not shown yet: nothing
    page.enter();
    page.emit('frontCcu', fccu(3, 11, 'KEINE_BETAETIGUNG'));
    page.emit('frontCcu', fccu(4, 13, 'KEINE_BETAETIGUNG'));          // two detents
    page.emit('frontCcu', fccu(5, 13, 'DREHGEBER_KURZ_GEDRUECKT'));
    page.emit('frontCcu', fccu(6, 0xffff, 'DREHGEBER_KURZ_GEDRUECKT')); // a new push, no counter reading
    assert.deepStrictEqual(actions.map((a) => a.element), ['volume', 'volume']);
    page.emit('focus', 1, false);                   // an HMI popup over the page
    page.emit('frontCcu', fccu(7, 14, 'KEINE_BETAETIGUNG'));
    page.emit('frontCcu', fccu(8, 14, 'DREHGEBER_KURZ_GEDRUECKT'));
    assert.strictEqual(actions.length, 2);
});

test('once the HMI presses a proxy itself, FrontCCU stands down; with the gate only the gate counts', () => {
    const a = run(fixture('focus.json'));
    a.page.enter();
    a.page.emit('proxyPress', 1, 0);
    a.page.emit('frontCcu', fccu(1, 10, 'KEINE_BETAETIGUNG'));
    a.page.emit('frontCcu', fccu(2, 10, 'DREHGEBER_KURZ_GEDRUECKT'));
    assert.strictEqual(a.actions.length, 1);
    const b = run(fixture('focus.json'), Object.assign({}, INFO, { controller: true }));
    b.page.enter();
    assert.strictEqual(b.client.last('grab'), true);
    b.page.emit('frontCcu', fccu(1, 10, 'KEINE_BETAETIGUNG'));
    b.page.emit('frontCcu', fccu(2, 10, 'DREHGEBER_KURZ_GEDRUECKT'));
    assert.strictEqual(b.actions.length, 0);
    b.page.back(1);
    assert.strictEqual(b.client.last('grab'), false, 'the controller is let go while hidden');
});

test('the HMI’s display language picks the screen file’s language, a regional one falling back to its language', () => {
    const { page, rt } = run(fixture('text-entry.json'));
    page.emit('language', 'DEUTSCH');
    assert.strictEqual(rt.language(), 'de');
    page.emit('language', 'ENGLISCH__UK');
    assert.strictEqual(rt.language(), 'en');
    page.emit('language', 'DEUTSCH');
    page.emit('language', 'KLINGONISCH');           // not in the file: its default language
    assert.strictEqual(rt.language(), 'en');
});
