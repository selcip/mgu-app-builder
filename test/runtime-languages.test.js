'use strict';
// Seam 1 (runtime -> recording), languages: a text option is a string or a map of language code to string; the
// runtime draws the active language and falls back to the screen file's default (its first language). Expected
// recordings come from drawing the same screen with the plain string the driver should see.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
require('./flat-layout.js');     // the runtime requires the kit by basename, as on the head unit
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
const { undrawable } = require(path.join(ROOT, 'runtime', 'mgu_text.js'));

const base = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'screens', 'two-screens.json'), 'utf8'));

/** The settings screen with its heading and fog row label set to the given values. */
function settings(heading, label, languages) {
    const f = base();
    if (languages) f.languages = languages;
    const s = f.screens.find((x) => x.name === 'settings');
    s.components.find((c) => c.name === 'heading').opts.text = heading;
    s.components.find((c) => c.name === 'fog').opts.label = label;
    return f;
}

function bufferSink() {
    const frames = [];
    return {
        frames,
        frame(rec) {
            const w = rec.words();
            frames.push(Buffer.from(w.buffer, w.byteOffset, w.byteLength));
            return true;
        },
    };
}

function captureLog() {
    const lines = [];
    const put = (m) => lines.push(String(m));
    return { lines, error: put, warn: put, info: put, log: put };
}

/** Runs a file; `steps(rt)` may switch languages. Returns the frames drawn and the log. */
function run(file, steps) {
    const sink = bufferSink(), log = captureLog();
    const rt = createRuntime({ kit, sink, log });
    assert.strictEqual(rt.load(file), true, log.lines.join('\n'));
    if (steps) steps(rt, 'before');
    rt.start();
    if (steps) steps(rt, 'after');
    return { frames: sink.frames, log: log.lines, rt };
}
const plain = (heading, label) => run(settings(heading, label)).frames[0];

const DE = { en: 'Settings', de: 'Einstellungen' };
const FOG = { en: 'Fog lights', de: 'Nebelscheinwerfer' };

test('a screen file with languages draws its default language (the first) when no language is chosen', () => {
    const { frames, log } = run(settings(DE, FOG, ['en', 'de']));
    assert.strictEqual(frames.length, 1);
    assert.ok(frames[0].equals(plain('Settings', 'Fog lights')), log.join('\n'));
    assert.deepStrictEqual(log, []);
});

test('choosing a language draws its texts, and switching while shown draws the screen again in the new one', () => {
    const { frames, rt } = run(settings(DE, FOG, ['en', 'de']), (r, when) => {
        if (when === 'before') assert.strictEqual(r.setLanguage('de'), true);
        else assert.strictEqual(r.setLanguage('en'), true);
    });
    assert.strictEqual(frames.length, 2);
    assert.ok(frames[0].equals(plain('Einstellungen', 'Nebelscheinwerfer')), 'German first');
    assert.ok(frames[1].equals(plain('Settings', 'Fog lights')), 'then English');
    assert.strictEqual(rt.language(), 'en');
});

test('a text missing in the active language is drawn in the default language', () => {
    const { frames } = run(settings({ en: 'Settings', fr: 'Réglages' }, FOG, ['en', 'de', 'fr']), (r, when) => {
        if (when === 'before') r.setLanguage('de');
    });
    assert.ok(frames[0].equals(plain('Settings', 'Nebelscheinwerfer')));
});

test('a language the screen file does not have is refused with a log line, and the default language is drawn', () => {
    const { frames, log, rt } = run(settings(DE, FOG, ['en', 'de']), (r, when) => {
        if (when === 'before') assert.strictEqual(r.setLanguage('it'), false);
    });
    assert.ok(frames[0].equals(plain('Settings', 'Fog lights')));
    assert.ok(log.some((l) => /"it"/.test(l)), log.join('\n'));
    assert.strictEqual(rt.language(), 'en');
});

test('plain strings in a file with languages are drawn as they are in every language', () => {
    const { frames } = run(settings('Settings', FOG, ['en', 'de']), (r, when) => {
        if (when === 'before') r.setLanguage('de');
    });
    assert.ok(frames[0].equals(plain('Settings', 'Nebelscheinwerfer')));
});

// The kit's fonts (Inter) have ASCII and ° · × – — … → only; Chinese has a font of its own, used while the
// language drawn is Chinese. Any other character is drawn as '?'.

test('undrawable() names the characters the kit draws as "?", once each, in order', () => {
    assert.deepStrictEqual(undrawable('Größe öffnen', 'de'), ['ö', 'ß']);
    assert.deepStrictEqual(undrawable('Oil 96 °C · 3×4 – ok… →', 'en'), []);
    assert.deepStrictEqual(undrawable('Привет', 'ru'), ['П', 'р', 'и', 'в', 'е', 'т']);
    assert.deepStrictEqual(undrawable('设置 Wi-Fi', 'en'), ['设', '置']);
    assert.deepStrictEqual(undrawable('设置 Wi-Fi', 'zh-CN'), []);
    assert.deepStrictEqual(undrawable('', 'de'), []);
});

test('characters undrawable() names are what the runtime draws as "?"', () => {
    assert.ok(plain('Größe', FOG.en).equals(plain('Gr??e', FOG.en)));
    assert.ok(!plain('Grosse', FOG.en).equals(plain('Gr??e', FOG.en)));
});

test('Chinese texts are drawn with the kit\'s Chinese font while the language drawn is Chinese', () => {
    const zh = { en: 'Settings', 'zh-CN': '设置' };
    const asChinese = run(settings(zh, FOG, ['en', 'zh-CN']), (r, when) => { if (when === 'before') r.setLanguage('zh-CN'); });
    const asEnglish = run(settings('设置', FOG, ['en', 'zh-CN'])).frames[0];
    assert.ok(asEnglish.equals(plain('??', 'Fog lights')), 'in English, Chinese characters are "?"');
    assert.ok(!asChinese.frames[0].equals(asEnglish), 'in Chinese they are drawn');
    // and back in English the Inter atlas is used again
    asChinese.rt.setLanguage('en');
    assert.ok(asChinese.frames[1].equals(plain('Settings', 'Fog lights')));
});
