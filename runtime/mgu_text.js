'use strict';
/*
 * mgu_text.js - a screen file's texts in a language. Node 8, CommonJS, flat module names.
 *
 * A text option (and a screen's title) is either a plain string or a map of language code to string:
 * { "en": "Settings", "de": "Einstellungen" }. The screen file's `languages` lists its languages, the first being
 * the default; a text missing in a language is drawn in the default language. A file without `languages` (a Store
 * screen file) has plain strings only and is drawn as it is.
 */

/** Whether `v` is a text map of a file with `languages`: an object of strings keyed by at least one of them. */
function isTextMap(v, languages) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || !languages || !languages.length) return false;
    const keys = Object.keys(v);
    let known = false;
    for (let i = 0; i < keys.length; i++) {
        if (typeof v[keys[i]] !== 'string') return false;
        if (languages.indexOf(keys[i]) >= 0) known = true;
    }
    return known;
}

/** A text in `language`: the map's entry for it, else the default language's, else the first in file order. */
function textIn(v, languages, language) {
    if (!isTextMap(v, languages)) return v;
    if (typeof v[language] === 'string') return v[language];
    for (let i = 0; i < languages.length; i++) if (typeof v[languages[i]] === 'string') return v[languages[i]];
    return '';
}

/**
 * `screen` with every text map resolved to its text in `language`; the screen itself when it has none (so a file
 * of plain strings is drawn from the very objects it was loaded as).
 */
function screenIn(screen, languages, language) {
    if (!languages || !languages.length) return screen;
    let out = screen;
    const own = () => {
        if (out === screen) out = Object.assign({}, screen, { components: (screen.components || []).slice() });
        return out;
    };
    if (isTextMap(screen.title, languages)) own().title = textIn(screen.title, languages, language);
    const els = screen.components || [];
    for (let i = 0; i < els.length; i++) {
        const opts = els[i].opts;
        if (!opts) continue;
        let o = null;
        const keys = Object.keys(opts);
        for (let k = 0; k < keys.length; k++) {
            if (!isTextMap(opts[keys[k]], languages)) continue;
            if (!o) o = Object.assign({}, opts);
            o[keys[k]] = textIn(opts[keys[k]], languages, language);
        }
        if (o) own().components[i] = Object.assign({}, els[i], { opts: o });
    }
    return out;
}

// --- the kit's fonts

/** The kit's locale (locales.js) for a language code: same code, else same primary language (zh-TW -> zh-CN). */
function kitLocale(code) {
    if (typeof code !== 'string' || !code) return null;
    const locales = require('./locales.js');
    const c = code.toLowerCase();
    const primary = c.split('-')[0];
    let same = null;
    for (let i = 0; i < locales.length; i++) {
        const lc = locales[i].code.toLowerCase();
        if (lc === c) return locales[i];
        if (!same && lc.split('-')[0] === primary) same = locales[i];
    }
    return same;
}

/**
 * Tells the kit which language is drawn, so that it draws text with that language's own font where it has one
 * (Chinese). The kit keeps this per process: call it before each recording.
 */
function useLanguage(code) {
    const l = kitLocale(code);
    require('./i18n.js').setHmiLanguage(l ? l.hmiLanguages[0] : null);
}

let inter = null;           // code point -> glyph, the kit's Inter (every size and face has the same characters)
let own = Object.create(null);

function glyphsOfInter() {
    return inter || (inter = require('./font_regular.js').sizes[0].glyphs);
}

/** The largest character set of a language font (the one the kit falls back to). */
function glyphsOfOwn(name) {
    if (own[name]) return own[name];
    if (name !== 'chinese') return null;
    const sizes = require('./font_chinese.js').sizes;
    let best = sizes[0];
    for (let i = 1; i < sizes.length; i++) if (Object.keys(sizes[i].glyphs).length > Object.keys(best.glyphs).length) best = sizes[i];
    return (own[name] = best.glyphs);
}

function missingFrom(glyphs, s) {
    const out = [];
    const chars = Array.from(s);
    for (let i = 0; i < chars.length; i++) {
        if (!glyphs[chars[i].codePointAt(0)] && out.indexOf(chars[i]) < 0) out.push(chars[i]);
    }
    return out;
}

/**
 * The characters of `s` the kit can't draw in `language` (it draws '?' for them), once each, in order. The kit's
 * fonts have ASCII and a few symbols; a language with a font of its own (Chinese) adds that font's characters.
 */
function undrawable(s, language) {
    if (typeof s !== 'string' || !s) return [];
    const missing = missingFrom(glyphsOfInter(), s);
    if (!missing.length) return missing;
    const l = kitLocale(language);
    const glyphs = l && l.font ? glyphsOfOwn(l.font) : null;
    return glyphs ? missingFrom(glyphs, s) : missing;     // the kit draws the whole text in that font then
}

module.exports = {
    isTextMap: isTextMap, textIn: textIn, screenIn: screenIn, useLanguage: useLanguage, undrawable: undrawable,
};
