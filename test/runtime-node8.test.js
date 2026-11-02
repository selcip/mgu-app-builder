'use strict';
// The runtime runs on the head unit's Node 8: laid out flat as the OAP linker links an app (kit and runtime side
// by side, required by basename), it loads under Node 8 and draws the same recording as the golden file.
// Needs a Node 8 binary: NODE8=/path/to/node npm test (e.g. from `npm pack node-linux-x64@8.16.2`); skipped without.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const NODE8 = process.env.NODE8;

// Node 8 syntax only: this runs inside the flat app folder
const MAIN = `'use strict';
const fs = require('fs');
const { createRuntime } = require('./mgu_runtime.js');
require('./mgu_headunit.js');
const out = [];
const rt = createRuntime({ sink: { frame: function (rec) { const w = rec.words(); out.push(Buffer.from(w.buffer, w.byteOffset, w.byteLength)); return true; } } });
if (!rt.load(fs.readFileSync('screens.json', 'utf8')) || !rt.start()) process.exit(2);
process.stdout.write(process.version + ' ' + out[0].toString('base64'));
`;

test('the runtime loads under Node 8 in the flat app layout and draws the golden recording', { skip: !NODE8 && 'set NODE8 to a Node 8 binary' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-runtime-node8-'));
    try {
        for (const sub of ['kit', 'runtime']) {
            for (const f of fs.readdirSync(path.join(ROOT, sub))) if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, sub, f), path.join(dir, f));
        }
        fs.copyFileSync(path.join(__dirname, 'fixtures', 'screens', 'two-screens.json'), path.join(dir, 'screens.json'));
        fs.writeFileSync(path.join(dir, 'main.js'), MAIN);
        const [version, frame] = execFileSync(NODE8, ['main.js'], { cwd: dir, encoding: 'utf8' }).split(' ');
        assert.match(version, /^v8\./);
        const golden = fs.readFileSync(path.join(__dirname, 'golden', 'runtime-two-screens-settings.rec'));
        assert.ok(Buffer.from(frame, 'base64').equals(golden), 'Node 8 recording differs from the golden file');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
