'use strict';
// Seam 2 (document model -> screen file), languages: the screen file's `languages` (the first is the default) and
// texts entered per language; a text is a plain string or a map of language code to string.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const edit = (ops, doc) => ops.reduce((d, op) => M.apply(d, op), doc || M.newDocument());
const refused = (fn, re) => assert.throws(fn, (e) => e instanceof M.EditError && re.test(e.message));
const el = (doc, name, screen = 'main') => doc.file.screens.find((s) => s.name === screen).components.find((c) => c.name === name);

test('the first language added is the default (the one the texts are written in); later ones follow it', () => {
    assert.strictEqual(M.newDocument().file.languages, undefined);
    const d = edit([{ type: 'addLanguage', code: 'en' }, { type: 'addLanguage', code: 'de' }, { type: 'addLanguage', code: 'zh-CN' }]);
    assert.deepStrictEqual(d.file.languages, ['en', 'de', 'zh-CN']);
    refused(() => M.apply(d, { type: 'addLanguage', code: 'de' }), /already/);
    refused(() => M.apply(d, { type: 'addLanguage', code: 'German' }), /language code/);
    refused(() => M.apply(d, { type: 'addLanguage', code: '' }), /language code/);
});

const twoLanguages = () => edit([
    { type: 'addLanguage', code: 'en' }, { type: 'addLanguage', code: 'de' },
    { type: 'addElement', screen: 'main', widget: 'button' },       // text "Apply"
]);

test('a text entered in another language turns the plain string into a map; the default keeps the plain text', () => {
    let d = M.apply(twoLanguages(), { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: 'Übernehmen' });
    assert.deepStrictEqual(el(d, 'button1').opts.text, { en: 'Apply', de: 'Übernehmen' });
    d = M.apply(d, { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'en', value: 'OK' });
    assert.deepStrictEqual(el(d, 'button1').opts.text, { en: 'OK', de: 'Übernehmen' });
});

test('clearing a translation leaves it missing, and a text with only the default language is a plain string again', () => {
    let d = M.apply(twoLanguages(), { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: 'Übernehmen' });
    d = M.apply(d, { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: '' });
    assert.strictEqual(el(d, 'button1').opts.text, 'Apply');
});

test('with one language or none, a text entered is a plain string', () => {
    let d = edit([{ type: 'addElement', screen: 'main', widget: 'button' }]);
    d = M.apply(d, { type: 'setText', screen: 'main', element: 'button1', key: 'text', value: 'Go' });
    assert.strictEqual(el(d, 'button1').opts.text, 'Go');
    d = edit([{ type: 'addLanguage', code: 'de' }, { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: 'Los' }], d);
    assert.strictEqual(el(d, 'button1').opts.text, 'Los');
});

test('a screen title is entered per language too', () => {
    const d = M.apply(twoLanguages(), { type: 'setText', screen: 'main', language: 'de', value: 'Start' });
    assert.deepStrictEqual(d.file.screens[0].title, { en: 'Main', de: 'Start' });
    assert.strictEqual(M.textIn(d.file.screens[0].title, d.file.languages, 'de'), 'Start');
    assert.strictEqual(M.textIn(d.file.screens[0].title, d.file.languages, 'en'), 'Main');
});

test('texts can only be entered in the screen file\'s languages, and only in text options', () => {
    const d = twoLanguages();
    refused(() => M.apply(d, { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'fr', value: 'x' }), /no language fr/);
    refused(() => M.apply(d, { type: 'setText', screen: 'main', element: 'button1', key: 'style', language: 'de', value: 'x' }), /not a text/);
    refused(() => M.apply(d, { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: 3 }), /text/);
});

test('the texts missing a translation are listed with the languages they miss, screen titles included', () => {
    let d = edit([
        { type: 'addLanguage', code: 'en' },
        { type: 'setScreenTitle', screen: 'main', title: 'Main' },
        { type: 'addElement', screen: 'main', widget: 'button' },           // text "Apply"
        { type: 'addElement', screen: 'main', widget: 'rect' },             // no texts
        { type: 'addElement', screen: 'main', widget: 'row' },              // label, sub "", text ""
    ]);
    assert.deepStrictEqual(M.missingTranslations(d.file), [], 'nothing to translate with one language');
    d = edit([
        { type: 'addLanguage', code: 'de' }, { type: 'addLanguage', code: 'fr' },
        { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: 'Übernehmen' },
        { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'fr', value: 'Appliquer' },
        { type: 'setText', screen: 'main', language: 'de', value: 'Start' },
    ], d);
    assert.deepStrictEqual(M.missingTranslations(d.file), [
        { screen: 'main', key: 'title', value: { en: 'Main', de: 'Start' }, missing: ['fr'] },
        { screen: 'main', element: 'row1', key: 'label', value: 'Fold mirrors when locking', missing: ['de', 'fr'] },
    ]);
});

test('a Store screen file (no languages, plain strings) has nothing missing and keeps its texts', () => {
    const { compact } = require(path.join(__dirname, 'fixtures', 'mgu-store', 'store_compact.js'));
    const file = JSON.parse(JSON.stringify(compact(1796, 632)));
    const doc = M.importScreenFile(structuredClone(file));
    assert.deepStrictEqual(M.missingTranslations(doc.file), []);
    for (const t of M.textsOf(doc.file)) assert.strictEqual(typeof t.value, 'string');
});

test('removing a language removes its texts; with one language left every text is a plain string again', () => {
    let d = edit([
        { type: 'addLanguage', code: 'en' }, { type: 'addLanguage', code: 'de' }, { type: 'addLanguage', code: 'fr' },
        { type: 'addElement', screen: 'main', widget: 'button' },
        { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'de', value: 'Übernehmen' },
        { type: 'setText', screen: 'main', element: 'button1', key: 'text', language: 'fr', value: 'Appliquer' },
        { type: 'setText', screen: 'main', language: 'fr', value: 'Accueil' },
    ]);
    d = M.apply(d, { type: 'removeLanguage', code: 'fr' });
    assert.deepStrictEqual(d.file.languages, ['en', 'de']);
    assert.deepStrictEqual(el(d, 'button1').opts.text, { en: 'Apply', de: 'Übernehmen' });
    assert.strictEqual(d.file.screens[0].title, 'Main');
    // removing the default makes the next language the default, and its texts the plain ones
    d = M.apply(d, { type: 'removeLanguage', code: 'en' });
    assert.deepStrictEqual(d.file.languages, ['de']);
    assert.strictEqual(el(d, 'button1').opts.text, 'Übernehmen');
    d = M.apply(d, { type: 'removeLanguage', code: 'de' });
    assert.strictEqual(d.file.languages, undefined);
    assert.strictEqual(el(d, 'button1').opts.text, 'Übernehmen');
    refused(() => M.apply(d, { type: 'removeLanguage', code: 'de' }), /no language de/);
});
