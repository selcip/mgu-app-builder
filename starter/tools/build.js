'use strict';
/**
 * Builds the app's source package and, given a donor, its OAP tgz (as mgu-store's apps/robertn_store/tools/build.js).
 *
 *   node tools/build.js [--sdk <donor .tgz|.js>]      (or MGU_SDK_DONOR)
 *
 *  1. Inside the mgu-ui-builder repository only: copies the runtime (runtime/*.js) and the kit (kit/) into lib/, and
 *     says so (commit them), so lib/ is the runtime and kit this app ships.
 *  2. Writes the generated files of the package tree (tools/gen_package.js).
 *  3. Packs the source package <id>@<version>.src.tgz: mgu-app.json, the modules and the tree (vendor/oap_link.js).
 *     The head unit's deploy tool builds it ("build": "unit" in a catalog), linking the oap-sdk from a donor bundle on
 *     the unit.
 *  4. With a donor (a browserify bundle or an OAP .tgz that carries the oap-sdk, e.g. one from the head unit or the
 *     emulator), builds the OAP tgz <id>@<version>.tgz: the modules linked against the donor's oap-sdk modules, the
 *     donor's entry point as package.json's main, node --check, javascript/build.json, the flat tgz.
 */
const fs = require('fs');
const path = require('path');

const HERE = path.join(__dirname, '..');
const link = require(path.join(HERE, 'vendor', 'oap_link.js'));

function donorArg(argv) {
    const i = argv.indexOf('--sdk');
    if (i >= 0) {
        if (!argv[i + 1]) throw new Error('--sdk needs a donor .tgz or .js');
        return path.resolve(argv[i + 1]);
    }
    return process.env.MGU_SDK_DONOR ? path.resolve(process.env.MGU_SDK_DONOR) : null;
}

/** The runtime and kit files lib/ holds, from this repository: [from, name]. */
function libSources(repo) {
    const out = [];
    ['runtime', 'kit'].forEach((sub) => {
        fs.readdirSync(path.join(repo, sub)).filter((n) => /\.js$/.test(n) || /^LICENSE/.test(n)).sort()
            .forEach((n) => out.push([path.join(repo, sub, n), n]));
    });
    return out;
}

function syncLib(here, repo) {
    if (!fs.existsSync(path.join(repo, 'runtime', 'mgu_runtime.js')) || !fs.existsSync(path.join(repo, 'kit', 'SOURCE.json'))) {
        return [];
    }
    const lib = path.join(here, 'lib');
    fs.mkdirSync(lib, { recursive: true });
    const written = [];
    libSources(repo).forEach(([from, name]) => {
        const to = path.join(lib, name);
        const data = fs.readFileSync(from);
        if (!fs.existsSync(to) || !fs.readFileSync(to).equals(data)) {
            fs.writeFileSync(to, data);
            written.push(name);
        }
    });
    return written;
}

function build(opts) {
    opts = opts || {};
    const here = opts.dir || HERE;
    const out = opts.out || here;
    const synced = syncLib(here, opts.repo || path.join(here, '..'));
    synced.forEach((n) => console.error(`lib/${n} written from the repository: commit it`));
    require('./gen_package.js').write(here);
    const m = link.readManifest(here);
    const src = path.join(out, `${m.id}@${m.version}.src.tgz`);
    const result = { source: src, sourceMembers: link.packSource(here, src) };
    if (opts.donor) {
        const r = link.build(here, path.join(out, `${m.id}@${m.version}.tgz`), { donors: [opts.donor], epoch: opts.epoch });
        Object.assign(result, { tgz: r.file, donor: r.donor, main: r.entry, bundleModules: r.moduleCount, bundleBytes: r.bytes });
    }
    return result;
}

if (require.main === module) {
    try {
        const r = build({ donor: donorArg(process.argv.slice(2)), epoch: process.env.SOURCE_DATE_EPOCH });
        console.log(JSON.stringify(Object.assign({}, r, { source: path.basename(r.source), sourceMembers: r.sourceMembers.length,
            tgz: r.tgz && path.basename(r.tgz) }), null, 2));
    } catch (e) {
        console.error(`build: ${e.message}`);
        process.exitCode = 1;
    }
}

module.exports = { build, libSources };
