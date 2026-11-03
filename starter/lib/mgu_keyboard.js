'use strict';
/*
 * mgu_keyboard.js - the keyboard screen: the runtime's own screen on which the driver types the text of a field
 * element. Platform-free, Node 8, CommonJS; used by mgu_runtime.js, which opens it over the field's screen and
 * goes back to that screen when it closes.
 *
 * It is the Store's "type" screen (store_compact.js, store_ui.js typeKey) in the iDrive 7 compact layout without the
 * Store's side rail: a round back button, a title (the field's label), the text box and the kit's word keyboard
 * with its symbols page ('#+='), every printable ASCII character. Its focus order is the keys, row by row, then
 * the back button; the Enter key ('OK') confirms, the back button (and BACK) cancels.
 *
 *   const k = open(fieldText);       // a keyboard holding the field's text
 *   screenOf(k, base, label, design) // the screen the kit draws (theme and background of `base`, the field's screen)
 *   itemsOf(k, design)               // its focusable things in focus order: { name, gpu, x, y, w, h, opts, key? }
 *   press(k, item)                   // 'confirm', 'cancel' or null (a key typed or Shift/symbols switched)
 *   k.text                           // the text typed
 */

const { keyBoxes, shown } = require('./am_store_widgets.js');

const M = 14;               // the box's margin: the focus ring's room (the Store's)
const HEAD = M + 64;        // the header row: back button and title
const FIELD_H = 64;
const GO = 'OK';
const MAX = 300;            // the most characters a field takes (the Store's)

function open(text) {
    return { text: typeof text === 'string' ? text : '', shift: false, sym: false };
}

function keyOpts(k) {
    return { layout: 'text', symbols: true, sym: k.sym, shift: k.shift, go: GO };
}

function layout(design) {
    const w = design.w - 2 * M;
    const keysY = HEAD + 14 + FIELD_H + 16;
    return {
        back: { x: M, y: M, w: 64, h: 64 },
        title: { x: M + 84, y: M + 2, w: w - 84, h: 60 },
        field: { x: M, y: HEAD + 14, w: w, h: FIELD_H },
        keys: { x: M, y: keysY, w: w, h: design.h - M - keysY },
    };
}

function el(name, gpu, b, opts) {
    return { name: name, rtype: 'gpu', gpu: gpu, x: b.x, y: b.y, w: b.w, h: b.h, opts: opts };
}

const BACK_OPTS = { text: '', vicon: 'back', style: 'round', color: '#f4f7fb' };

/** The keyboard screen as the kit draws it, over `base` (the field's screen: its name, theme and background). */
function screenOf(k, base, label, design) {
    const l = layout(design);
    return {
        kind: 'gpu', name: base.name, theme: base.theme, bg: base.bg,
        components: [
            el('back', 'vbutton', l.back, BACK_OPTS),
            el('title', 'text', l.title, { text: typeof label === 'string' ? label : '', size: 50, font: 'bold', align: 'left', color: 'text' }),
            el('field', 'field', l.field, { text: k.text, caret: true, focus: true, size: 30 }),
            el('keyboard', 'keyboard', l.keys, keyOpts(k)),
        ],
    };
}

/** The keys (each a box with the text it types now, radius as the Store's ring: 18) then the back button. */
function itemsOf(k, design) {
    const l = layout(design), o = keyOpts(k);
    const items = keyBoxes(l.keys, o).map((b) => ({ name: 'key', gpu: 'keyboard', x: b.x, y: b.y, w: b.w, h: b.h,
        key: b.kind === 'go' ? null : shown(b, o), go: b.kind === 'go' }));
    items.push(el('back', 'vbutton', l.back, BACK_OPTS));
    return items;
}

/** The driver selects `item`: types its key (store_ui.js typeKey), or confirms or cancels. */
function press(k, item) {
    if (item.name === 'back') return 'cancel';
    if (item.go) return 'confirm';
    const key = item.key;
    if (key === 'Shift') k.shift = !k.shift;
    else if (key === '#+=' || key === 'abc') k.sym = key === '#+=';
    else if (key === 'Delete') k.text = k.text.slice(0, -1);
    else {
        const add = key === 'Space' ? ' ' : key;
        if (k.text.length + add.length <= MAX) k.text += add;
    }
    return null;
}

/** The item under a point, or null. */
function hit(items, x, y) {
    for (let i = 0; i < items.length; i++) {
        const b = items[i];
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    }
    return null;
}

module.exports = { open: open, screenOf: screenOf, itemsOf: itemsOf, press: press, hit: hit, MAX: MAX };
