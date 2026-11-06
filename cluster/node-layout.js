'use strict';
// Makes Node resolve the vendored engine's requires as the Designer's bundle does (cluster/resolve.js). Requiring this
// file first is all a test needs, as with test/flat-layout.js for the runtime.
const Module = require('node:module');
const { redirect } = require('./resolve.js');

if (!Module.__clusterEngineLayout) {
    Module.__clusterEngineLayout = true;
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (request, parent, ...rest) {
        const to = parent && parent.filename ? redirect(request, parent.filename) : null;
        return resolve.call(this, to || request, parent, ...rest);
    };
}
