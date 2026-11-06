'use strict';
/**
 * The Layer budget of a cluster layout, read from the vendored engine's own packing plan (ADR 0005): what the engine asked
 * cluster-render for (hud._layerRefs, one entry per layer it made, refused or not), the stand-in's view of what is drawn
 * (the scene) and the engine's pixel memory. Plain CommonJS so Node's tests and the Designer's bundle use this very file.
 *
 *   const b = budgetOf(engine);   // any engine from createEngine; the limits are the car's, whatever cap the engine's stand-in has
 *   b.connections   // [{ conn: 0, layers: 8, limit: 8, over: false }, ...]  conn is 0-based, as the widget's "conn" field
 *   b.layers        // { count, limit: 32, over }   layers in all
 *   b.pixels        // { bytes, limit: 16 MiB, over }   image layers and glyph atlases, each image counted twice
 *   b.effects, b.sheets, b.waiting   // 3 and 5 for GT3; layers the stand-in holds back over the per-connection cap
 *   b.over          // sentences naming the limit that is passed; empty when everything fits
 */
const CAR = { perConnection: 8, total: 32, pixelBytes: 16 * 1048576 };

const mib = (b) => (b / 1048576).toFixed(1) + ' MiB';

function budgetOf(engine) {
    const hud = engine.hud;
    const refs = typeof hud._layerRefs === 'function' && !hud.problem ? hud._layerRefs() : [];
    const scene = engine.scene().filter((l) => l.kind !== 'asset');
    const per = [];
    refs.forEach((r) => { per[r.ci] = (per[r.ci] || 0) + 1; });
    const connections = [];
    for (let i = 0; i < per.length; i++) {
        const layers = per[i] || 0;
        connections.push({ conn: i, layers, limit: CAR.perConnection, over: layers > CAR.perConnection });
    }
    const count = refs.length;
    const bytes = hud.problem ? 0 : hud.pixelBytes || 0;
    const layers = { count, limit: CAR.total, over: count > CAR.total };
    const pixels = { bytes, limit: CAR.pixelBytes, over: bytes > CAR.pixelBytes };
    const over = [];
    connections.forEach((c) => {
        if (c.over) over.push('Connection ' + (c.conn + 1) + ' has ' + c.layers + ' layers; the limit is ' + c.limit + ' on each connection.');
    });
    if (layers.over) over.push('The layout has ' + count + ' layers in all; the limit is ' + CAR.total + '.');
    if (pixels.over) over.push('The layout needs ' + mib(bytes) + ' of pixel memory; the limit is ' + mib(CAR.pixelBytes) + ', with each image counted twice.');
    return {
        connections, layers, pixels, over,
        effects: scene.filter((l) => l.kind === 'effect').length,
        sheets: scene.filter((l) => l.kind === 'image').length,
        // layers past a connection's limit (the car draws only the first 8): worked out from the plan, so it reads the same
        // from an engine whose stand-in has no cap (the canvas's) as from one that holds them back
        waiting: connections.reduce((n, c) => n + Math.max(0, c.layers - c.limit), 0),
    };
}

module.exports = { budgetOf, CAR, mib };
