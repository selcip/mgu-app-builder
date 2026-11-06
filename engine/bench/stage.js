'use strict';
/**
 * The bench's stage: draws cluster-render's layers on a canvas. Image layers are the app's raw RGBA pushes; effect
 * layers run the app's real GLSL fragment shader in WebGL. Layers are stacked by class, then z, as cluster-render
 * orders them; layers over the layer cap (state 'waiting') are not drawn; an 'exclusive' layer hides everything under it.
 *
 * Browser only, and no transport: the caller hands it a canvas, the scene (render_protocol.js sceneMeta()) and the
 * pixel bytes it fetched or holds (render_protocol.js pixelRect()). No Node, no net, no fs. Loads as a CommonJS
 * module or, in a plain page, with `var module = { exports: {} }` first.
 *
 *   const stage = createStage({ canvas, log });          // canvas: the 2D canvas the target is drawn on
 *   stage.setView('panel', TARGETS);                      // sizes the canvas to the target (1920x720)
 *   stage.setScene(sceneMeta);                            // the layers now; forgets pixels of layers that are gone
 *   stage.putPixels(key, iw, ih, x, y, w, h, bytes);      // RGBA rows of that rect of an image layer
 *   stage.draw(t, { before(ctx), after(ctx, shown) });    // t: ms; before draws the backdrop, after the outlines, car view
 *   stage.animated()                                      // a layer with `time` needs a redraw every frame
 *
 * opts: canvas (required), createCanvas() (default document.createElement('canvas'): where WebGL draws),
 *       log(level, text).
 */
const CLASS_ORDER = { ambient: 0, content: 1, overlay: 2, alert: 3 };
const VS = 'attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);  /* top-left, as cluster-render */ gl_Position = vec4(a_pos, 0.0, 1.0); }';

function createStage(opts) {
    const canvas = opts.canvas;
    const ctx = canvas.getContext('2d');
    const log = opts.log || function () {};
    const createCanvas = opts.createCanvas || function () { return document.createElement('canvas'); };
    let scene = [];
    const images = new Map();     // key -> canvas holding the layer's pixels
    let view = 'hud', VW = canvas.width, VH = canvas.height;

    /* ---------- WebGL for effect layers: the app's real fragment shader ---------- */
    let glCanvas = null, gl = null, quad = null;
    const programs = new Map();   // fs source -> {prog, err}
    const shaderErrors = new Set();
    const textures = new Map();   // asset key -> { tex, stamp }: the WebGL texture of an asset's pixels, uploaded again when the canvas changed
    const uniformNotes = new Set();

    function initGl() {
        if (gl) return;
        glCanvas = createCanvas();
        gl = glCanvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
        quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    }
    function compile(fs) {
        if (programs.has(fs)) return programs.get(fs);
        const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        const v = mk(gl.VERTEX_SHADER, VS), f = mk(gl.FRAGMENT_SHADER, fs);
        const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
        let entry;
        if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) entry = { err: 'fragment shader does not compile: ' + gl.getShaderInfoLog(f) };
        else if (!gl.getProgramParameter(p, gl.LINK_STATUS)) entry = { err: 'shader does not link: ' + gl.getProgramInfoLog(p) };
        else entry = { prog: p };
        programs.set(fs, entry);
        return entry;
    }
    function textureOf(key, c) {
        let t = textures.get(key);
        if (!t) { t = { tex: gl.createTexture(), stamp: -1 }; textures.set(key, t); }
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        if (t.stamp !== (c.stamp || 0)) {
            t.stamp = c.stamp || 0;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        return t.tex;
    }
    function noteUniform(l, name, why) {
        const k = l.key + ':' + name + ':' + why;
        if (uniformNotes.has(k)) return;
        uniformNotes.add(k); log('warn', 'bench: layer ' + l.ref + ' uniform ' + name + ': ' + why);
    }
    function drawEffect(l, t) {
        initGl();
        const e = compile(l.fs);
        if (e.err) {
            if (!shaderErrors.has(l.key)) { shaderErrors.add(l.key); log('error', 'bench: layer ' + l.ref + ' ' + e.err); }
            return null;
        }
        glCanvas.width = Math.max(1, l.w); glCanvas.height = Math.max(1, l.h);
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(e.prog);
        const loc = gl.getAttribLocation(e.prog, 'a_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const n = gl.getProgramParameter(e.prog, gl.ACTIVE_UNIFORMS);
        let unit = 0;
        for (let i = 0; i < n; i++) {
            const info = gl.getActiveUniform(e.prog, i);
            if (info.type === gl.SAMPLER_2D) {
                // a sampler reads the asset bound to it (the 'bind' op); its pixels came as an image, R in .r
                const key = l.binds && l.binds[info.name], c = key && images.get(key);
                const u = gl.getUniformLocation(e.prog, info.name);
                if (!c || !u) { if (!c) noteUniform(l, info.name, 'no asset bound'); continue; }
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, textureOf(key, c));
                gl.uniform1i(u, unit++);
                continue;
            }
            // An array uniform is reported as "name[0]" with size > 1; the client sets it by its base name
            // (PROTOCOL.md "Uniforms": one 'uniform' message of type x size numbers). Either spelling is accepted.
            const base = info.name.replace(/\[0\]$/, '');
            const u = gl.getUniformLocation(e.prog, info.name) || gl.getUniformLocation(e.prog, base);
            const entry = l.uniforms[base] || l.uniforms[info.name];
            let v = entry ? entry.v : null;
            if (info.name === 'u_time' && l.time) v = [t / 1000];
            if (!v || !u) continue;
            const width = { [gl.FLOAT]: 1, [gl.FLOAT_VEC2]: 2, [gl.FLOAT_VEC3]: 3, [gl.FLOAT_VEC4]: 4, [gl.FLOAT_MAT4]: 16 }[info.type];
            if (!width) continue;
            const count = Math.min(info.size, Math.floor(v.length / width));   // whole elements only, up to the shader's array size
            if (count < 1) { noteUniform(l, info.name, v.length + ' numbers do not fill one element of width ' + width); continue; }
            if (entry && entry.v.length > width * info.size) noteUniform(l, info.name, entry.v.length + ' numbers sent, shader holds ' + info.size + ' x ' + width + '; extra ignored');
            const vals = new Float32Array(v.slice(0, count * width));
            if (info.type === gl.FLOAT) gl.uniform1fv(u, vals);
            else if (info.type === gl.FLOAT_VEC2) gl.uniform2fv(u, vals);
            else if (info.type === gl.FLOAT_VEC3) gl.uniform3fv(u, vals);
            else if (info.type === gl.FLOAT_VEC4) gl.uniform4fv(u, vals);
            else if (info.type === gl.FLOAT_MAT4) gl.uniformMatrix4fv(u, false, vals);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return glCanvas;
    }

    /* ---------- the scene ---------- */

    function setView(v, targets) {
        view = v; VW = targets[v][0]; VH = targets[v][1];
        canvas.width = VW; canvas.height = VH;
    }
    function setScene(layers) {
        scene = layers;
        const keys = new Set(layers.map((l) => l.key));
        Array.from(images.keys()).forEach((k) => { if (!keys.has(k)) images.delete(k); });
    }
    /** A rect of an image layer (or asset) changed: bytes are w*h*4 RGBA. */
    function putPixels(key, iw, ih, x, y, w, h, bytes) {
        let c = images.get(key);
        if (!c) { c = createCanvas(); images.set(key, c); }
        if (c.width !== iw || c.height !== ih) { c.width = iw; c.height = ih; }
        c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes), w, h), x, y);
        c.stamp = (c.stamp || 0) + 1;
    }
    /** Has this image layer's pixels? (false until the first putPixels) */
    function hasPixels(key) { return images.has(key); }
    function animated() { return scene.some((l) => l.kind === 'effect' && l.time); }
    /** The layers on this view that are visible and not waiting (not assets), bottom first. The outlines show all of
     *  them; draw() paints only from the last exclusive one up. */
    function shownLayers() {
        return scene.filter((l) => l.target === view && l.visible && l.state !== 'waiting' && l.kind !== 'asset')
            .sort((a, b) => (CLASS_ORDER[a.class] - CLASS_ORDER[b.class]) || (a.z - b.z));
    }
    function draw(t, hooks) {
        hooks = hooks || {};
        ctx.clearRect(0, 0, VW, VH);
        if (hooks.before) hooks.before(ctx);
        const hud = shownLayers();
        let start = 0;
        hud.forEach((l, i) => { if (l.exclusive) start = i; });
        hud.slice(start).forEach((l) => {
            ctx.globalAlpha = l.opacity === undefined ? 1 : l.opacity;
            if (l.kind === 'image') { const c = images.get(l.key); if (c) ctx.drawImage(c, l.x, l.y, l.w, l.h); }
            else if (l.kind === 'effect') { const c = drawEffect(l, t); if (c) ctx.drawImage(c, l.x, l.y, l.w, l.h); }
            ctx.globalAlpha = 1;
        });
        if (hooks.after) hooks.after(ctx, hud);
    }

    return { setView, setScene, putPixels, hasPixels, animated, draw, shownLayers, get view() { return view; }, get width() { return VW; }, get height() { return VH; }, get imageCount() { return images.size; } };
}

module.exports = { createStage, CLASS_ORDER };
