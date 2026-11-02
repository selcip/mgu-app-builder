// The part of Node's zlib the vendored kit calls, on fflate (zlib format, as Node's inflate/deflate).
//   inflateSync(buf, { maxOutputLength })  fonts' atlas pixels, PNG data; throws RangeError past maxOutputLength,
//                                          as Node 12.19+ does (kit_png probes for this when it loads)
//   deflateSync(buf, { level })            PNG encoding (Canvas.png, qr.qrPng)
//   createInflate()                        kit_png.decodeAsync: on('data'|'end'|'error'), end(chunk), destroy()
import { unzlibSync, zlibSync, Unzlib } from 'fflate';
import { Buffer } from 'buffer';

const u8 = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b));
const buf = (u) => Buffer.from(u.buffer, u.byteOffset, u.byteLength);

export function inflateSync(input, opts) {
    let out;
    try { out = unzlibSync(u8(input)); } catch (e) { throw new Error(e.message || 'invalid zlib data'); }
    const max = opts && opts.maxOutputLength;
    if (max != null && out.length > max) throw new RangeError('Cannot create a Buffer larger than ' + max + ' bytes');
    return buf(out);
}

export function deflateSync(input, opts) {
    const level = opts && opts.level != null ? opts.level : 6;
    return buf(zlibSync(u8(input), { level: Math.max(0, Math.min(9, level)) }));
}

export function createInflate() {
    const on = { data: [], end: [], error: [] };
    let dead = false;
    const emit = (ev, v) => { for (const f of on[ev]) f(v); };
    const inf = new Unzlib((chunk, final) => {
        if (dead) return;
        if (chunk.length) emit('data', buf(chunk));
        if (final && !dead) emit('end');
    });
    return {
        on(ev, f) { (on[ev] = on[ev] || []).push(f); return this; },
        destroy() { dead = true; },
        end(chunk) {
            setTimeout(() => {
                try { inf.push(u8(chunk || new Uint8Array(0)), true); } catch (e) { if (!dead) emit('error', e); }
            }, 0);
        },
    };
}

export default { inflateSync, deflateSync, createInflate };
