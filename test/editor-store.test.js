'use strict';
// The Designer's editor store (designer/src/store/editor.ts), without React: edits go through it and come back as
// the new document or a refusal message; undo and redo; the selected screen and elements follow renames and
// deletions; adding a widget selects it; stopping trying returns to the screen the walk ended on.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let S;
before(async () => { S = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'store', 'editor.ts')).href); });

/** A store over a new document after the given edits. */
function storeAfter(ops) {
    const store = S.createEditorStore();
    for (const op of ops) assert.ok(store.getState().edit(op), `${op.type} applied`);
    return store;
}
const names = (st) => S.fileOf(st).screens.map((s) => s.name);

test('an edit returns the new document; a refused one sets the problem and changes nothing, and the next edit clears it', () => {
    const store = storeAfter([{ type: 'addScreen', name: 'about' }]);
    const before = store.getState().history;
    assert.strictEqual(store.getState().edit({ type: 'addScreen', name: 'about' }), null);
    assert.strictEqual(store.getState().history, before);
    assert.match(store.getState().problem, /about/);
    const d = store.getState().edit({ type: 'addScreen', name: 'help' });
    assert.deepStrictEqual(d.file.screens.map((s) => s.name), ['main', 'about', 'help']);
    assert.strictEqual(store.getState().problem, null);
});

test('undo and redo step through the edits, and do nothing at either end', () => {
    const store = storeAfter([{ type: 'addScreen', name: 'a' }, { type: 'addScreen', name: 'b' }]);
    const st = () => store.getState();
    st().undo();
    assert.deepStrictEqual(names(st()), ['main', 'a']);
    assert.ok(S.canRedoOf(st()));
    st().redo();
    assert.deepStrictEqual(names(st()), ['main', 'a', 'b']);
    const h = st().history;
    st().redo();
    assert.strictEqual(st().history, h);
    st().undo(); st().undo(); st().undo();
    assert.deepStrictEqual(names(st()), ['main']);
    assert.ok(!S.canUndoOf(st()));
});

test('the selected screen follows its rename, and falls back to the first screen when it goes', () => {
    const store = storeAfter([{ type: 'addScreen', name: 'about' }]);
    const st = () => store.getState();
    st().selectScreen('about');
    st().edit({ type: 'renameScreen', screen: 'about', name: 'help' });
    assert.strictEqual(st().selected, 'help');
    assert.strictEqual(S.screenOf(st()).name, 'help');
    st().edit({ type: 'deleteScreen', screen: 'help' });
    assert.strictEqual(st().selected, 'main');
    st().undo();                                    // the screen is back, but the first screen stays selected
    assert.strictEqual(st().selected, 'main');
    st().selectScreen('nowhere');                   // not a screen of the file: ignored
    assert.strictEqual(st().selected, 'main');
});

test('the selection follows an element rename and loses deleted elements; another screen starts with none', () => {
    const store = storeAfter([
        { type: 'addElement', screen: 'main', widget: 'button', name: 'ok', x: 0, y: 0 },
        { type: 'addElement', screen: 'main', widget: 'button', name: 'cancel', x: 0, y: 100 },
        { type: 'addScreen', name: 'about' },
    ]);
    const st = () => store.getState();
    st().select(['ok', 'cancel']);
    assert.strictEqual(S.elementOf(st()), undefined);          // several selected: no one element
    st().edit({ type: 'renameElement', screen: 'main', element: 'ok', name: 'save' });
    assert.deepStrictEqual(st().selection, ['save', 'cancel']);
    st().edit({ type: 'deleteElement', screen: 'main', element: 'cancel' });
    assert.deepStrictEqual(st().selection, ['save']);
    assert.strictEqual(S.elementOf(st()).name, 'save');
    st().selectScreen('about');
    assert.deepStrictEqual(st().selection, []);
});

test('adding a widget places it a step further than the last and selects it', () => {
    const store = S.createEditorStore();
    const st = () => store.getState();
    st().addElement('button');
    st().addElement('button');
    const [a, b] = S.screenOf(st()).components;
    assert.deepStrictEqual([a.x, a.y, b.x, b.y], [24, 24, 48, 48]);
    assert.deepStrictEqual(st().selection, [b.name]);
});

test('opening a document starts a fresh history on its first screen, with nothing selected', () => {
    const store = storeAfter([{ type: 'addScreen', name: 'about' }, { type: 'setFirstScreen', screen: 'about' }]);
    const doc = S.docOf(store.getState());
    const other = S.createEditorStore();
    other.getState().select(['x']);
    other.getState().edit({ type: 'addScreen', name: 'about' });
    other.getState().edit({ type: 'addScreen', name: 'about' });       // refused: a problem is shown
    other.getState().open(doc);
    const st = other.getState();
    assert.strictEqual(st.selected, 'about');
    assert.deepStrictEqual(st.selection, []);
    assert.strictEqual(st.problem, null);
    assert.ok(!S.canUndoOf(st));
});

test('going to a text issue shows its screen, element and language; the language falls back to the default', () => {
    const store = storeAfter([
        { type: 'addLanguage', code: 'en' }, { type: 'addLanguage', code: 'de' },
        { type: 'addScreen', name: 'about' },
        { type: 'addElement', screen: 'about', widget: 'button', name: 'ok', x: 0, y: 0 },
    ]);
    const st = () => store.getState();
    assert.strictEqual(S.languageOf(st()), 'en');
    st().goTo('about', 'ok', 'de');
    assert.deepStrictEqual([st().selected, st().selection, S.languageOf(st())], ['about', ['ok'], 'de']);
    st().edit({ type: 'removeLanguage', code: 'de' });
    assert.strictEqual(S.languageOf(st()), 'en');
});

test('stopping trying returns to the screen the walk ended on; reports keep the last 50', () => {
    const store = storeAfter([{ type: 'addScreen', name: 'about' }]);
    const st = () => store.getState();
    st().setDragOp({ type: 'addScreen' });
    st().setTrying(true);
    assert.strictEqual(st().dragOp, null);
    st().setWalking('about');
    for (let i = 0; i < 60; i++) st().report({ leave: String(i) });
    assert.strictEqual(st().reports.length, 50);
    assert.deepStrictEqual(st().reports[0], { leave: '10' });
    st().setTrying(false);
    assert.strictEqual(st().selected, 'about');
    st().clearReports();
    assert.deepStrictEqual(st().reports, []);
});

test('a canvas too small for the page at 100 % starts with it fitted', () => {
    const store = S.createEditorStore();
    store.getState().setMeasure({ w: 1000, h: 800 }, { w: 1820, h: 745 });
    assert.ok(Math.abs(store.getState().view.zoom - (1000 - 64) / 1820) < 1e-9);
});

test('the canvas starts centred at 100 % once measured; zooming keeps the canvas middle still; fitting fits', () => {
    const store = S.createEditorStore();
    const st = () => store.getState();
    st().zoomStep(1);                                       // not measured yet: nothing to zoom
    assert.strictEqual(st().view, null);
    st().setMeasure({ w: 2000, h: 1000 }, { w: 1820, h: 745 });
    assert.deepStrictEqual(st().view, { zoom: 1, x: 90, y: 127.5 });
    st().setMeasure({ w: 1000, h: 1000 }, { w: 1820, h: 745 });          // measuring again keeps the view
    assert.deepStrictEqual(st().view, { zoom: 1, x: 90, y: 127.5 });
    st().zoomStep(-1);
    assert.deepStrictEqual(st().view, { zoom: 0.75, x: 500 - 410 * 0.75, y: 500 - 372.5 * 0.75 });
    st().panBy(10, -20);
    assert.deepStrictEqual([st().view.x, st().view.y], [500 - 410 * 0.75 + 10, 500 - 372.5 * 0.75 - 20]);
    st().zoomToFit();
    assert.ok(Math.abs(st().view.zoom - (1000 - 64) / 1820) < 1e-9);
});

test('panels start as given (else docked); docking, floating, resizing or hiding the left one keeps the page still', () => {
    const kept = { left: { mode: 'floating', width: 300, x: 5, y: 6, collapsed: true }, right: { mode: 'docked', width: 320, x: null, y: null, collapsed: false } };
    assert.deepStrictEqual(S.createEditorStore(undefined, { panels: kept }).getState().panels, kept);
    const store = S.createEditorStore();
    const st = () => store.getState();
    assert.deepStrictEqual([st().panels.left.mode, st().panels.right.mode], ['docked', 'docked']);
    st().setMeasure({ w: 2000, h: 1000 }, { w: 1820, h: 745 });
    const x = st().view.x;
    st().setPanel('left', { mode: 'floating' });          // the canvas now starts 240 px further left
    assert.strictEqual(st().view.x, x + 240);
    st().setPanel('left', { mode: 'docked', width: 300 });
    assert.strictEqual(st().view.x, x - 60);
    st().setPanel('left', { width: 9999 });               // clamped to 560
    assert.strictEqual(st().panels.left.width, 560);
    assert.strictEqual(st().view.x, x - 320);
    st().togglePanelsHidden();
    assert.strictEqual(st().panelsHidden, true);
    assert.strictEqual(st().view.x, x + 240);
    st().setPanel('right', { mode: 'floating', x: 100, y: 50 });      // the right panel never moves the canvas's left edge
    assert.strictEqual(st().view.x, x + 240);
    assert.deepStrictEqual(st().panels.right, { mode: 'floating', width: 320, x: 100, y: 50, collapsed: false });
});
