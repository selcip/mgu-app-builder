'use strict';
/*
 * mgu_headunit.js - the runtime on the head unit: wires the platform-free core (mgu_runtime.js) to the
 * renderer through the render client (mgu_render_client.js). Node 8, CommonJS, flat module names.
 *
 *   const { RenderClient } = require('./mgu_render_client.js');
 *   const client = new RenderClient('my_app', log, { kit: require('./kit_record.js'), mode: 'embed' });
 *   const rt = runOnHeadUnit({ client, screens: fs.readFileSync(path.join(__dirname, 'screens.json'), 'utf8'), log });
 *
 * Embed only (inside the HMI page), 1796 x 632. The HMI page itself (RHMI state on LT_State_A4A_WelcomeApp,
 * its title and BACK), touch, the controller and the keep-alive frame come with later tickets; they belong
 * here, not in the core.
 */
const { createRuntime } = require('./mgu_runtime.js');

const EMBED = { x: 0, y: 0, w: 1796, h: 632 };      // the embed box when the renderer names none (file sink)

/**
 * A sink sending each recording through the render client. Embeds and places the app when the renderer is
 * ready and sends the last recording again then (a frame drawn before that, or before a reconnect, is kept).
 */
function renderSink(client) {
    let last = null;
    client.on('ready', (screen, info) => {
        const box = (info && info.embedBox) || EMBED;
        client.mode('embed');
        client.place({ x: box.x, y: box.y, w: box.w, h: box.h, scale: 1, ox: 0, oy: 0 });
        client.show(true);
        if (last) client.frame(last);
    });
    return {
        frame(rec) {
            last = rec;
            return client.frame(rec);
        },
    };
}

/**
 * One call for an app: load the screen file (parsed or JSON text), connect to the renderer and show the first
 * screen. opts: { client (a RenderClient, not yet connected), screens, log, kit? }. Returns the runtime, or null
 * if the screen file was refused (the log says why; the client is not connected then).
 */
function runOnHeadUnit(opts) {
    const rt = createRuntime({ kit: opts.kit, log: opts.log, sink: renderSink(opts.client) });
    if (!rt.load(opts.screens)) return null;
    opts.client.connect();
    rt.start();
    return rt;
}

module.exports = { runOnHeadUnit, renderSink };
