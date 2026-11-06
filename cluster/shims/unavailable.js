'use strict';
// Stands in for the kit modules the engine only loads for the car's own diagnostics (kit/diag.js, kit/dids.js, for the
// engine-unit boost). The Designer's app config has no "dme", so the engine never gets here; if it did, it logs
// "engine unit boost off" and goes on, as it does on a car without the link.
throw new Error('not available in the Designer (car diagnostics)');
