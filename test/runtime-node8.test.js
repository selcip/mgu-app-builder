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

// Node 8 syntax only: the head-unit adapter reads images/ beside screens.json and the recording draws the PNG
const PICTURES = `'use strict';
const fs = require('fs');
const EventEmitter = require('events');
const { runOnHeadUnit } = require('./mgu_headunit.js');
const { play } = require('./kit_record.js');
const { Canvas } = require('./kit_canvas.js');
const client = new EventEmitter();
const seen = [];
Object.assign(client, { connect() {}, mode() {}, place() {}, show() {}, frame(rec) {
    const cv = new Canvas(1796, 632); play(rec.words(), cv); const i = (150 * 1796 + 200) * 4;
    seen.push([cv.d[i], cv.d[i + 1], cv.d[i + 2]].join(',')); return true; } });
const log = { lines: [], error(m) { this.lines.push(m); }, warn(m) { this.lines.push(m); }, info() {} };
if (!runOnHeadUnit({ client, log, dir: __dirname, screens: fs.readFileSync('screens.json', 'utf8') })) process.exit(2);
process.stdout.write(process.version + ' ' + seen.join(';') + ' ' + JSON.stringify(log.lines));
`;

test('under Node 8 the head unit draws a picture from images/ beside the screen file', { skip: !NODE8 && 'set NODE8 to a Node 8 binary' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-runtime-node8-'));
    try {
        for (const sub of ['kit', 'runtime']) {
            for (const f of fs.readdirSync(path.join(ROOT, sub))) if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, sub, f), path.join(dir, f));
        }
        const { Canvas } = require(path.join(ROOT, 'kit', 'kit_canvas.js'));
        const blue = new Canvas(8, 8);
        for (let i = 0; i < blue.d.length; i += 4) blue.d.set([0, 0, 255, 255], i);
        fs.mkdirSync(path.join(dir, 'images'));
        fs.writeFileSync(path.join(dir, 'images', 'blue.png'), blue.png());
        fs.writeFileSync(path.join(dir, 'screens.json'), JSON.stringify({ schema: 1, first: 'main', screens: [{ name: 'main', theme: 'm_tricolour',
            bg: '#000000', components: [{ name: 'logo', gpu: 'image', x: 100, y: 100, w: 200, h: 100, opts: { src: 'images/blue.png' } }] }] }));
        fs.writeFileSync(path.join(dir, 'main.js'), PICTURES);
        const [version, pixels, log] = execFileSync(NODE8, ['main.js'], { cwd: dir, encoding: 'utf8' }).split(' ');
        assert.match(version, /^v8\./);
        assert.strictEqual(pixels, '0,0,255');
        assert.strictEqual(log, '[]');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
