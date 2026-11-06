'use strict';
/**
 * Copies the cluster engine from a named apps-repo commit into engine/, byte for byte, read with
 * `git show <commit>:<path>` so the clone's working tree never leaks in. Files keep their paths in the apps repo
 * (engine/shared/hud.js, engine/bench/render_protocol.js, ...). engine/SOURCE.json records the full commit and every
 * file with its git blob id. Files no longer in the list are removed. Never edit engine/ by hand.
 *
 *   node scripts/sync-engine.js --from <apps clone> --commit <rev> [--out <this repo's root>]
 *
 * What is copied (ADR 0005):
 *   shared/*.js                 the engine: the drawing code (hud.js and what it requires)
 *   bench/render_protocol.js    the stand-in for cluster-render (protocol v1 and its limits), transport-free
 *   bench/stage.js              the WebGL stage that draws the layers
 *   kit/runtime/{car,sim,pack}.js   the three kit modules the engine requires at load time
 *   apps/cluster_themes/hud/fonts/*.json   the baked fonts the cluster layouts use
 *   apps/cluster_themes/app.json            the app's settings schema and config (defaults for the engine)
 *   licence files and the app's NOTICE
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const DIR = 'engine';
const SHARED = ['calibration', 'cluster_render_client', 'hud', 'hud_data', 'hud_text', 'hud_themes', 'icons', 'layouts',
    'shaders', 'shift_score', 'sun', 'visible'].map((n) => `shared/${n}.js`);
const FIXED = SHARED.concat([
    'bench/render_protocol.js', 'bench/stage.js',
    'kit/runtime/car.js', 'kit/runtime/sim.js', 'kit/runtime/pack.js',
    'apps/cluster_themes/app.json',
    'apps/cluster_themes/NOTICE', 'kit/LICENSE', 'LICENSE',
]);
const FONTS_DIR = 'apps/cluster_themes/hud/fonts';

function args(argv) {
    const o = {};
    for (let i = 0; i < argv.length; i += 2) {
        if (!/^--(from|commit|out)$/.test(argv[i]) || argv[i + 1] === undefined) {
            throw new Error(`usage: sync-engine.js --from <apps clone> --commit <rev> [--out <dir>] (bad argument ${argv[i]})`);
        }
        o[argv[i].slice(2)] = argv[i + 1];
    }
    if (!o.from || !o.commit) throw new Error('usage: sync-engine.js --from <apps clone> --commit <rev> [--out <dir>]');
    return o;
}

/** The paths the copy holds at a commit, sorted. */
function listFiles(git, commit) {
    const fonts = git('ls-tree', '-r', '--name-only', commit, '--', FONTS_DIR).toString().split('\n')
        .filter((p) => /\.json$/.test(p));
    return FIXED.concat(fonts).sort();
}

function sync(from, rev, out) {
    const git = (...a) => cp.execFileSync('git', ['-C', from, ...a], { maxBuffer: 256 * 1024 * 1024 });
    const commit = git('rev-parse', '--verify', `${rev}^{commit}`).toString().trim();
    const root = path.join(out, DIR);
    fs.rmSync(root, { recursive: true, force: true });
    const files = listFiles(git, commit).map((p) => {
        const dest = path.join(root, ...p.split('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, git('show', `${commit}:${p}`));
        return { name: p, blob: git('rev-parse', `${commit}:${p}`).toString().trim() };
    });
    fs.writeFileSync(path.join(root, 'SOURCE.json'), JSON.stringify({ repo: 'apps', commit, files }, null, 2) + '\n');
    return commit;
}

if (require.main === module) {
    try {
        const o = args(process.argv.slice(2));
        const commit = sync(path.resolve(o.from), o.commit, path.resolve(o.out || path.join(__dirname, '..')));
        console.log(`synced the engine from apps ${commit}`);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

module.exports = { sync, listFiles };
