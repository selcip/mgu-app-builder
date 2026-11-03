'use strict';
/*
 * mgu_headunit.js - the runtime on the head unit: wires the platform-free core (mgu_runtime.js) to the
 * renderer through the render client (mgu_render_client.js) and to the HMI's page. Node 8, CommonJS, flat module
 * names.
 *
 *   const { RenderClient } = require('./mgu_render_client.js');
 *   const client = new RenderClient('my_app', log, { kit: require('./kit_record.js'), mode: 'embed' });
 *   const rt = runOnHeadUnit({ client, page, screens: fs.readFileSync(path.join(dir, 'screens.json'), 'utf8'), dir, log });
 *
 *   rt.on('action', (a) => ...);    // taps and controller presses
 *   rt.on('screen', (s) => ...);    // a link, BACK or the app's code changed the screen: load its data
 *   rt.on('leave', (s) => ...);     // BACK on the first screen: the adapter closes the page (the app need not)
 *
 * Embed only (inside the HMI page), 1796 x 632.
 *
 * The page (opts.page; mgu_oap.js makes it from an OnlineApp's RHMI) is the app's RHMI states on the page template
 * LT_State_A4A_WelcomeApp, one per depth (page.depths of them; depth 1 is the entry state the app's tile opens), each
 * with page.proxyCount hidden focusable proxy buttons. It is an EventEmitter with:
 *   events  visible(depth, bool), focus(depth, bool)   the HMI showed or hid / focused a state
 *           proxyFocus(depth, i), proxyPress(depth, i)  the HMI's focus moved to / pressed a proxy of a state
 *           frontCcu(sample)                             a FrontCCU.statusRotaryEncoderState sample
 *           language(name)                               the HMI's display language (a CommonTypes.Language name)
 *   methods open(depth), close(depth), title(depth, text), proxies(depth, labels), leave()
 * The runtime's depth (rt.depth(): screens to go BACK through, and the keyboard screen) is mirrored on those states:
 * going deeper opens the next state, so the HMI's BACK closes it, which takes the runtime BACK to the state the HMI
 * shows (the keyboard screen is cancelled, a screen goes back); a state the HMI shows or focuses below the runtime's
 * depth (BACK, or the tile opening the app again) does the same. Deeper than page.depths, the top state stands for
 * the rest, and BACK there returns to the state below it. BACK on the first screen from the app (an element whose
 * action leads BACK, or rt.controller('back')) leaves the page (page.leave()). States are opened and closed only while
 * the page is shown, so the app's code never brings it to the front.
 *
 * The screen shows (touches claimed on the whole box, the controller grabbed where the renderer offers its gate,
 * info.controller) while a state of the page is visible, and the last frame is sent again every second while it
 * shows: the renderer hides an app silent for 3 s. Without a page (tests, or an app with its own HMI glue) it shows as
 * soon as the renderer is ready.
 *
 * The controller: the gate's samples (render client 'ccu') when the renderer has the gate; otherwise the HMI's focus on
 * the proxies (the highlight follows it, a press selects), or FrontCCU samples while the page has the HMI's focus,
 * until the HMI reports a proxy press itself (an HMI that routes the proxies drives the page; FrontCCU then stands down).
 */
const fs = require('fs');
const path = require('path');
const { createRuntime } = require('./mgu_runtime.js');

const EMBED = { x: 0, y: 0, w: 1796, h: 632 };      // the embed box when the renderer names none (file sink)
const DIAL_MAX_STEP = 24;       // a bigger jump of the controller's counter is a stale or garbage sample (Store)
const NO_KNOB = 0xffff;         // the counter's "no reading"
const KEEPALIVE_MS = 1000;      // the renderer hides an app silent for 3 s
const PUSHED = ['DREHGEBER_KURZ_GEDRUECKT', 'DREHGEBER_LANG_GEDRUECKT', 1, 2];     // FrontCCU push values (Store)
const RELEASED = ['KEINE_BETAETIGUNG', 0];

/**
 * The HMI's display languages (CommonTypes.Language names) as language codes, most specific first: a screen file's
 * language is picked by the first code it lists, so 'en-GB' falls back to 'en'.
 */
const HMI_LANGUAGES = {
    DEUTSCH: ['de'], ENGLISCH__UK: ['en-GB', 'en'], ENGLISCH__US: ['en-US', 'en'], ENGLISCH__AUS: ['en-AU', 'en'],
    ENGLISCH__INDIEN: ['en-IN', 'en'], FRANZOESISCH: ['fr'], FRANZOESISCH__KANADA: ['fr-CA', 'fr'], ITALIENISCH: ['it'],
    SPANISCH: ['es'], SPANISCH__MEXIKO: ['es-MX', 'es'], PORTUGIESISCH: ['pt'], PORTUGIESISCH__BRASILIEN: ['pt-BR', 'pt'],
    NIEDERLAENDISCH: ['nl'], SCHWEDISCH: ['sv'], DAENISCH: ['da'], NORWEGISCH: ['nb', 'no'], FINNISCH: ['fi'],
    POLNISCH: ['pl'], TSCHECHISCH: ['cs'], SLOWAKISCH: ['sk'], UNGARISCH: ['hu'], RUSSISCH: ['ru'], TUERKISCH: ['tr'],
    GRIECHISCH: ['el'], RUMAENISCH: ['ro'], SLOWENISCH: ['sl'], KROATISCH: ['hr'], UKRAINISCH: ['uk'],
    JAPANISCH: ['ja'], KOREANISCH: ['ko'], CHINESISCH_SIMPLE: ['zh-CN', 'zh'], CHINESISCH_TRAD: ['zh-TW', 'zh'],
    ARABISCH: ['ar'], HEBRAEISCH: ['he'], THAI: ['th'],
};

/** The codes to try for an HMI display language, most specific first ([] for one this table doesn't know). */
function languageCodes(name) {
    return typeof name === 'string' && Object.prototype.hasOwnProperty.call(HMI_LANGUAGES, name) ? HMI_LANGUAGES[name] : [];
}

/**
 * Feeds controller samples (a 16-bit detent counter and a push state, as the Store reads them) to `dial(steps)` and
 * `press()`. sample(knob, pressed, seq): a push is a press going down (the gate's samples: with a new sequence number);
 * with `repeat` (FrontCCU's), a new sequence number while pressed is a new push too.
 */
function dialOf(dial, press, repeat) {
    let last = null;
    return function (knob, pressed, seq) {
        const was = last;
        last = { knob: knob, pressed: pressed, seq: seq };
        if (!was) return;
        const steps = ((knob - was.knob + 0x18000) % 0x10000) - 0x8000;
        if (knob !== NO_KNOB && was.knob !== NO_KNOB && steps !== 0 && Math.abs(steps) <= DIAL_MAX_STEP) dial(steps);
        if (!pressed) return;
        if (repeat ? (!was.pressed || (seq !== undefined && seq !== was.seq)) : (!was.pressed && seq !== was.seq)) press();
    };
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
 * screen. opts: { client (a RenderClient, not yet connected), page (the HMI's page, above; optional), screens, dir (the
 * folder screens.json and its images/ are in), log, kit? }. Returns the runtime, or null if the screen file was refused
 * (the log says why; the client is not connected then).
 */
function runOnHeadUnit(opts) {
    const client = opts.client;
    const page = opts.page || null;
    const log = opts.log || console;
    let info = null;            // the renderer's offer while it is ready (null: a file sink or not yet)
    let ready = false;
    let box = EMBED;
    let shown = false;
    let last = null;            // the last recording, sent again on show, after a reconnect and as the keepalive
    let sentAt = 0;
    let keepalive = null;
    const visible = {};         // depth -> the HMI shows that state
    let focusLost = false;      // the top state lost the HMI's focus (a popup over it)
    let opened = 1;             // the page states the app holds open: 1..opened (1 is the HMI's entry state)
    let titles = {};            // depth -> title written
    let labels = {};            // depth -> proxy labels written (joined)
    let hmiProxies = false;     // the HMI reported a proxy press: it drives the page, FrontCCU stands down

    const rt = createRuntime({
        kit: opts.kit, log: log,
        sink: { frame: (rec) => { last = rec; const ok = send(rec); mirror(); return ok; } },
        readImage: opts.dir ? imageReader(opts.dir) : undefined,
    });
    if (!rt.load(opts.screens)) return null;

    function send(rec) {
        if (!ready) return false;
        sentAt = Date.now();
        return client.frame(rec) !== false;
    }

    function anyVisible() {
        return Object.keys(visible).some((d) => visible[d]);
    }

    function update() {
        const want = ready && (!page || anyVisible());
        if (want === shown) return;
        shown = want;
        client.claim(shown ? [{ x: 0, y: 0, w: box.w, h: box.h }] : []);       // touches anywhere on the app's screen
        if (info && info.controller) client.grab(shown);
        if (shown && last) send(last);
        client.show(shown);
        clearInterval(keepalive);
        keepalive = shown ? setInterval(() => {
            if (last && Date.now() - sentAt >= KEEPALIVE_MS) send(last);
        }, KEEPALIVE_MS) : null;
        if (keepalive && keepalive.unref) keepalive.unref();       // the render client's socket keeps the app running
        if (shown) mirror();
    }

    /** Mirrors the runtime's depth, title and focus items on the page's states (while the page shows). */
    function mirror() {
        if (!page || !shown) return;
        const want = Math.max(1, Math.min(rt.depth(), page.depths));
        while (opened < want) page.open(++opened);
        while (opened > want) { page.close(opened); delete titles[opened]; delete labels[opened]; opened--; }
        const t = rt.title();
        if (titles[opened] !== t) { titles[opened] = t; page.title(opened, t); }
        const items = rt.focusItems().slice(0, page.proxyCount);
        if (labels[opened] !== items.join('\n')) { labels[opened] = items.join('\n'); page.proxies(opened, items); }
    }

    /** The HMI shows the state at `depth` on top: the runtime goes BACK to it. */
    function backTo(depth) {
        let guard = 64;
        while (rt.depth() > depth && opened >= depth && guard--) {
            const before = rt.depth();
            rt.controller('back');
            if (rt.depth() === before) break;       // BACK on the first screen: nothing to return to
        }
    }

    function input(fn) {
        return function () {
            if (!shown) return;
            fn.apply(null, arguments);
        };
    }

    client.on('ready', (screen, i) => {
        info = i || null;
        box = (info && info.embedBox) || EMBED;
        client.mode('embed');
        client.place({ x: box.x, y: box.y, w: box.w, h: box.h, scale: 1, ox: 0, oy: 0 });
        ready = true;
        shown = false;          // a new connection: claim and show again
        update();
        if (!shown && last) send(last);
    });
    client.on('close', () => {
        ready = false;
        info = null;
        shown = false;
        clearInterval(keepalive);
        keepalive = null;
    });
    client.on('touch', (phase, x, y) => rt.touch(phase, x, y));
    const gate = dialOf((n) => rt.controller(n > 0 ? 'right' : 'left', Math.abs(n)), () => rt.controller('press'));
    client.on('ccu', (e) => gate(e.knob, !!e.press, e.seq));

    if (page) {
        let fccu = { knob: NO_KNOB, pressed: false, seq: undefined };
        const front = dialOf(input((n) => rt.controller(n > 0 ? 'right' : 'left', Math.abs(n))), input(() => rt.controller('press')), true);
        page.on('visible', (depth, on) => {
            visible[depth] = !!on;
            update();
            if (on && shown) { focusLost = false; backTo(depth); }
        });
        page.on('focus', (depth, on) => {
            if (on && shown) backTo(depth);
            if (depth === opened) focusLost = !on;
        });
        page.on('proxyFocus', (depth, i) => {
            if (depth === opened && shown) rt.highlight(i);
        });
        page.on('proxyPress', (depth, i) => {
            hmiProxies = true;
            if (depth !== opened || !shown) return;
            if (rt.highlight(i)) rt.controller('press');
        });
        page.on('frontCcu', (s) => {
            const op = s && s.frontRotaryEncoderOperation;
            const push = s && s.frontRotaryEncoderPushButton;
            const was = fccu;
            fccu = {
                knob: typeof op === 'number' && op !== NO_KNOB ? op : was.knob,
                pressed: PUSHED.indexOf(push) >= 0 ? true : RELEASED.indexOf(push) >= 0 ? false : was.pressed,
                seq: s && s.frontSequenceNumberOperatingElement,
            };
            if (info && info.controller) return;        // the gate's samples carry the controller
            if (hmiProxies || focusLost) { front(NO_KNOB, false, fccu.seq); return; }
            front(fccu.knob, fccu.pressed, fccu.seq);
        });
        page.on('language', (name) => {
            const codes = languageCodes(name);
            const langs = rt.languages();
            for (let i = 0; i < codes.length; i++) {
                if (langs.indexOf(codes[i]) >= 0) { rt.setLanguage(codes[i]); return; }
            }
            if (langs.length) rt.setLanguage(langs[0]);
        });
    }
    rt.on('leave', () => {
        if (page && shown) page.leave();
    });

    client.connect();
    rt.start();
    return rt;
}

module.exports = { runOnHeadUnit, imageReader, languageCodes, KEEPALIVE_MS };
