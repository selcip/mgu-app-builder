'use strict';
/*
 * mgu_pictures.js - pictures named by path. A screen file names its PNGs by their path relative to it
 * ('images/logo.png'); the kit only draws a picture given as a PNG data URL or as 'key:<name>'
 * (am_widgets.js picture()). Before a screen is drawn, each picture option holding an images/ path is
 * given to the kit as a data URL of the file's bytes; the kit decodes it once and keeps it (its own cache,
 * keyed by the URL, so a changed file is a new picture). Node 8, CommonJS, no requires: the bytes come
 * from readImage(path), which the platform supplies (fs on the head unit, the open design in the preview).
 *
 *   const pictures = createPictures(readImage, log);
 *   kit.record(pictures.resolve(screen), ...);      // the screen itself when it names no images/ path
 */

// widget -> its options the kit draws through picture()
const PICTURE_OPTS = { image: ['src'], appIcon: ['icon'] };
const PATH = /^images\/.+\.png$/i;
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX = 1024;       // kit_record.js makeImage: 1..1024 px a side

function isPicturePath(v) {
    return typeof v === 'string' && PATH.test(v);
}

/** Why `buf` can't be drawn as a picture, or null when it can. */
function problemOf(buf) {
    if (!buf || buf.length < 24) return 'is missing';
    for (let i = 0; i < SIGNATURE.length; i++) if (buf[i] !== SIGNATURE[i]) return 'is not a PNG';
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w < 1 || h < 1 || w > MAX || h > MAX) return 'is ' + w + ' x ' + h + ' px (at most ' + MAX + ' a side)';
    return null;
}

function createPictures(readImage, log) {
    const urls = {};        // path -> data URL, or null (logged once)

    function urlOf(p) {
        if (Object.prototype.hasOwnProperty.call(urls, p)) return urls[p];
        let buf = null, why = null;
        try {
            const bytes = readImage ? readImage(p) : null;
            if (bytes) buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        } catch (e) {
            why = 'can’t be read (' + e.message + ')';
        }
        why = why || problemOf(buf);
        if (why) log.warn('mgu-runtime: picture ' + p + ' ' + why);
        urls[p] = why ? null : 'data:image/png;base64,' + buf.toString('base64');
        return urls[p];
    }

    /** The screen as the kit should draw it: picture paths given as data URLs. Unchanged when there are none. */
    function resolve(screen) {
        const comps = screen.components || [];
        let out = null;
        for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            const keys = PICTURE_OPTS[c.gpu];
            if (!keys || !c.opts) continue;
            let opts = null;
            for (let k = 0; k < keys.length; k++) {
                const v = c.opts[keys[k]];
                if (!isPicturePath(v)) continue;
                opts = opts || Object.assign({}, c.opts);
                const url = urlOf(v);
                opts[keys[k]] = url || '';      // missing: the widget draws as without a picture
            }
            if (!opts) continue;
            if (!out) out = comps.slice();
            out[i] = Object.assign({}, c, { opts: opts });
        }
        return out ? Object.assign({}, screen, { components: out }) : screen;
    }

    return { resolve: resolve };
}

module.exports = { createPictures: createPictures, isPicturePath: isPicturePath, PICTURE_OPTS: PICTURE_OPTS };
