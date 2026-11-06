'use strict';
// Where the vendored engine's requires go. The engine is laid out as in the apps repo (engine/shared, engine/kit/runtime,
// engine/bench); the apps repo's build lays `kit/` next to `shared/`'s files, so shared/hud.js says './kit/car'. Used by
// the Node hook (node-layout.js) and the Designer's bundler (designer/vite.config.ts), so both resolve the same way.
//   fs, net, events        -> the shims in cluster/shims (memory fs, in-memory pipe, EventEmitter)
//   ./kit/<name>           -> engine/kit/runtime/<name>.js when vendored, else shims/unavailable.js (car diagnostics)
// Everything else is left to the loader (path and zlib are Node's, or the bundler's browser equivalents).
const fs = require('node:fs');
const path = require('node:path');

const ENGINE = path.join(__dirname, '..', 'engine');
const SHIMS = path.join(__dirname, 'shims');
const BUILTIN = { fs: 'fs.js', net: 'net.js', events: 'events.js' };

/** The file a require made from `importer` goes to, or null to leave it to the loader. */
function redirect(request, importer) {
    const from = path.resolve(importer || '');
    if (from.indexOf(ENGINE + path.sep) !== 0) return null;
    if (BUILTIN[request]) return path.join(SHIMS, BUILTIN[request]);
    const kit = /^\.\/kit\/([A-Za-z0-9_-]+)(\.js)?$/.exec(request);
    if (kit) {
        const vendored = path.join(ENGINE, 'kit', 'runtime', kit[1] + '.js');
        return fs.existsSync(vendored) ? vendored : path.join(SHIMS, 'unavailable.js');
    }
    return null;
}

module.exports = { redirect, ENGINE, SHIMS };
