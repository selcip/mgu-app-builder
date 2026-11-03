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
 *   rt.start('settings');     // ... or starts on another screen (nothing to go BACK to from it)
 *   rt.open('details');       // opens a screen from the app's code, as a link would (false + log if there is none)
 *   rt.screen();              // the name of the screen shown (null before start)
 *   rt.set('home', 'oil', 96); // sets what an element shows; the screen redraws if shown (false + log if refused)
 *   rt.setLanguage('de');     // draws the texts in German (missing ones in the default language)
 *   rt.languages();           // the screen file's languages, the default first ([] for a file without)
 *   rt.on('action', fn);      // fn({ screen, element, action }) when the driver selects an element;
 *                             // fn({ screen, element, action, value }) when the driver types a field's text
 *   rt.on('screen', fn);      // fn({ screen, from, by }) whenever the shown screen changes: by 'start' (from null),
 *                             // 'link' (a nav link), 'back' or 'open' (the app's code)
 *   rt.on('leave', fn);       // fn({ screen }) on BACK from the first screen: the driver leaves the app (the app or
 *                             // the head-unit adapter closes its HMI page; the runtime stays on that screen)
 *   rt.controller(input, n);  // 'left' | 'right' (move the highlight n steps, default 1), 'press' (select the
 *                             // highlighted element), 'back'
 *   rt.touch(phase, x, y);    // 'down' | 'move' | 'up', in screen px: down and up on one element selects it
 *
 * For the head-unit adapter (mgu_headunit.js), which mirrors the screens on the HMI's page states:
 *   rt.depth();               // how deep the driver is: 1 on the first screen, +1 per screen to go BACK through and
 *                             // +1 while the keyboard screen is open (BACK closes one level)
 *   rt.title();               // the shown screen's title in the active language ('' without one)
 *   rt.focusItems();          // what the highlight moves over now, in focus order: element names (keys on the keyboard)
 *   rt.highlight(i);          // highlights item i of focusItems() (false if there is none)
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
 *
 * Focus and actions (mgu_focus.js): the highlight moves in the screen's focus order and is drawn by the runtime as a
 * ring on top of the kit's recording; a press or a tap reports the element's action.
 *
 * Navigation: a screen's `nav` maps an action to the name of the screen it opens. Selecting an element reports its
 * action first, then opens the linked screen (unless an action handler opened a screen itself); a link to a screen
 * that is not in the file is logged and goes nowhere. The runtime keeps the screens the driver came through: BACK
 * returns to the previous one with the highlight where it was. Opening a screen the driver came through (by a link or
 * from code) returns to it rather than stacking it again; opening the shown screen changes nothing.
 *
 * Text entry (mgu_keyboard.js): selecting a field opens the keyboard screen over the shown screen with the field's
 * text. It takes the controller and touch while open (BACK cancels); confirming returns to the field, which shows
 * the typed text from then on, and reports it as the field's action value (then follows the action's link, if any);
 * cancelling returns and reports nothing. Opening another screen closes it unconfirmed.
 * The keyboard screen is the runtime's, not a screen of the file: it reports no screen change.
 */

const { createPictures } = require('./mgu_pictures.js');
const text = require('./mgu_text.js');
const focus = require('./mgu_focus.js');
const keyboard = require('./mgu_keyboard.js');

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
    let items = [];         // the shown screen's elements in focus order
    let focused = 0;        // index into items
    let touched = null;     // the element a touch went down on
    // the keyboard screen, open over `current` while the driver types a field's text: { field, k, items, focused }
    let typing = null;
    let stack = [];         // the screens the driver came through to `current`: [{ screen, focused }], oldest first
    const listeners = { action: [], screen: [], leave: [] };

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
        typing = null;
        stack = [];
        values = Object.create(null);
        pictures = createPictures(opts.readImage, log);      // a new file: read its pictures afresh
        return true;
    }

    /** Shows the first screen (or the screen named `name`) with no screen to go BACK to, and reports it. */
    function start(name) {
        if (!file) return false;
        let s = file.first !== undefined ? screenNamed(file, file.first) : file.screens[0];
        if (name !== undefined) {
            s = screenNamed(file, name);
            if (!s) return refuseOpen(name);
        }
        stack = [];
        show(s);
        const ok = draw();
        emit('screen', { screen: s.name, from: null, by: 'start' });
        return ok;
    }

    /** Opens the screen named `name` from the app's code, as a link would; false (and a log line) if refused. */
    function open(name) {
        if (!current) {
            log.error('mgu-runtime: screen ' + JSON.stringify(name) + ' not opened: start() first');
            return false;
        }
        const s = screenNamed(file, name);
        if (!s) return refuseOpen(name);
        go(s, 'open');
        return true;
    }

    function refuseOpen(name) {
        log.error('mgu-runtime: screen not opened: the screen file has no screen ' + JSON.stringify(name));
        return false;
    }

    /** The language drawn: the one asked for if the file has it, else the file's default (its first). */
    function active() {
        const langs = file ? languagesOf(file) : [];
        if (language !== null && langs.indexOf(language) >= 0) return language;
        return langs.length ? langs[0] : null;
    }

    function show(screen) {
        current = screen;
        items = focus.focusOrder(screen);
        focused = 0;
        touched = null;
        typing = null;
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
        if (c.gpu === 'field') return openKeyboard(c);
        report(c);
    }

    /** Reports the element's action (with the typed text as its value, if any), then follows the action's link. */
    function report(c, value) {
        const from = current;
        const action = focus.actionOf(c);
        const a = { screen: from.name, element: c.name, action: action };
        if (arguments.length > 1) a.value = value;
        emit('action', a);
        if (current !== from) return;       // the app's code opened a screen itself
        const to = from.nav && typeof from.nav === 'object' && Object.prototype.hasOwnProperty.call(from.nav, action) ? from.nav[action] : undefined;
        if (to === undefined) return;
        const s = typeof to === 'string' ? screenNamed(file, to) : null;
        if (!s) {
            log.warn('mgu-runtime: ' + from.name + ': action ' + JSON.stringify(action) + ' links to ' + JSON.stringify(to) + ', which is not a screen of the file');
            return;
        }
        go(s, 'link');
    }

    /** BACK: the previous screen, highlight where it was; on the first screen the driver leaves the app. */
    function back() {
        const from = current;
        if (!stack.length) {
            emit('leave', { screen: from.name });
            return;
        }
        const was = stack.pop();
        show(was.screen);
        focused = Math.min(was.focused, Math.max(0, items.length - 1));
        draw();
        emit('screen', { screen: current.name, from: from.name, by: 'back' });
    }

    /**
     * Opens screen `s` on top of the shown one (BACK returns to the shown one), and reports the change. A screen the
     * driver came through is returned to instead (the screens above it are dropped, its highlight is where it was),
     * so going round in circles never grows the stack; the shown screen itself changes nothing.
     */
    function go(s, by) {
        const from = current;
        if (s === from) return;
        let k = stack.length - 1;
        while (k >= 0 && stack[k].screen !== s) k--;
        if (k >= 0) {
            const was = stack[k];
            stack = stack.slice(0, k);
            show(s);
            focused = Math.min(was.focused, Math.max(0, items.length - 1));
        } else {
            stack.push({ screen: from, focused: focused });
            show(s);
        }
        draw();
        emit('screen', { screen: s.name, from: from.name, by: by });
    }

    /** The screen as drawn now: values set from code over its options, text maps in the active language. */
    function shownScreen() {
        return text.screenIn(withValues(current, values[current.name]), languagesOf(file), active());
    }

    /** Opens the keyboard screen over the shown screen with the field's text as drawn now. */
    function openKeyboard(c) {
        const drawn = elementNamed(shownScreen(), c.name);
        const k = keyboard.open(drawn && drawn.opts ? drawn.opts.text : '');
        typing = { field: c, k: k, items: keyboard.itemsOf(k, designOf()), focused: 0, touched: null };
        draw();
    }

    /** Closes the keyboard screen: with the typed text (confirm) or null (cancel); back on the field's screen. */
    function closeKeyboard(typed) {
        const c = typing.field;
        typing = null;
        if (typed === null) { draw(); return; }
        const own = values[current.name] || (values[current.name] = Object.create(null));
        own[c.name] = Object.assign({}, own[c.name], { text: typed });     // the field shows what was typed
        draw();
        report(c, typed);
    }

    function pressKey(item) {
        const done = keyboard.press(typing.k, item);
        if (done === 'confirm') return closeKeyboard(typing.k.text);
        if (done === 'cancel') return closeKeyboard(null);
        typing.items = keyboard.itemsOf(typing.k, designOf());     // Shift and the symbols page change what keys type
        draw();
    }

    function keyboardController(input, steps) {
        const t = typing;
        if (input === 'left' || input === 'right') {
            const to = Math.max(0, Math.min(t.items.length - 1, t.focused + (input === 'left' ? -steps : steps)));
            if (to === t.focused) return;
            t.focused = to;
            draw();
        } else if (input === 'press') pressKey(t.items[t.focused]);
        else if (input === 'back') closeKeyboard(null);
        else log.warn('mgu-runtime: unknown controller input ' + JSON.stringify(input));
    }

    function keyboardTouch(phase, x, y) {
        const t = typing;
        const it = keyboard.hit(t.items, x, y);
        if (phase === 'down') t.touched = it;
        else if (phase === 'up') {
            const was = t.touched;
            t.touched = null;
            if (!it || it !== was) return;
            t.focused = t.items.indexOf(it);
            pressKey(it);
        }
    }

    /** Controller input: 'left' / 'right' move the highlight `steps` elements (default 1; stops at the ends, no
     * wrap), 'press' selects, 'back' (on the keyboard screen: cancel; elsewhere the previous screen, or leave). */
    function controller(input, steps) {
        if (!current) return;
        if (typing) return keyboardController(input, typeof steps === 'number' && steps > 0 ? Math.floor(steps) : 1);
        if (input === 'left' || input === 'right') {
            const n = typeof steps === 'number' && steps > 0 ? Math.floor(steps) : 1;
            const to = Math.max(0, Math.min(items.length - 1, focused + (input === 'left' ? -n : n)));
            if (to === focused || !items.length) return;
            focused = to;
            draw();
        } else if (input === 'press') {
            if (items[focused]) select(items[focused]);
        } else if (input === 'back') {
            back();
        } else {
            log.warn('mgu-runtime: unknown controller input ' + JSON.stringify(input));
        }
    }

    /** A touch point in screen px: an element in the focus order that the touch goes down and up on is selected
     * (and highlighted). */
    function touch(phase, x, y) {
        if (!current) return;
        if (typing) return keyboardTouch(phase, x, y);
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

    function designOf() {
        return file.design || DESIGN;
    }

    function draw() {
        const design = designOf();
        if (languagesOf(file).length) text.useLanguage(active());     // a Store file leaves the kit's language be
        // values set from code go over the file's options first: a text set by code is a plain string, so it is
        // drawn as set whatever the language; the file's own text maps are then resolved in the active language
        let shown = shownScreen();
        let ring = items[focused];
        if (typing) {
            const f = elementNamed(shown, typing.field.name);
            shown = keyboard.screenOf(typing.k, shown, f && f.opts ? f.opts.label : '', design);
            ring = typing.items[typing.focused];
        }
        const rec = kit.record(pictures.resolve(shown), {
            textScale: 1,
            design: design,
            area: { x: 0, y: 0, w: design.w, h: design.h },     // embedded: the whole box is the app's
        });
        if (rec.errors) log.warn('mgu-runtime: ' + current.name + ': ' + rec.errors.join('; '));
        if (ring) focus.drawRing(rec, ring);
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
        if (current === s && !typing) draw();        // the keyboard screen is drawn over it: no change there
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

    function depth() {
        if (!current) return 0;
        return stack.length + 1 + (typing ? 1 : 0);
    }

    function title() {
        if (!current) return '';
        const t = shownScreen().title;
        return typeof t === 'string' ? t : '';
    }

    function focusItems() {
        if (!current) return [];
        if (typing) return typing.items.map((it) => (it.go ? 'go' : it.key || it.name));
        return items.map((c) => c.name);
    }

    function highlight(i) {
        const list = typing ? typing.items : items;
        if (!current || typeof i !== 'number' || i < 0 || i >= list.length || Math.floor(i) !== i) return false;
        if (typing) {
            if (typing.focused !== i) { typing.focused = i; draw(); }
        } else if (focused !== i) { focused = i; draw(); }
        return true;
    }

    return {
        languages: function () { return file ? languagesOf(file) : []; },
        depth: depth, title: title, focusItems: focusItems, highlight: highlight,
        load: load, start: start, open: open, screen: function () { return current ? current.name : null; }, set: set, setLanguage: setLanguage, language: active,
        on: on, controller: controller, touch: touch,
    };
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
