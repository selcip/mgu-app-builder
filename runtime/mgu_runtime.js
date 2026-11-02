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
 *   rt.set('home', 'oil', 96); // sets what an element shows; the screen redraws if shown (false + log if refused)
 *   rt.setLanguage('de');     // draws the texts in German (missing ones in the default language)
 *
 * sink.frame(recorder): a kit Recorder (kit_record.js) per frame; returns false if it could not take it
 * (the render client's frame() has this contract). log: console-like (error, warn, info).
 * readImage(path) (optional): the bytes of a PNG the screen file names by its path ('images/logo.png'), or null
 * when there is none; a missing or unreadable picture is logged and its element drawn without it.
 *
 * Values set from code (set): text (text, buttons, fields, titles), on/off (toggle, choice, a row's switch), a number
 * (slider, a row's slider, progress, metric), rows (list, appList, appGrid, sideNav: a list of objects or lines
 * of text) and pictures ('images/x.png' read through readImage, as in the screen file, or a PNG data URL or
 * 'key:<name>'). An element shows its screen-file options until set.
 *
 * Screen file: schema 1 (design, first, screens[], languages, per screen focus and nav), or a Store screen
 * file (no schema, no first: the first listed screen is the first screen). Any other schema is refused.
 */

const { createPictures } = require('./mgu_pictures.js');
const text = require('./mgu_text.js');

const SCHEMA = 1;
const DESIGN = { w: 1796, h: 632 };     // iDrive 7, embedded in the HMI page

function createRuntime(opts) {
    opts = opts || {};
    const kit = opts.kit || require('./am_gpu.js');
    const sink = opts.sink;
    const log = opts.log || console;
    let pictures = createPictures(opts.readImage, log);

    let file = null;        // the loaded screen file
    let current = null;     // the screen shown
    let values = Object.create(null);   // values set from code: screen name -> element name -> { option: value }
    let language = null;    // the language asked for (setLanguage); null: the file's default

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
        values = Object.create(null);
        pictures = createPictures(opts.readImage, log);      // a new file: read its pictures afresh
        return true;
    }

    function start() {
        if (!file) return false;
        current = file.first !== undefined ? screenNamed(file, file.first) : file.screens[0];
        return draw();
    }

    /** The language drawn: the one asked for if the file has it, else the file's default (its first). */
    function active() {
        const langs = file ? languagesOf(file) : [];
        if (language !== null && langs.indexOf(language) >= 0) return language;
        return langs.length ? langs[0] : null;
    }

    function draw() {
        const design = file.design || DESIGN;
        if (languagesOf(file).length) text.useLanguage(active());     // a Store file leaves the kit's language be
        // values set from code go over the file's options first: a text set by code is a plain string, so it is
        // drawn as set whatever the language; the file's own text maps are then resolved in the active language
        const shown = text.screenIn(withValues(current, values[current.name]), languagesOf(file), active());
        const rec = kit.record(pictures.resolve(shown), {
            textScale: 1,
            design: design,
            area: { x: 0, y: 0, w: design.w, h: design.h },     // embedded: the whole box is the app's
        });
        if (rec.errors) log.warn('mgu-runtime: ' + current.name + ': ' + rec.errors.join('; '));
        return sink.frame(rec) !== false;
    }

    /**
     * Sets what an element shows, from the app's code; the screen redraws if it is shown. Until then (and after
     * load()) the element shows its screen-file options. false (and a log line) if refused; nothing changes then.
     */
    function set(screen, element, value) {
        const s = file && screenNamed(file, screen);
        if (!s) return refuseValue(screen, element, 'there is no screen ' + JSON.stringify(screen));
        const c = elementNamed(s, element);
        if (!c) return refuseValue(screen, element, 'screen ' + JSON.stringify(screen) + ' has no element ' + JSON.stringify(element));
        const how = valueOf(c);
        if (!how) return refuseValue(screen, element, 'a ' + c.gpu + ' element has no value to set');
        if (!how[1].ok(value)) return refuseValue(screen, element, 'its value must be ' + how[1].what + ', not ' + describe(value));
        const own = values[screen] || (values[screen] = Object.create(null));
        const v = own[element] || (own[element] = {});
        v[how[0]] = how[1].to ? how[1].to(value) : value;
        if (current === s) draw();
        return true;
    }

    function refuseValue(screen, element, why) {
        log.error('mgu-runtime: value for element ' + JSON.stringify(element) + ' on screen ' + JSON.stringify(screen) + ' not set: ' + why);
        return false;
    }

    /**
     * Draws the screen file's texts in `code` from now on (the shown screen again at once); a text missing in it
     * is drawn in the default language. A code the loaded file doesn't list is refused (false, a log line): the
     * default language is drawn then.
     */
    function setLanguage(code) {
        if (file && languagesOf(file).indexOf(code) < 0) {
            log.warn('mgu-runtime: the screen file has no language ' + JSON.stringify(code) + '; drawing its default language');
            language = null;
            if (current) draw();
            return false;
        }
        language = code;
        if (current) draw();
        return true;
    }

    return { load: load, start: start, set: set, setLanguage: setLanguage, language: active };
}

/**
 * What an element's value is: the option it sets and how a value is checked (and normalised) for it. Pictures:
 * 'images/x.png' (mgu_pictures.js), 'data:image/png;base64,...' or 'key:<name>' (a picture the app gave the kit).
 */
const KINDS = {
    text: { what: 'text', ok: function (v) { return typeof v === 'string' || (typeof v === 'number' && isFinite(v)); }, to: String },
    onOff: { what: 'on or off (true or false)', ok: function (v) { return typeof v === 'boolean'; } },
    number: { what: 'a number', ok: function (v) { return typeof v === 'number' && isFinite(v); } },
    rows: { what: 'rows (a list of { badge, title, sub } or lines of text)', ok: function (v) {
        return typeof v === 'string' || (Array.isArray(v) && v.every(function (r) { return r && typeof r === 'object'; }));
    } },
    picture: { what: 'a picture (images/x.png, a PNG data URL or key:<name>)', ok: function (v) { return typeof v === 'string'; } },
};

const VALUES = {
    text: ['text', KINDS.text],
    button: ['text', KINDS.text],
    vbutton: ['text', KINDS.text],
    field: ['text', KINDS.text],
    dropdown: ['text', KINDS.text],
    qr: ['text', KINDS.text],
    titleBar: ['title', KINDS.text],
    card: ['title', KINDS.text],
    tile: ['title', KINDS.text],
    toggle: ['on', KINDS.onOff],
    choice: ['selected', KINDS.onOff],
    slider: ['value', KINDS.number],
    progress: ['value', KINDS.number],
    metric: ['value', KINDS.number],
    list: ['items', KINDS.rows],
    appList: ['items', KINDS.rows],
    appGrid: ['items', KINDS.rows],
    sideNav: ['items', KINDS.rows],
    image: ['src', KINDS.picture],
    appIcon: ['icon', KINDS.picture],
};

/** [option, kind] of an element's value, or null when its widget shows none. */
function valueOf(c) {
    if (c.gpu !== 'row') return VALUES[c.gpu] || null;
    const control = (c.opts && c.opts.control) || 'toggle';
    if (control === 'toggle') return ['on', KINDS.onOff];
    if (control === 'slider') return ['value', KINDS.number];
    return ['text', KINDS.text];       // drop-down, value, chevron and button texts
}

/** The screen as drawn: its elements' options with the values set from code over them (the file is not changed). */
function withValues(screen, set) {
    if (!set) return screen;
    const s = Object.assign({}, screen);
    s.components = (screen.components || []).map(function (c) {
        if (!set[c.name]) return c;
        return Object.assign({}, c, { opts: Object.assign({}, c.opts, set[c.name]) });
    });
    return s;
}

function describe(v) {
    if (typeof v === 'number' || typeof v === 'boolean' || v === null || v === undefined) return String(v);
    if (typeof v === 'string') return JSON.stringify(v.length > 40 ? v.slice(0, 40) + '...' : v);
    return Array.isArray(v) ? 'a list' : 'an object';
}

function elementNamed(s, name) {
    const cs = s.components || [];
    for (let i = 0; i < cs.length; i++) if (cs[i].name === name) return cs[i];
    return null;
}

function languagesOf(f) {
    return Array.isArray(f.languages) ? f.languages.filter((l) => typeof l === 'string') : [];
}

function screenNamed(f, name) {
    for (let i = 0; i < f.screens.length; i++) if (f.screens[i].name === name) return f.screens[i];
    return null;
}

module.exports = { createRuntime: createRuntime, SCHEMA: SCHEMA };
