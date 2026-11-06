'use strict';
// The cluster engine for Node (tests): the host (host.js) with the baked fonts read from engine/.
require('./node-layout.js');
const fs = require('node:fs');
const path = require('node:path');
const host = require('./host.js');

const FONTS = path.join(__dirname, '..', 'engine', 'apps', 'cluster_themes', 'hud', 'fonts');
let fonts = null;

function createEngine(opts) {
    if (!fonts) {
        fonts = {};
        for (const f of fs.readdirSync(FONTS)) fonts['fonts/' + f] = fs.readFileSync(path.join(FONTS, f), 'utf8');
    }
    return host.createEngine(Object.assign({ fonts }, opts));
}

module.exports = { createEngine, checks: require('./checks.js') };
