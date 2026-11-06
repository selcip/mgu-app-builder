'use strict';
// A memory `fs` for the vendored engine, in Node's tests and in the browser. The engine reads two things from disk:
// the app's data folder `hud/` (baked fonts; shared/hud_data.js via kit/pack.js) and, from the data folder it is given,
// layouts/<name>.json (shared/layouts.js), which it also watches. The host (cluster/host.js) fills this in.
// Paths are normalised: backslashes become '/', and anything under `.../shared/hud/` is one place wherever the
// engine's files are (Node's real __dirname, the browser bundle's defined one).
const files = new Map();      // normalised path -> string | Buffer
const watchers = new Map();   // normalised dir -> Set of callbacks

function norm(p) {
    let s = String(p).split(String.fromCharCode(92)).join('/').replace(/[/]+/g, '/');
    const i = s.lastIndexOf('/shared/hud/');
    if (i >= 0) s = s.slice(i + 1);
    return s.replace(/[/]$/, '');
}
function enoent(p, op) {
    const e = new Error(`ENOENT: no such file or directory, ${op} '${p}'`);
    e.code = 'ENOENT';
    return e;
}

const fs = {
    existsSync: (p) => files.has(norm(p)),
    readFileSync(p, enc) {
        const v = files.get(norm(p));
        if (v === undefined) throw enoent(p, 'open');
        if (typeof v === 'string') return enc ? v : Buffer.from(v, 'utf8');
        return enc ? v.toString(typeof enc === 'string' ? enc : enc.encoding) : v;
    },
    mkdirSync() {},                          // folders need not exist here
    watch(dir, opts, cb) {
        const cbk = typeof opts === 'function' ? opts : cb;
        const k = norm(dir);
        if (!watchers.has(k)) watchers.set(k, new Set());
        watchers.get(k).add(cbk);
        return { close() { watchers.get(k).delete(cbk); } };
    },
    /** The host's side: put a file in, take one out, tell the watchers of a folder, forget a folder. */
    host: {
        write(p, v) { files.set(norm(p), v); },
        remove(p) { files.delete(norm(p)); },
        has: (p) => files.has(norm(p)),
        notify(dir) { (watchers.get(norm(dir)) || new Set()).forEach((cb) => cb('change', '')); },
        removeTree(dir) {
            const k = norm(dir) + '/';
            Array.from(files.keys()).forEach((f) => { if (f.indexOf(k) === 0) files.delete(f); });
            Array.from(watchers.keys()).forEach((w) => { if (w + '/' === k || w.indexOf(k) === 0) watchers.delete(w); });
        },
    },
};
module.exports = fs;
