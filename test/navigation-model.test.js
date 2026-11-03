'use strict';
// Seam 2 (document model -> screen file) for navigation: the operations the Designer's link field applies, the `nav`
// map they write per screen (action name -> screen name), the navigation view's links and the dead-link warnings,
// also after the screen a link names is renamed or deleted.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');

let M;
before(async () => {
    M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
});

const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const screen = (d, name) => d.file.screens.find((s) => s.name === name);
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));

// main: a settings button and a help button; settings: a back-home button; about: nothing
function app() {
    return edit([
        { type: 'addElement', screen: 'main', widget: 'button', name: 'settingsButton', x: 40, y: 100 },
        { type: 'addElement', screen: 'main', widget: 'button', name: 'help', x: 700, y: 100 },
        { type: 'addScreen', name: 'settings' },
        { type: 'addElement', screen: 'settings', widget: 'button', name: 'home', x: 40, y: 100 },
        { type: 'addScreen', name: 'about' },
    ]);
}

test('linking an element writes its action and the screen it opens to the screen\'s nav', () => {
    const d = edit([{ type: 'setLink', screen: 'main', action: 'settingsButton', to: 'settings' }], app());
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings' });
    assert.strictEqual(M.linkOf(screen(d, 'main'), 'settingsButton'), 'settings');
    assert.strictEqual(M.linkOf(screen(d, 'main'), 'help'), undefined);
});

test('unlinking removes the link, and the nav map with its last link', () => {
    const d = edit([
        { type: 'setLink', screen: 'main', action: 'settingsButton', to: 'settings' },
        { type: 'setLink', screen: 'main', action: 'help', to: 'about' },
        { type: 'setLink', screen: 'main', action: 'help', to: null },
    ], app());
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings' });
    const e = M.apply(d, { type: 'setLink', screen: 'main', action: 'settingsButton', to: '' });
    assert.strictEqual(screen(e, 'main').nav, undefined);
});

test('a link must name another screen of the file', () => {
    const d = app();
    refused(() => M.apply(d, { type: 'setLink', screen: 'main', action: 'help', to: 'nowhere' }), /no screen "nowhere"/);
    refused(() => M.apply(d, { type: 'setLink', screen: 'main', action: 'help', to: 'main' }), /can’t link to itself/);
    refused(() => M.apply(d, { type: 'setLink', screen: 'main', action: '', to: 'about' }), /action/);
});

const linked = () => edit([
    { type: 'setLink', screen: 'main', action: 'settingsButton', to: 'settings' },
    { type: 'setLink', screen: 'main', action: 'help', to: 'about' },
    { type: 'setLink', screen: 'settings', action: 'home', to: 'main' },
], app());

test('the navigation view lists every link with the elements that report its action', () => {
    assert.deepStrictEqual(M.linksOf(linked().file), [
        { screen: 'main', action: 'settingsButton', to: 'settings', elements: ['settingsButton'], dead: false },
        { screen: 'main', action: 'help', to: 'about', elements: ['help'], dead: false },
        { screen: 'settings', action: 'home', to: 'main', elements: ['home'], dead: false },
    ]);
    assert.deepStrictEqual(M.deadLinks(linked().file), []);
});

test('deleting a screen leaves the links to it dead, and they are reported', () => {
    const d = M.apply(linked(), { type: 'deleteScreen', screen: 'about' });
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings', help: 'about' }, 'kept, for the app author to fix');
    assert.deepStrictEqual(M.deadLinks(d.file), [{ screen: 'main', action: 'help', to: 'about', elements: ['help'], dead: true }]);
    const fixed = M.apply(d, { type: 'setLink', screen: 'main', action: 'help', to: null });
    assert.deepStrictEqual(M.deadLinks(fixed.file), []);
});

test('renaming a screen keeps the links to it', () => {
    const d = M.apply(linked(), { type: 'renameScreen', screen: 'settings', name: 'options' });
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'options', help: 'about' });
    assert.deepStrictEqual(M.deadLinks(d.file), []);
});

test('a dead link in an opened file is reported', () => {
    const d = { file: { schema: 1, first: 'a', screens: [{ name: 'a', components: [], nav: { go: 'b' } }] }, images: {} };
    assert.deepStrictEqual(M.deadLinks(d.file), [{ screen: 'a', action: 'go', to: 'b', elements: [], dead: true }]);
});

test('a link follows its element\'s action: a new action name, or a rename while it reports its name', () => {
    let d = M.apply(linked(), { type: 'setAction', screen: 'main', element: 'help', action: 'info' });
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings', info: 'about' });
    d = M.apply(d, { type: 'renameElement', screen: 'main', element: 'settingsButton', name: 'gear' });
    assert.deepStrictEqual(screen(d, 'main').nav, { info: 'about', gear: 'settings' });
    d = M.apply(d, { type: 'setAction', screen: 'main', element: 'help', action: '' });     // back to its name
    assert.deepStrictEqual(screen(d, 'main').nav, { gear: 'settings', help: 'about' });
});

test('a link stays with its action while another element still reports it', () => {
    let d = edit([
        { type: 'addElement', screen: 'main', widget: 'button', name: 'help2', x: 40, y: 300 },
        { type: 'setAction', screen: 'main', element: 'help2', action: 'help' },
    ], linked());
    d = M.apply(d, { type: 'setAction', screen: 'main', element: 'help', action: 'info' });
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings', help: 'about' });
    d = M.apply(d, { type: 'deleteElement', screen: 'main', element: 'help' });
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings', help: 'about' });
    d = M.apply(d, { type: 'deleteElement', screen: 'main', element: 'help2' });
    assert.deepStrictEqual(screen(d, 'main').nav, { settingsButton: 'settings' }, 'the last element reporting it is gone');
});

test('a file linked in the Designer walks through the runtime: link, BACK, leave', () => {
    require('./flat-layout.js');
    const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
    const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
    const d = M.apply(linked(), { type: 'setAction', screen: 'main', element: 'help', action: 'info' });
    const seen = [];
    const rt = createRuntime({ kit, log: { error() {}, warn() {}, info() {} }, sink: { frame() { return true; } } });
    rt.on('screen', (s) => seen.push(s.by + ':' + s.screen));
    rt.on('leave', (s) => seen.push('leave:' + s.screen));
    assert.ok(rt.load(d.file));
    rt.start();
    rt.controller('right');         // help (reports info)
    rt.controller('press');
    rt.controller('back');
    rt.controller('left');          // settingsButton
    rt.controller('press');
    rt.controller('press');         // home -> main
    rt.controller('back');
    assert.deepStrictEqual(seen, ['start:main', 'link:about', 'back:main', 'link:settings', 'link:main', 'leave:main']);
});
