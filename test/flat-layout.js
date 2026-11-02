'use strict';
// The flat app layout for Node's tests. On the head unit the OAP linker lays the runtime and the kit out side by
// side, so the runtime requires kit modules by basename ('./i18n.js'); the Designer's bundle resolves them the same
// way (designer/vite.config.ts: runtime first, then kit). Requiring this file makes Node do so too: a './x.js'
// required from runtime/ that isn't there is taken from kit/.
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNTIME = path.join(ROOT, 'runtime') + path.sep;
const KIT = path.join(ROOT, 'kit');

if (!Module.__mguFlatLayout) {
    Module.__mguFlatLayout = true;
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (request, parent, ...rest) {
        if (parent && parent.filename && parent.filename.startsWith(RUNTIME) && /^\.\/[^/]+\.js$/.test(request)
            && !fs.existsSync(path.join(RUNTIME, request))) {
            return resolve.call(this, path.join(KIT, request), parent, ...rest);
        }
        return resolve.call(this, request, parent, ...rest);
    };
}
