'use strict';
// The sync script copies the kit from a named mgu-store commit (never the working tree) and records the commit.
// Needs a local mgu-store clone: MGU_STORE, or ../mgu-store beside this repository (skipped without one).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'sync-kit.js');
const CLONE = process.env.MGU_STORE || path.join(ROOT, '..', 'mgu-store');
const SRC = 'apps/robertn_store/src';
const git = (dir, ...args) => cp.execFileSync('git', ['-C', dir, ...args], { maxBuffer: 64 * 1024 * 1024 });
const haveClone = fs.existsSync(path.join(CLONE, '.git')) || fs.existsSync(path.join(CLONE, 'HEAD'));
const PIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'kit', 'SOURCE.json'), 'utf8')).commit;

test('copies the kit from the named commit, not the working tree, and records the commit', { skip: !haveClone && 'no mgu-store clone' }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-kit-'));
    const store = path.join(tmp, 'mgu-store');
    cp.execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', CLONE, store]);
    git(store, 'checkout', '-q', PIN);
    fs.appendFileSync(path.join(store, SRC, 'kit_canvas.js'), '\n// local edit, not committed\n');
    const out = path.join(tmp, 'out');

    cp.execFileSync(process.execPath, [SCRIPT, '--from', store, '--commit', PIN.slice(0, 7), '--out', out]);

    const rec = JSON.parse(fs.readFileSync(path.join(out, 'kit', 'SOURCE.json'), 'utf8'));
    assert.strictEqual(rec.commit, git(store, 'rev-parse', PIN).toString().trim());
    assert.ok(rec.files.length > 0);
    for (const f of rec.files) {
        const want = git(store, 'show', `${PIN}:${SRC}/${f.name}`);
        assert.ok(want.equals(fs.readFileSync(path.join(out, 'kit', f.name))), `${f.name} as at the commit`);
    }
    assert.deepStrictEqual(fs.readdirSync(path.join(out, 'kit')).sort(), rec.files.map((f) => f.name).concat('SOURCE.json').sort());
    fs.rmSync(tmp, { recursive: true, force: true });
});
