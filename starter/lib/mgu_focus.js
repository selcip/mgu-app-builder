'use strict';
/*
 * mgu_focus.js - focus order, actions, hit testing and the focus ring for one screen. Platform-free, Node 8,
 * CommonJS; used by mgu_runtime.js.
 *
 * Focus order: the screen's `focus` list (element names, in order) when it has one; otherwise reading order (top to
 * bottom, left to right) over the elements whose widget takes focus (FOCUSABLE, kept equal to the Designer's widget
 * catalog by test/widget-catalog.test.js). Hidden elements (opts.hidden) and names that are not on the screen are
 * skipped. An element's action is its name, unless its `onTap` names another as 'event:<action>' (the Store's
 * spelling); several elements may share one.
 */

/** Widgets that take focus unless the screen file says otherwise (the catalog's `focusable`). */
const FOCUSABLE = ['button', 'roundButton', 'vbutton', 'toggle', 'slider', 'dropdown', 'tabs', 'field', 'swatches',
    'keyboard', 'tile', 'choice', 'row', 'list', 'navRail', 'sideNav', 'appGrid', 'appList'];

const RING = { out: 8, width: 5, color: '#ffffff' };     // the Store's: 8 px outside the element, 5 px wide

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

function boxOf(c) {
    return { x: num(c.x, 0), y: num(c.y, 0), w: num(c.w, 0), h: num(c.h, 0) };
}

/** The element's own corner radius, as the kit draws it; the ring's is 8 px more. */
function radiusOf(c) {
    const b = boxOf(c), o = c.opts || {};
    const half = Math.min(b.w, b.h) / 2;
    switch (c.gpu) {
        case 'button': return Math.min(num(o.radius, 16), half);
        case 'card': return Math.min(num(o.radius, 20), half);
        case 'roundButton': case 'toggle': case 'slider': case 'swatches': return half;
        case 'vbutton': return o.style === 'round' ? half : Math.min(18, b.h / 2);
        case 'dropdown': case 'tabs': case 'field': return Math.min(14, b.h / 2);
        case 'tile': case 'appGrid': return 24;
        case 'choice': case 'list': case 'appList': return 22;
        case 'keyboard': return 18;
        case 'row': case 'navRail': case 'sideNav': return 16;
        default: return Math.min(16, half);
    }
}

function shown(c) {
    return !!c && !(c.opts && c.opts.hidden);
}

/** Reading order: lines top to bottom (an element joins a line when its middle is within the line's first
 * element's height), each line left to right. Ties keep the screen file's order. */
function readingOrder(elements) {
    const byTop = elements.map((c, i) => ({ c: c, b: boxOf(c), i: i }));
    byTop.sort((a, b) => (a.b.y - b.b.y) || (a.b.x - b.b.x) || (a.i - b.i));
    const out = [];
    let k = 0;
    while (k < byTop.length) {
        const head = byTop[k].b;
        const line = [];
        while (k < byTop.length) {
            const b = byTop[k].b;
            if (line.length && b.y + b.h / 2 > head.y + head.h) break;
            line.push(byTop[k]);
            k++;
        }
        line.sort((a, b) => (a.b.x - b.b.x) || (a.b.y - b.b.y) || (a.i - b.i));
        for (let j = 0; j < line.length; j++) out.push(line[j].c);
    }
    return out;
}

/** The screen's elements in focus order. */
function focusOrder(screen) {
    const all = (screen && screen.components) || [];
    if (Array.isArray(screen.focus)) {
        const byName = {};
        all.forEach((c) => { if (!(c.name in byName)) byName[c.name] = c; });
        const seen = {};
        const out = [];
        screen.focus.forEach((n) => {
            const c = byName[n];
            if (shown(c) && !seen[n]) { seen[n] = true; out.push(c); }
        });
        return out;
    }
    return readingOrder(all.filter((c) => shown(c) && FOCUSABLE.indexOf(c.gpu) >= 0));
}

/** The action an element reports. */
function actionOf(c) {
    const t = c.onTap;
    if (typeof t === 'string' && t.indexOf('event:') === 0 && t.length > 6) return t.slice(6);
    return c.name;
}

/** The topmost of `items` (elements) under the point, or null. Later elements in the file are drawn on top. */
function hit(screen, items, x, y) {
    const all = (screen && screen.components) || [];
    for (let i = all.length - 1; i >= 0; i--) {
        const c = all[i];
        if (items.indexOf(c) < 0) continue;
        const b = boxOf(c);
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return c;
    }
    return null;
}

/** Draws the focus ring around `c` on top of the recording. */
function drawRing(rec, c) {
    const b = boxOf(c), o = RING.out;
    rec.strokeRoundRect(b.x - o, b.y - o, b.w + 2 * o, b.h + 2 * o, radiusOf(c) + o, RING.width, RING.color);
}

module.exports = { FOCUSABLE: FOCUSABLE, RING: RING, focusOrder: focusOrder, readingOrder: readingOrder, actionOf: actionOf,
    hit: hit, drawRing: drawRing };
