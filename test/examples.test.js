'use strict';
// The example screen files (examples/*/): each is a valid screen file the runtime draws without warnings, and its
// zip (what the Designer opens) holds the same screens.json.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
require('./flat-layout.js');

const ROOT = path.join(__dirname, '..');
const kit = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { createRuntime } = require(path.join(ROOT, 'runtime', 'mgu_runtime.js'));
let M;
before(async () => { M = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href); });

const EXAMPLES = fs.readdirSync(path.join(ROOT, 'examples')).filter((d) => fs.existsSync(path.join(ROOT, 'examples', d, 'screens.json')));

for (const name of EXAMPLES) {
    test(`example ${name}: opens in the Designer and every screen draws without warnings`, () => {
        const dir = path.join(ROOT, 'examples', name);
        const file = JSON.parse(fs.readFileSync(path.join(dir, 'screens.json'), 'utf8'));
        assert.strictEqual(M.screenFileProblem(file), null);
        assert.deepStrictEqual(M.deadLinks(file), []);
        const zip = path.join(dir, name + '.zip');
        assert.deepStrictEqual(M.importZip(new Uint8Array(fs.readFileSync(zip))).file, file, `${name}.zip matches screens.json`);
        for (const s of file.screens) {
            const lines = [];
            const log = { error: (m) => lines.push(m), warn: (m) => lines.push(m), info() {}, log() {} };
            let frames = 0;
            const rt = createRuntime({ kit, log, sink: { frame() { frames++; return true; } } });
            assert.ok(rt.load(Object.assign({}, file, { first: s.name })), lines.join('\n'));
            rt.start();
            assert.ok(frames > 0, `${s.name} drew`);
            assert.deepStrictEqual(lines, [], `${s.name}: no warnings`);
        }
    });
}
