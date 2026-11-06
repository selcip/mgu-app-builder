'use strict';
// The cluster engine in engine/ is a pinned, unmodified copy of the apps repo at the commit SOURCE.json names.
// The first test needs no clone: every file must hold the bytes of the blob id recorded for it. The second needs a
// local apps clone: APPS_REPO, or ../apps beside this repository (skipped without one); it checks that the copy
// equals the commit and that the sync script copies from the commit, not the working tree.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'sync-engine.js');
const CLONE = process.env.APPS_REPO || path.join(ROOT, '..', 'apps');
const git = (dir, ...args) => cp.execFileSync('git', ['-C', dir, ...args], { maxBuffer: 256 * 1024 * 1024 });
const haveClone = fs.existsSync(path.join(CLONE, '.git')) || fs.existsSync(path.join(CLONE, 'HEAD'));
const REC = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine', 'SOURCE.json'), 'utf8'));

const blobId = (bytes) => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const filesUnder = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(dir, `${rel}${e.name}/`) : [`${rel}${e.name}`]));

test('engine/ holds exactly the files SOURCE.json lists, each with its recorded blob id', () => {
    assert.match(REC.commit, /^[0-9a-f]{40}$/);
    assert.deepStrictEqual(filesUnder(path.join(ROOT, 'engine')).filter((f) => f !== 'SOURCE.json').sort(), REC.files.map((f) => f.name).sort());
    for (const f of REC.files) {
        assert.strictEqual(blobId(fs.readFileSync(path.join(ROOT, 'engine', ...f.name.split('/')))), f.blob, `${f.name} was edited or drifted`);
    }
});

test('the pin names the engine, the two bench modules and the fonts', () => {
    const names = REC.files.map((f) => f.name);
    for (const n of ['shared/hud.js', 'shared/layouts.js', 'shared/shaders.js', 'shared/visible.js', 'bench/render_protocol.js', 'bench/stage.js', 'apps/cluster_themes/hud/fonts/gear.json']) {
        assert.ok(names.includes(n), n);
    }
});

test('copies the engine from the named commit, not the working tree, and records it', { skip: !haveClone && 'no apps clone' }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-engine-'));
    const apps = path.join(tmp, 'apps');
    cp.execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', CLONE, apps]);
    git(apps, 'checkout', '-q', REC.commit);
    fs.appendFileSync(path.join(apps, 'shared', 'hud.js'), '\n// local edit, not committed\n');
    const out = path.join(tmp, 'out');

    cp.execFileSync(process.execPath, [SCRIPT, '--from', apps, '--commit', REC.commit.slice(0, 7), '--out', out]);

    const rec = JSON.parse(fs.readFileSync(path.join(out, 'engine', 'SOURCE.json'), 'utf8'));
    assert.deepStrictEqual(rec, REC, 'the copy equals the one committed here (so it has not drifted from the pin)');
    for (const f of rec.files) {
        assert.ok(git(apps, 'show', `${REC.commit}:${f.name}`).equals(fs.readFileSync(path.join(out, 'engine', ...f.name.split('/')))), `${f.name} as at the commit`);
        assert.strictEqual(git(apps, 'rev-parse', `${REC.commit}:${f.name}`).toString().trim(), f.blob);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
});
