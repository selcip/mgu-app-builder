'use strict';
// The starter app (starter/) packs as mgu-store's apps do: its source package (mgu-app.json, the modules, the package
// tree) for the head unit's deploy tool to build, and, given a donor bundle carrying the oap-sdk, the OAP tgz with the
// modules linked against the donor's oap-sdk modules (starter/vendor/oap_link.js, oap_pack.js). Nothing BMW-derived is
// in the repository: the donor here is a made-up one (test/fixtures/synthetic-donor.js). The linked app runs under
// Node 8 when NODE8 names a Node 8 binary.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const STARTER = path.join(ROOT, 'starter');
const { build, libSources } = require(path.join(STARTER, 'tools', 'build.js'));
const gen = require(path.join(STARTER, 'tools', 'gen_package.js'));
const donor = require('./fixtures/synthetic-donor.js');
const NODE8 = process.env.NODE8;

/** A copy of the starter to build in (building writes its generated files), and a folder for the packages. */
function scratch() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-'));
    const dir = path.join(tmp, 'starter');
    fs.cpSync(STARTER, dir, { recursive: true, filter: (p) => !/\.tgz$/.test(p) });
    fs.chmodSync(tmp, 0o755);
    return { tmp, dir, done: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

const list = (tgz) => execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8' }).trim().split('\n').sort();
const member = (tgz, name, cwd) => { execFileSync('tar', ['-xzf', tgz, name], { cwd }); return fs.readFileSync(path.join(cwd, name), 'utf8'); };

test('the starter app packs its source package and, with a donor, links the oap-sdk into its OAP tgz', () => {
    const s = scratch();
    try {
        const donorFile = path.join(s.tmp, 'donor.js');
        fs.writeFileSync(donorFile, donor.bundle());
        const r = build({ dir: s.dir, out: s.tmp, repo: ROOT, donor: donorFile, epoch: 1700000000 });
        const m = JSON.parse(fs.readFileSync(path.join(STARTER, 'mgu-app.json'), 'utf8'));

        const src = list(r.source);
        for (const f of ['mgu-app.json', 'main.js', 'lib/mgu_runtime.js', 'lib/am_gpu.js', 'vendor/mgu_render_client.js',
            'app/package.json', 'app/screens.json', 'app/images/logo.png', 'app/rhmiData/uiDescriptions/ID7/uiDescription.json']) {
            assert.ok(src.indexOf(f) >= 0, `source package has ${f}`);
        }
        assert.ok(!src.some((f) => /^app\/javascript\//.test(f)), 'no built bundle in the source package');

        const oap = list(r.tgz);
        for (const f of ['package.json', 'manifest.json', 'permissions.json', 'screens.json', 'images/logo.png',
            'javascript/app.js', 'javascript/build.json', 'rhmiData/application.json',
            'rhmiData/uiDescriptions/ID7/application.xml', 'rhmiData/variantGroups/Common/images/tile.png']) {
            assert.ok(oap.indexOf(f) >= 0, `OAP tgz has ${f}`);
        }
        const out = path.join(s.tmp, 'oap');
        fs.mkdirSync(out);
        const built = JSON.parse(member(r.tgz, 'javascript/build.json', out));
        assert.strictEqual(built.bundle.appModules, m.modules.length);
        const app = member(r.tgz, 'javascript/app.js', out);
        assert.match(app, /require\('\.\/mgu_oap\.js'\)/);
        assert.match(app, /"oap-sdk\/src\/core\/OnlineApp\.js":2/, 'main.js linked to the donor’s OnlineApp');
    } finally {
        s.done();
    }
});

test('the linked starter app starts under Node 8', { skip: !NODE8 && 'set NODE8 to a Node 8 binary' }, () => {
    const s = scratch();
    try {
        const donorFile = path.join(s.tmp, 'donor.js');
        fs.writeFileSync(donorFile, donor.bundle());
        const r = build({ dir: s.dir, out: s.tmp, repo: ROOT, donor: donorFile });
        const out = path.join(s.tmp, 'oap');
        fs.mkdirSync(out);
        execFileSync('tar', ['-xzf', r.tgz], { cwd: out });
        const said = execFileSync(NODE8, [path.join(out, 'javascript', 'app.js')], { encoding: 'utf8', timeout: 20000,
            env: Object.assign({}, process.env, { MGU_RENDERD_SOCKET: path.join(s.tmp, 'no-renderer.sock') }) });
        assert.match(said, /initialized/);
        assert.doesNotMatch(said, /^error /m, said);
    } finally {
        s.done();
    }
});

test('the committed starter is up to date: its generated tree, its runtime and kit, its module list', () => {
    const m = JSON.parse(fs.readFileSync(path.join(STARTER, 'mgu-app.json'), 'utf8'));
    const files = gen.files(STARTER);
    for (const rel of Object.keys(files)) {
        assert.ok(fs.readFileSync(path.join(STARTER, m.tree, rel)).equals(files[rel]), `${m.tree}/${rel} as tools/gen_package.js writes it`);
    }
    for (const [from, name] of libSources(ROOT)) {
        assert.ok(fs.readFileSync(path.join(STARTER, 'lib', name)).equals(fs.readFileSync(from)), `lib/${name} equals ${path.relative(ROOT, from)}`);
    }
    const libJs = fs.readdirSync(path.join(STARTER, 'lib')).filter((n) => n.endsWith('.js')).map((n) => `lib/${n}`);
    assert.deepStrictEqual(m.modules.filter((f) => f.startsWith('lib/')).sort(), libJs.sort());
    assert.strictEqual(m.modules[0], 'main.js', 'the entry first');
});

test('nothing BMW-derived is in the starter: no built bundle, no oap-sdk code, no node_modules', () => {
    const all = [];
    (function walk(d) {
        for (const n of fs.readdirSync(d)) {
            const p = path.join(d, n);
            if (fs.statSync(p).isDirectory()) walk(p); else all.push(path.relative(STARTER, p));
        }
    }(STARTER));
    assert.ok(!all.some((f) => /(^|\/)node_modules\//.test(f) || /(^|\/)javascript\//.test(f)), 'no javascript/ or node_modules/');
    for (const f of all.filter((n) => n.endsWith('.js'))) {
        const text = fs.readFileSync(path.join(STARTER, f), 'utf8');
        assert.ok(text.indexOf('function r(e,n,t)') < 0, `${f} is no browserify bundle`);
    }
});
