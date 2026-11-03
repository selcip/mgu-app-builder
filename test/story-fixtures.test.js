'use strict';
// The screen files the Designer's stories start from (designer/src/fixtures/screen-files.ts): each is a document
// the model accepts, and each still shows the case it is named for.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SRC = path.join(__dirname, '..', 'designer', 'src');
let F, M;
before(async () => {
    F = await import(pathToFileURL(path.join(SRC, 'fixtures', 'screen-files.ts')).href);
    M = await import(pathToFileURL(path.join(SRC, 'model', 'index.ts')).href);
});

test('each fixture round-trips through a zip unchanged', () => {
    for (const [name, doc] of Object.entries(F.SCREEN_FILES)) {
        assert.deepStrictEqual(M.importZip(M.exportZip(doc)).file, doc.file, name);
    }
});

test('each fixture shows its case, and only the typical one shows none', () => {
    const cases = (d) => ({
        dead: M.deadLinks(d.file).length, missingImages: M.missingImages(d).length, missingTexts: M.missingTranslations(d.file).length,
    });
    assert.deepStrictEqual(F.empty.file.screens.map((s) => s.components.length), [0]);
    assert.deepStrictEqual(cases(F.typical), { dead: 0, missingImages: 0, missingTexts: 0 });
    assert.ok(M.linksOf(F.typical.file).length >= 3, 'typical has links');
    assert.ok(cases(F.deadLinks).dead > 0, 'deadLinks has dead links');
    assert.ok(cases(F.missingImages).missingImages > 0, 'missingImages has missing pictures');
    assert.ok(cases(F.textIssues).missingTexts > 0, 'textIssues has missing translations');
    assert.ok(M.textsOf(F.textIssues.file).some((t) => /\p{Extended_Pictographic}/u.test(JSON.stringify(t.value))), 'textIssues has a character the kit cannot draw');
});
