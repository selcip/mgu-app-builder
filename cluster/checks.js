'use strict';
/**
 * What the Designer asks the vendored engine without drawing (ticket 06): whether the engine accepts a widget, and the
 * palette a layout's colour roles come from. Plain CommonJS like host.js, so Node's tests and the Designer's bundle
 * (virtual:cluster-engine, `checks`) run this very file. The rules are the engine's own (shared/layouts.js _validate,
 * shared/hud_themes.js); nothing is copied here.
 */
const Layouts = require('../engine/shared/layouts.js');
const { THEMES } = require('../engine/shared/hud_themes.js');
const ICONS = require('../engine/shared/icons.js').ICONS;

const SIZE = { cluster: [1920, 720], hud: [800, 480] };

/** Why the engine refuses `widget` on the target ("cluster" by default), or null. The reason is the engine's words, with its widgets[0] lead-in turned into Element "id". */
function problem(widget, target) {
    const size = SIZE[target || 'cluster'] || SIZE.cluster;
    try {
        Layouts.prototype._validate.call({ size }, { schemaVersion: 2, widgets: [widget] }, 'layout');
        return null;
    } catch (e) {
        return String(e.message).replace(/^layout "layout": /, '').replace(/^widgets\[0\] \("([^"]*)"\)/, 'Element "$1"').replace(/^widgets\[0\]/, 'The element');
    }
}

/** The theme the engine draws a layout in: its own `theme` when the engine knows it, else the engine's fallback (classic). */
function themeOf(name) {
    return THEMES[name] ? name : 'classic';
}

/** Every role of the palette the layout's `theme` names, in the engine's order, with its [r, g, b, a] colour. */
function palette(name) {
    const t = THEMES[themeOf(name)];
    return Object.keys(t).filter((k) => Array.isArray(t[k]) && t[k].length === 4 && t[k].every((n) => typeof n === 'number'))
        .map((role) => ({ role, rgba: t[role].slice() }));
}

/** The names of the engine's palettes. */
function themes() {
    return Object.keys(THEMES);
}

module.exports = { problem, palette, themeOf, themes, icons: () => Object.keys(ICONS) };
