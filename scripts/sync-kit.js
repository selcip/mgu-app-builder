'use strict';
/**
 * Copies the kit from a named mgu-store commit into kit/ (and the Store's iDrive 7 screens into
 * test/fixtures/mgu-store/), byte for byte, read with `git show <commit>:<path>` so the clone's
 * working tree never leaks in. Each destination gets a SOURCE.json beside the copy: the full
 * commit and every file with its git blob id. Files no longer in the list are removed.
 *
 *   node scripts/sync-kit.js --from <mgu-store clone> --commit <rev> [--out <this repo's root>]
 *
 * Kit updates land in mgu-store first; sync here deliberately, then run `npm test`.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const SRC = 'apps/robertn_store/src';

// The kit: canvas, recording, fonts, themes, vector icons, PNG code, the widgets and their drawing code
// (am_gpu.js and everything it requires), and their licence notices.
const KIT = [
    'kit_canvas.js', 'kit_record.js', 'kit_fonts.js', 'kit_themes.js', 'kit_vicons.js', 'kit_png.js',
    'font_regular.js', 'font_semibold.js', 'font_chinese.js', 'i18n.js', 'locales.js',
    'am_gpu.js', 'am_elements.js', 'am_widgets.js', 'am_store_widgets.js', 'store_elements.js', 'qr.js', 'qrcodegen.js',
    'LICENSE-kit.txt', 'LICENSE-Inter.txt', 'LICENSE-NotoSansSC.txt', 'LICENSE-qrcodegen.txt',
];
// The Store's screens laid out for iDrive 7 (1796 x 632): test input only, never shipped.
const FIXTURES = ['store_compact.js'];

const DESTS = [
    { dir: 'kit', files: KIT },
    { dir: path.join('test', 'fixtures', 'mgu-store'), files: FIXTURES },
];

function args(argv) {
    const o = {};
    for (let i = 0; i < argv.length; i += 2) {
        if (!/^--(from|commit|out)$/.test(argv[i]) || argv[i + 1] === undefined) {
            throw new Error(`usage: sync-kit.js --from <mgu-store clone> --commit <rev> [--out <dir>] (bad argument ${argv[i]})`);
        }
        o[argv[i].slice(2)] = argv[i + 1];
    }
    if (!o.from || !o.commit) {
        throw new Error('usage: sync-kit.js --from <mgu-store clone> --commit <rev> [--out <dir>]');
    }
    return o;
}

function sync(from, rev, out) {
    const git = (...a) => cp.execFileSync('git', ['-C', from, ...a], { maxBuffer: 64 * 1024 * 1024 });
    const commit = git('rev-parse', '--verify', `${rev}^{commit}`).toString().trim();
    for (const d of DESTS) {
        const dir = path.join(out, d.dir);
        fs.mkdirSync(dir, { recursive: true });
        for (const name of fs.readdirSync(dir)) {
            if (name !== 'SOURCE.json' && d.files.indexOf(name) < 0) {
                fs.rmSync(path.join(dir, name), { recursive: true, force: true });
            }
        }
        const files = d.files.map((name) => {
            const p = `${SRC}/${name}`;
            fs.writeFileSync(path.join(dir, name), git('show', `${commit}:${p}`));
            return { name, blob: git('rev-parse', `${commit}:${p}`).toString().trim() };
        });
        const rec = { repo: 'mgu-store', commit, path: SRC, files };
        fs.writeFileSync(path.join(dir, 'SOURCE.json'), JSON.stringify(rec, null, 2) + '\n');
    }
    return commit;
}

if (require.main === module) {
    try {
        const o = args(process.argv.slice(2));
        const commit = sync(path.resolve(o.from), o.commit, path.resolve(o.out || path.join(__dirname, '..')));
        console.log(`synced the kit from mgu-store ${commit}`);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
