'use strict';
/*
 * mgu_headunit.js - the runtime on the head unit: wires the platform-free core (mgu_runtime.js) to the
 * renderer through the render client (mgu_render_client.js). Node 8, CommonJS, flat module names.
 *
 *   const { RenderClient } = require('./mgu_render_client.js');
 *   const client = new RenderClient('my_app', log, { kit: require('./kit_record.js'), mode: 'embed' });
 *   const rt = runOnHeadUnit({ client, screens: fs.readFileSync(path.join(__dirname, 'screens.json'), 'utf8'), dir: __dirname, log });
 *
 *   rt.on('action', (a) => ...);    // taps and controller presses
 *
 * Embed only (inside the HMI page), 1796 x 632. Input as far as the render client carries it: touches on the app's
 * screen (claimed when the renderer is ready) and, where the renderer offers the controller gate (info.controller),
 * the iDrive controller's turns and pushes (grabbed). The HMI page itself (RHMI state on LT_State_A4A_WelcomeApp,
 * its title and BACK), the controller through FrontCCU or RHMI focus proxies when there is no gate, and the
 * keep-alive frame come with later tickets; they belong here, not in the core.
 */
const fs = require('fs');
const path = require('path');
const { createRuntime } = require('./mgu_runtime.js');

const EMBED = { x: 0, y: 0, w: 1796, h: 632 };      // the embed box when the renderer names none (file sink)
const DIAL_MAX_STEP = 24;       // a bigger jump of the controller's counter is a stale or garbage sample (Store)
const NO_KNOB = 0xffff;         // the counter's "no reading"

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
        client.claim([{ x: 0, y: 0, w: box.w, h: box.h }]);        // touches anywhere on the app's screen
        if (info && info.controller) client.grab(true);
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
 * Feeds the render client's input to the runtime: touch points as they are, controller samples (a 16-bit detent
 * counter and a push state, as the Store reads them) as left/right steps and presses.
 */
function feedInput(client, rt) {
    client.on('touch', (phase, x, y) => rt.touch(phase, x, y));
    let last = null;
    client.on('ccu', (e) => {
        const was = last;
        last = e;
        if (!was) return;
        const steps = ((e.knob - was.knob + 0x18000) % 0x10000) - 0x8000;
        if (e.knob !== NO_KNOB && was.knob !== NO_KNOB && steps !== 0 && Math.abs(steps) <= DIAL_MAX_STEP) {
            rt.controller(steps > 0 ? 'right' : 'left', Math.abs(steps));
        }
        if (e.press && e.press !== was.press && e.seq !== was.seq) rt.controller('press');
    });
}

/**
 * Reads the pictures a screen file names ('images/logo.png') from the folder the screen file is in. Only paths
 * under images/ are read; null when the file isn't there.
 */
function imageReader(dir) {
    return (p) => {
        const full = path.join(dir, p);
        if (path.relative(path.join(dir, 'images'), full).split(path.sep)[0] === '..') return null;
        try { return fs.readFileSync(full); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    };
}

/**
 * One call for an app: load the screen file (parsed or JSON text), connect to the renderer and show the first
 * screen. opts: { client (a RenderClient, not yet connected), screens, dir (the folder screens.json and its images/
 * are in), log, kit? }. Returns the runtime, or null if the screen file was refused (the log says why; the client
 * is not connected then).
 */
function runOnHeadUnit(opts) {
    const rt = createRuntime({
        kit: opts.kit, log: opts.log, sink: renderSink(opts.client),
        readImage: opts.dir ? imageReader(opts.dir) : undefined,
    });
    if (!rt.load(opts.screens)) return null;
    feedInput(opts.client, rt);
    opts.client.connect();
    rt.start();
    return rt;
}

module.exports = { runOnHeadUnit, renderSink, imageReader };
