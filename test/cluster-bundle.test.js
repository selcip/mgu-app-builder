'use strict';
// The Designer's `virtual:cluster-engine` bundle (designer/vite.config.ts) is what the browser runs: the vendored engine,
// the stand-in and our host with the Node pieces shimmed. Here that very bundle is built by the plugin and evaluated in
// Node as an ES module with nothing of the engine's Node requires left in it, and GT3 must register the same 8 layers
// as in cluster-engine.test.js. (The WebGL stage drawing them is proved in a browser, not here.)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gt3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cluster-layouts', 'gt3.json'), 'utf8'));

async function bundle() {
    const config = (await import('../designer/vite.config.ts')).default;
    const plugin = config.plugins.flat().find((p) => p && p.name === 'cluster-engine');
    const code = await plugin.load.call({ addWatchFile() {} }, '\0virtual:cluster-engine');
    return { code, mod: (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).default };
}

test('the browser bundle has no Node requires left and runs GT3 on the stand-in', async () => {
    const { code, mod } = await bundle();
    assert.doesNotMatch(code, /require\(["'](fs|net|events|path|zlib|child_process|http)["']\)/);
    assert.doesNotMatch(code, /from ["']node:/);
    assert.deepStrictEqual(Object.keys(mod).sort(), ['TARGETS', 'checks', 'createEngine', 'createStage', 'visible']);
    const engine = mod.createEngine({ name: 'gt3', layout: gt3 });
    try {
        const t0 = Date.now();
        while (engine.scene().length !== 8) {
            if (Date.now() - t0 > 8000) throw new Error('timed out; layers: ' + engine.scene().length + '; ' + engine.status());
            await new Promise((r) => setTimeout(r, 25));
        }
        assert.deepStrictEqual(engine.scene().map((l) => l.kind), ['effect', 'effect', 'image', 'effect', 'image', 'image', 'image', 'image']);
    } finally {
        engine.stop();
    }
});
