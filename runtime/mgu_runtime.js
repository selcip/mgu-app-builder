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
 *   rt.setLanguage('de');     // draws the texts in German (missing ones in the default language)
 *
 * sink.frame(recorder): a kit Recorder (kit_record.js) per frame; returns false if it could not take it
 * (the render client's frame() has this contract). log: console-like (error, warn, info).
 * readImage(path) (optional): the bytes of a PNG the screen file names by its path ('images/logo.png'), or null
 * when there is none; a missing or unreadable picture is logged and its element drawn without it.
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
        const rec = kit.record(pictures.resolve(text.screenIn(current, languagesOf(file), active())), {
            textScale: 1,
            design: design,
            area: { x: 0, y: 0, w: design.w, h: design.h },     // embedded: the whole box is the app's
        });
        if (rec.errors) log.warn('mgu-runtime: ' + current.name + ': ' + rec.errors.join('; '));
        return sink.frame(rec) !== false;
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

    return { load: load, start: start, setLanguage: setLanguage, language: active };
}

function languagesOf(f) {
    return Array.isArray(f.languages) ? f.languages.filter((l) => typeof l === 'string') : [];
}

function screenNamed(f, name) {
    for (let i = 0; i < f.screens.length; i++) if (f.screens[i].name === name) return f.screens[i];
    return null;
}

module.exports = { createRuntime: createRuntime, SCHEMA: SCHEMA };
