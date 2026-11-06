'use strict';
/**
 * A stand-in for cluster-render's protocol (v1) and limits, with no transport. The bench's server.js gives it a
 * socket; the Designer gives it an in-memory pipe. Nothing here needs net, http, fs or Node's process, and it runs in a
 * browser bundle (Buffer is the only Node global, which bundlers shim).
 *
 *   const r = createRenderer({ log, onChange, onPixels, layerCap, pixelBytes });
 *   const conn = r.connect(write, destroy);   // write(buf): the service's events to the client; destroy(): drop it
 *   conn.feed(bytes);                         // the client's bytes, in any chunking
 *   conn.close();                             // the client went away: its layers are dropped
 *   r.sceneMeta()                             // the layers (and assets) for the stage and the layers table
 *   r.pixelRect({ key, x, y, w, h })          // that rect of a layer's image, RGBA rows, or null
 *
 * Framing and ops are those of shared/cluster_render_client.js: u32 LE length, u8 type ('J' JSON, 'F' frame,
 * 'M' mesh), body. The service's limits are modelled (CompositorLimits in cluster-render's src/compositor.h):
 * 32 layers across every connection, 32 assets (16 per connection), 16 MiB of pixel memory with each image counted
 * twice, and the bench's own optional cap of N layers per connection (the car seems to draw only the first 8).
 */
// What the driver sees of each target (hood curve, BMW's gear box and belt light, the HUD window): one source of
// truth, shared with the app's layout check. Each layer of the scene carries its warnings.
const visible = require('../shared/visible');

const TARGETS = { hud: [800, 480], map: [1088, 480], panel: [1920, 720] };
const CLASSES = ['ambient', 'content', 'overlay', 'alert'];
const MAX_MSG = 5529664;
const TOTAL_LAYERS = 32;
const TOTAL_ASSETS = 32, ASSETS_PER_CLIENT = 16;   // CompositorLimits assets / assets_per_client
const DEFAULT_PIXEL_BYTES = 16 * 1048576;
const mib = (b) => (b / 1048576).toFixed(1) + ' MiB';

function encodeEvent(obj) {
    const body = Buffer.from(JSON.stringify(obj), 'utf8');
    const m = Buffer.alloc(5 + body.length);
    m.writeUInt32LE(body.length + 1, 0);
    m[4] = 0x4a;
    body.copy(m, 5);
    return m;
}

/**
 * opts:
 *   layerCap    layers drawn per connection, 0 = unlimited (the default); layers past it wait
 *   pixelBytes  pixel memory, default 16 MiB; 0 = unlimited
 *   log(level, text)            protocol mistakes and notes ('info', 'warn', 'error')
 *   onChange()                  the scene changed (layers added, set, dropped, uniforms)
 *   onPixels(layer, x, y, w, h) a rect of an image layer's pixels changed (the whole image on the first frame)
 */
function createRenderer(opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    const onChange = opts.onChange || function () {};
    const onPixels = opts.onPixels || function () {};
    const PIXEL_BYTES = opts.pixelBytes === undefined ? DEFAULT_PIXEL_BYTES : Math.max(0, Number(opts.pixelBytes) || 0);
    let layerCap = Math.max(0, Number(opts.layerCap) || 0);
    const layers = new Map();   // key "conn:ref" -> layer
    let nextConn = 1;

    // the service's accounting: an image or asset costs its bytes twice (compositor.cpp: the pixels and a rectangle scratch)
    function pixelBytes() { let n = 0; layers.forEach((l) => { if (l.image) n += l.iw * l.ih * (l.bpp || 4) * 2; }); return n; }
    function layerCount() { let n = 0; layers.forEach((l) => { if (l.kind !== 'asset') n++; }); return n; }
    function overCap() { return Array.from(layers.values()).filter((l) => l.state === 'waiting').length; }

    /** The visibility warnings for one layer's rect on its target (the same check layouts.js runs per widget). */
    function layerWarnings(l) {
        return visible.check([{ id: '#' + l.ref, x: l.x, y: l.y, w: l.w, h: l.h }], l.target === 'panel' ? 'panel' : 'hud')
            .map((w) => w.replace(/^#\d+: /, ''));
    }
    function sceneMeta() {
        return Array.from(layers.values()).map((l) => ({
            key: l.key, conn: l.conn, ref: l.ref, app: l.app, kind: l.kind, target: l.target,
            class: l.class, z: l.z, x: l.x, y: l.y, w: l.w, h: l.h, visible: l.visible, opacity: l.opacity,
            exclusive: l.exclusive, iw: l.iw, ih: l.ih, fs: l.fs, time: l.time, uniforms: l.uniforms, binds: l.binds, format: l.format,
            state: l.state, reason: l.reason, warnings: l.kind === 'asset' ? [] : layerWarnings(l),
        }));
    }

    /** That rect of the layer's image, raw RGBA rows (null when the layer or rect is not there). */
    function pixelRect(q) {
        const l = layers.get(q.key);
        const x = Number(q.x), y = Number(q.y), w = Number(q.w), h = Number(q.h);
        if (!l || !l.image || !(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= l.iw && y + h <= l.ih)) return null;
        if (l.bpp === 1) {
            // an R8 asset: the page gets it as RGBA, the byte in R (what a shader's .r reads) and A, grey in G and B
            const out = Buffer.alloc(w * h * 4);
            for (let r = 0; r < h; r++) {
                for (let i = 0; i < w; i++) {
                    const v = l.image[(y + r) * l.iw + x + i], o = (r * w + i) * 4;
                    out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = v;
                }
            }
            return out;
        }
        if (x === 0 && w === l.iw) return l.image.slice(y * l.iw * 4, (y + h) * l.iw * 4);
        const out = Buffer.alloc(w * h * 4);
        for (let r = 0; r < h; r++) l.image.copy(out, r * w * 4, ((y + r) * l.iw + x) * 4, ((y + r) * l.iw + x + w) * 4);
        return out;
    }

    /** One client of the service. write(buf) receives the events; destroy() is called when the stream is broken. */
    function connect(write, destroy) {
        const conn = nextConn++;
        const st = { conn, app: '?', hello: false, buf: Buffer.alloc(0) };
        const writeEv = (obj) => write(encodeEvent(obj));
        const bad = (why) => { log('error', 'protocol [' + st.app + ']: ' + why); };
        const refuse = (op, ref, reason) => { bad(op + ' ref ' + ref + ': ' + reason); writeEv({ ev: 'error', op, ref, reason }); };

        function feed(d) {
            st.buf = st.buf.length ? Buffer.concat([st.buf, d]) : d;
            let off = 0;
            while (st.buf.length - off >= 5) {
                const len = st.buf.readUInt32LE(off);
                if (len < 1 || len > MAX_MSG) { bad('message length ' + len + ' out of range, closing'); if (destroy) destroy(); return; }
                if (st.buf.length - off < 4 + len) break;
                const type = st.buf[off + 4];
                const body = st.buf.slice(off + 5, off + 4 + len);
                off += 4 + len;
                try { handle(type, body); } catch (e) { bad('handler threw: ' + e.stack); }
            }
            st.buf = st.buf.slice(off);
        }

        function close() {
            let n = 0;
            layers.forEach((l, k) => { if (l.conn === conn) { layers.delete(k); n++; } });
            log('info', 'renderer: ' + st.app + ' disconnected, dropped its ' + n + ' layer(s)');
            onChange();
        }

        function handle(type, body) {
            if (type === 0x4a) return onJson(body);
            if (!st.hello) return bad('binary message before hello');
            if (type === 0x46) return onFrame(body);
            if (type === 0x4d) return bad('mesh geometry received; the bench does not draw meshes');
            bad('unknown message type 0x' + type.toString(16));
        }

        function onJson(body) {
            let m;
            try { m = JSON.parse(body.toString('utf8')); } catch (e) { return bad('JSON message does not parse: ' + e.message); }
            if (m.op === 'hello') {
                st.hello = true;
                st.app = m.app || '?';
                if (m.proto !== 1) bad('hello proto ' + m.proto + ', service speaks 1');
                log('info', 'renderer: hello from ' + st.app + ' (proto ' + m.proto + ')');
                writeEv({ ev: 'hello', backend: 'bench', targets: Object.keys(TARGETS).join(',') });
                return;
            }
            if (!st.hello) return bad(m.op + ' before hello');
            const key = conn + ':' + m.ref;
            const l = layers.get(key);
            switch (m.op) {
                case 'layer': {
                    if (!TARGETS[m.target]) return refuse('layer', m.ref, 'unknown target ' + m.target);
                    if (m.class && CLASSES.indexOf(m.class) < 0) return refuse('layer', m.ref, 'unknown class ' + m.class);
                    if (m.z !== undefined && (m.z < -1000 || m.z > 1000)) return refuse('layer', m.ref, 'z out of -1000..1000');
                    const [tw, th] = TARGETS[m.target];
                    if (layerCount() >= TOTAL_LAYERS) return refuse('layer', m.ref, 'too many layers');
                    if (m.kind === 'image' && PIXEL_BYTES && m.iw > 0 && m.ih > 0 && pixelBytes() + m.iw * m.ih * 8 > PIXEL_BYTES) {
                        return refuse('layer', m.ref, "the service's pixel memory is full");
                    }
                    const nl = {
                        key, conn, ref: m.ref, app: st.app, kind: m.kind, target: m.target,
                        class: m.class || 'content', z: m.z || 0, x: m.x || 0, y: m.y || 0, w: m.w || 0, h: m.h || 0,
                        visible: m.visible === undefined ? 1 : m.visible, opacity: m.opacity === undefined ? 1 : m.opacity,
                        exclusive: m.exclusive || 0, uniforms: {}, state: 'shown', reason: '',
                    };
                    // The layer cap: count this connection's live layers that got a slot; past the cap, the
                    // layer is registered (so set/uniform/frames on it stay valid) but waits and is not drawn.
                    if (layerCap > 0) {
                        let shown = 0, live = 0;
                        layers.forEach((o) => { if (o.conn === conn && o.kind !== 'asset') { live++; if (o.state === 'shown') shown++; } });
                        if (shown >= layerCap) {
                            nl.state = 'waiting'; nl.reason = 'bench: over the layer cap of ' + layerCap;
                            log('warn', 'layer ' + m.ref + ' (' + m.kind + ' ' + nl.x + ',' + nl.y + ' ' + nl.w + 'x' + nl.h + ') is live layer #' + (live + 1) + ' on this connection: over the layer cap of ' + layerCap + ', not drawn');
                        }
                    }
                    if (nl.x + nl.w > tw || nl.y + nl.h > th || nl.x < 0 || nl.y < 0) {
                        log('warn', 'layer ' + m.ref + ' (' + nl.x + ',' + nl.y + ' ' + nl.w + 'x' + nl.h + ') runs off the ' + tw + 'x' + th + ' ' + m.target + ' target');
                    }
                    if (nl.exclusive) log('warn', 'layer ' + m.ref + ' is exclusive: it hides everything under it (CarPlay/AA map too)');
                    if (m.kind === 'image') {
                        nl.iw = m.iw; nl.ih = m.ih; nl.bpp = 4;
                        if (!(m.iw > 0 && m.ih > 0 && m.iw <= 1920 && m.ih <= 720)) return refuse('layer', m.ref, 'image iw/ih out of range');
                        nl.image = Buffer.alloc(m.iw * m.ih * 4);
                    } else if (m.kind === 'effect') {
                        if (!m.fs) return refuse('layer', m.ref, 'effect without fs');
                        nl.fs = m.fs; nl.time = !!m.time; nl.binds = {};
                    } else {
                        log('warn', 'layer ' + m.ref + ': kind ' + m.kind + ' is not drawn by the bench');
                    }
                    layers.set(key, nl);   // its visibility warnings (hood, gear box, belt light, HUD window) ride along in sceneMeta()
                    if (nl.state === 'waiting') writeEv({ ev: 'layer', ref: m.ref, state: 'waiting', reason: nl.reason });
                    else writeEv({ ev: 'layer', ref: m.ref, state: 'shown' });
                    onChange();
                    return;
                }
                case 'asset': {
                    // PROTOCOL.md "asset": an R8 or RGBA8 texture, not drawn, not a layer; effect layers sample it through "bind".
                    // The service's limits: 32 assets, 16 per client, 1..2048 a side, within one frame message; pixel memory twice its bytes.
                    if (!TARGETS[m.target]) return refuse('asset', m.ref, 'unknown target ' + m.target);
                    const format = m.format || 'rgba8', bpp = format === 'r8' ? 1 : format === 'rgba8' ? 4 : 0;
                    if (!bpp) return refuse('asset', m.ref, 'unknown asset format ' + format);
                    if (!(m.w > 0 && m.h > 0 && m.w <= 2048 && m.h <= 2048 && m.w * m.h * bpp + 64 <= 1920 * 720 * 4 + 64)) return refuse('asset', m.ref, 'asset size out of range');
                    let all = 0, mine = 0;
                    layers.forEach((o) => { if (o.kind === 'asset') { all++; if (o.conn === conn) mine++; } });
                    if (all >= TOTAL_ASSETS || mine >= ASSETS_PER_CLIENT) return refuse('asset', m.ref, 'too many assets');
                    if (PIXEL_BYTES && pixelBytes() + m.w * m.h * bpp * 2 > PIXEL_BYTES) return refuse('asset', m.ref, "the service's pixel memory is full");
                    layers.set(key, {
                        key, conn, ref: m.ref, app: st.app, kind: 'asset', target: m.target, format, bpp, class: '-', z: 0,
                        x: 0, y: 0, w: m.w, h: m.h, iw: m.w, ih: m.h, visible: 0, opacity: 1, exclusive: 0, uniforms: {},
                        image: Buffer.alloc(m.w * m.h * bpp), state: 'shown', reason: '',
                    });
                    log('info', 'asset ' + m.ref + ': ' + format + ' ' + m.w + 'x' + m.h + ' (' + mib(m.w * m.h * bpp * 2) + ' of pixel memory)');
                    writeEv({ ev: 'layer', ref: m.ref, state: 'shown' });
                    onChange();
                    return;
                }
                case 'bind': {
                    if (!l) return refuse('bind', m.ref, 'no such layer');
                    if (l.kind !== 'effect') return refuse('bind', m.ref, 'bind on a ' + l.kind + ' layer');
                    const a = layers.get(conn + ':' + m.asset);
                    if (!a || a.kind !== 'asset') return refuse('bind', m.ref, 'no such asset ' + m.asset);
                    if (a.target !== l.target) return refuse('bind', m.ref, 'the asset is on another target');
                    l.binds[m.sampler] = a.key;
                    onChange();
                    return;
                }
                case 'set': {
                    if (!l) return refuse('set', m.ref, 'no such layer');
                    ['class', 'z', 'x', 'y', 'w', 'h', 'visible', 'exclusive', 'opacity'].forEach((k) => { if (m[k] !== undefined) l[k] = m[k]; });
                    onChange();
                    return;
                }
                case 'drop': {
                    if (!l) return refuse('drop', m.ref, 'no such layer');
                    if (l.kind === 'asset') {
                        let used = false;
                        layers.forEach((o) => { if (o.binds && Object.keys(o.binds).some((s) => o.binds[s] === key)) used = true; });
                        if (used) return refuse('drop', m.ref, 'asset in use');
                    }
                    layers.delete(key);
                    onChange();
                    return;
                }
                case 'uniform': {
                    if (!l) return refuse('uniform', m.ref, 'no such layer');
                    if (l.kind !== 'effect') return refuse('uniform', m.ref, 'uniform on a ' + l.kind + ' layer');
                    const v = String(m.v).trim().split(/\s+/).map(Number);
                    if (v.some((n) => !isFinite(n))) return refuse('uniform', m.ref, 'non-numeric value "' + m.v + '"');
                    // PROTOCOL.md "Uniforms": without type, 1-4 numbers; with type, whole elements, up to 1024
                    // numbers (an array uniform). Both the numbers and the type reach the page.
                    const WIDTH = { float: 1, vec2: 2, vec3: 3, vec4: 4, mat4: 16 };
                    if (m.type !== undefined) {
                        if (!WIDTH[m.type]) return refuse('uniform', m.ref, 'unknown uniform type "' + m.type + '"');
                        if (v.length > 1024 || v.length % WIDTH[m.type]) return refuse('uniform', m.ref, 'uniform ' + m.name + ': ' + v.length + ' numbers is not whole ' + m.type + 's (or over 1024)');
                    } else if (v.length > 4) return refuse('uniform', m.ref, 'uniform ' + m.name + ': ' + v.length + ' numbers without a type (max 4)');
                    l.uniforms[m.name] = { v, type: m.type || null };
                    onChange();
                    return;
                }
                case 'status': {
                    const conns = new Set(Array.from(layers.values()).map((o) => o.conn)).size;
                    const assets = layers.size - layerCount();
                    writeEv({ ev: 'status', text: 'bench: ' + layerCount() + ' layers' + (assets ? ' and ' + assets + ' asset' + (assets > 1 ? 's' : '') : '') + ' on ' + conns + ' connection(s), layer cap ' + (layerCap || 'off') + ', ' + overCap() + ' over it, pixel memory ' + mib(pixelBytes()) + ' of ' + (PIXEL_BYTES ? mib(PIXEL_BYTES) : 'unlimited') });
                    return;
                }
                default:
                    bad('op "' + m.op + '" not handled by the bench');
            }
        }

        function onFrame(body) {
            if (body.length < 14) return bad('frame message too short');
            const ref = body.readUInt32LE(0);
            const n = body.readUInt16LE(12);
            const l = layers.get(conn + ':' + ref);
            if (!l) return bad('frame for unknown ref ' + ref);
            if (l.kind !== 'image' && l.kind !== 'asset') return bad('frame for a ' + l.kind + ' layer (ref ' + ref + ')');
            const head = 14 + n * 8, bpp = l.bpp || 4;
            const px = body.slice(head);
            if (n === 0) {
                if (px.length !== l.image.length) return bad('whole frame for ref ' + ref + ' is ' + px.length + ' bytes, layer needs ' + l.image.length);
                px.copy(l.image);
            } else {
                let o = 0;
                const rects = [];
                for (let i = 0; i < n; i++) {
                    const x = body.readUInt16LE(14 + i * 8), y = body.readUInt16LE(16 + i * 8);
                    const w = body.readUInt16LE(18 + i * 8), h = body.readUInt16LE(20 + i * 8);
                    if (x + w > l.iw || y + h > l.ih) return bad('dirty rect off the image on ref ' + ref);
                    for (let r = 0; r < h; r++) { px.copy(l.image, ((y + r) * l.iw + x) * bpp, o, o + w * bpp); o += w * bpp; }
                    rects.push([x, y, w, h]);
                }
                if (o !== px.length) return bad('dirty rects for ref ' + ref + ' carry ' + px.length + ' bytes, expected ' + o);
                if (l.sentWhole) { rects.forEach((r) => onPixels(l, r[0], r[1], r[2], r[3])); return; }
            }
            l.sentWhole = true;
            onPixels(l, 0, 0, l.iw, l.ih);
        }

        return { feed, close, get app() { return st.app; } };
    }

    return {
        connect, sceneMeta, pixelRect, pixelBytes, layerCount, overCap, layers,
        get layerCap() { return layerCap; },
        setLayerCap(n) { layerCap = Math.max(0, Math.floor(Number(n) || 0)); },
        get pixelCap() { return PIXEL_BYTES; },
    };
}

module.exports = { createRenderer, encodeEvent, TARGETS, CLASSES, TOTAL_LAYERS, TOTAL_ASSETS, ASSETS_PER_CLIENT, MAX_MSG, DEFAULT_PIXEL_BYTES };
