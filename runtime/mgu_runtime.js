'use strict';
/*
 * mgu_runtime.js - the runtime's core: a screen file in, the kit's recordings out to a sink, input in.
 * Platform-free (no fs, net or RHMI): the head unit wires it to the render client in mgu_headunit.js,
 * the Designer's preview to a canvas. Node 8, CommonJS; requires only the kit, by the basename the
 * OAP linker resolves (modules are linked flat: './am_gpu.js').
 *
 *   const rt = createRuntime({ sink, log, kit });
 *   rt.load(screenFile);      // parsed object or JSON text; false (and a log line) if refused
 *   rt.start();               // shows the first screen: one recording to sink.frame(recorder)
 *   rt.on('action', fn);      // fn({ screen, element, action }) when the driver selects an element
 *   rt.controller(input, n);  // 'left' | 'right' (move the highlight n steps, default 1), 'press' (select the
 *                             // highlighted element), 'back'
 *   rt.touch(phase, x, y);    // 'down' | 'move' | 'up', in screen px: down and up on one element selects it
 *
 * sink.frame(recorder): a kit Recorder (kit_record.js) per frame; returns false if it could not take it
 * (the render client's frame() has this contract). log: console-like (error, warn, info).
 *
 * Screen file: schema 1 (design, first, screens[], languages, per screen focus and nav), or a Store screen
 * file (no schema, no first: the first listed screen is the first screen). Any other schema is refused.
 *
 * Focus and actions (mgu_focus.js): the highlight moves in the screen's focus order and is drawn by the runtime as a
 * ring on top of the kit's recording; a press or a tap reports the element's action.
 */
const focus = require('./mgu_focus.js');

const SCHEMA = 1;
const DESIGN = { w: 1796, h: 632 };     // iDrive 7, embedded in the HMI page

function createRuntime(opts) {
    opts = opts || {};
    const kit = opts.kit || require('./am_gpu.js');
    const sink = opts.sink;
    const log = opts.log || console;

    let file = null;        // the loaded screen file
    let current = null;     // the screen shown
    let items = [];         // its elements in focus order
    let focused = 0;        // index into items
    let touched = null;     // the element a touch went down on
    const listeners = { action: [] };

    function refuse(why) {
        log.error('mgu-runtime: screen file refused: ' + why);
        file = null;
        current = null;
        return false;
    }

    function load(src) {
        let f = src;
        if (typeof src === 'string') {
            try { f = JSON.parse(src); } catch (e) { return refuse('not JSON (' + e.message + ')'); }
        }
        if (!f || typeof f !== 'object' || !Array.isArray(f.screens)) return refuse('no screens');
        if (f.schema !== undefined && f.schema !== SCHEMA) {
            return refuse('unknown schema ' + JSON.stringify(f.schema) + ' (this runtime reads schema ' + SCHEMA + ')');
        }
        if (!f.screens.length) return refuse('no screens');
        if (f.first !== undefined && !screenNamed(f, f.first)) {
            return refuse('first screen ' + JSON.stringify(f.first) + ' is not in the file');
        }
        file = f;
        current = null;
        return true;
    }

    function start() {
        if (!file) return false;
        show(file.first !== undefined ? screenNamed(file, file.first) : file.screens[0]);
        return draw();
    }

    function show(screen) {
        current = screen;
        items = focus.focusOrder(screen);
        focused = 0;
        touched = null;
    }

    function on(event, fn) {
        if (!listeners[event]) throw new Error('mgu-runtime: no event ' + JSON.stringify(event));
        listeners[event].push(fn);
    }

    function emit(event, value) {
        listeners[event].slice().forEach((fn) => {
            try { fn(value); } catch (e) { log.error('mgu-runtime: ' + event + ' listener threw: ' + (e && e.stack || e)); }
        });
    }

    function select(c) {
        emit('action', { screen: current.name, element: c.name, action: focus.actionOf(c) });
    }

    /** Controller input: 'left' / 'right' move the highlight `steps` elements (default 1; stops at the ends, no
     * wrap), 'press' selects, 'back' (not yet handled). */
    function controller(input, steps) {
        if (!current) return;
        if (input === 'left' || input === 'right') {
            const n = typeof steps === 'number' && steps > 0 ? Math.floor(steps) : 1;
            const to = Math.max(0, Math.min(items.length - 1, focused + (input === 'left' ? -n : n)));
            if (to === focused || !items.length) return;
            focused = to;
            draw();
        } else if (input === 'press') {
            if (items[focused]) select(items[focused]);
        } else if (input !== 'back') {
            log.warn('mgu-runtime: unknown controller input ' + JSON.stringify(input));
        }
    }

    /** A touch point in screen px: an element in the focus order that the touch goes down and up on is selected
     * (and highlighted). */
    function touch(phase, x, y) {
        if (!current) return;
        const c = focus.hit(current, items, x, y);
        if (phase === 'down') touched = c;
        else if (phase === 'up') {
            const was = touched;
            touched = null;
            if (!c || c !== was) return;
            const i = items.indexOf(c);
            if (i !== focused) { focused = i; draw(); }
            select(c);
        }
    }

    function draw() {
        const design = file.design || DESIGN;
        const rec = kit.record(current, {
            textScale: 1,
            design: design,
            area: { x: 0, y: 0, w: design.w, h: design.h },     // embedded: the whole box is the app's
        });
        if (rec.errors) log.warn('mgu-runtime: ' + current.name + ': ' + rec.errors.join('; '));
        if (items[focused]) focus.drawRing(rec, items[focused]);
        return sink.frame(rec) !== false;
    }

    return { load: load, start: start, on: on, controller: controller, touch: touch };
}

function screenNamed(f, name) {
    for (let i = 0; i < f.screens.length; i++) if (f.screens[i].name === name) return f.screens[i];
    return null;
}

module.exports = { createRuntime: createRuntime, SCHEMA: SCHEMA };
