// The preview: the runtime and the vendored kit (virtual:mgu-runtime) draw a screen; its recording is played back
// in software onto a canvas. Each frame is also announced as a 'mgu-preview-frame' event on window, with the
// screen's name and the draw commands as bytes (little-endian words, what the renderer would receive).
import mgu from 'virtual:mgu-runtime';
import type { ScreenFile } from './model/index.ts';

export interface PreviewFrame {
    screen: string;
    words: Uint8Array;
}

/** An action the runtime reported: what the app's code receives. */
export interface Action {
    screen: string;
    element: string;
    action: string;
    value?: unknown;
}

/** A screen change the runtime reported: what the app's code receives. */
export interface ScreenChange {
    screen: string;
    from: string | null;
    by: 'start' | 'link' | 'back' | 'open';
}

/** A running preview: the runtime showing a screen, taking the stand-ins for the controller and touch. */
export interface Preview {
    lines: string[];                                            // the runtime's log lines
    controller(input: 'left' | 'right' | 'press' | 'back'): void;
    touch(phase: 'down' | 'move' | 'up', x: number, y: number): void;     // in screen px (1796 x 632)
}

export interface PreviewOptions {
    images?: Readonly<Record<string, Uint8Array>>;              // the design's PNGs: 'images/x.png' -> bytes
    language?: string | null;                                   // the file's default when not given
    /** Walking through the app (Try mode): start on the first screen and open `screen` over it, so BACK walks back
     * to the first screen. Otherwise the runtime starts on `screen` itself. */
    walk?: boolean;
    onAction?: (a: Action) => void;
    onScreen?: (c: ScreenChange) => void;
    onLeave?: (screen: string) => void;                        // BACK on the first screen: the driver leaves the app
}

/**
 * Starts the runtime on `file`, showing `screen` and drawing onto `canvas` as the head unit would show it, and passes
 * what it reports (actions, screen changes, leaving the app) to the options' callbacks.
 */
export function startPreview(file: ScreenFile, screen: string, canvas: HTMLCanvasElement, opts: PreviewOptions = {}): Preview {
    const images = opts.images || {};
    const lines: string[] = [];
    const put = (m: string) => { lines.push(String(m)); };
    const rt = mgu.createRuntime({
        kit: mgu.kit,
        log: { error: put, warn: put, info: () => {} },
        readImage: (p) => (Object.prototype.hasOwnProperty.call(images, p) ? images[p] : null),
        sink: {
            frame(rec) {
                const w = rec.words();
                const words = new Uint8Array(w.buffer.slice(w.byteOffset, w.byteOffset + w.byteLength));
                paint(new Uint32Array(words.buffer), canvas);
                const shown = rt.screen() || screen;
                window.dispatchEvent(new CustomEvent<PreviewFrame>('mgu-preview-frame', { detail: { screen: shown, words } }));
                return true;
            },
        },
    });
    if (opts.onAction) rt.on('action', opts.onAction);
    if (opts.onScreen) rt.on('screen', opts.onScreen);
    const onLeave = opts.onLeave;
    if (onLeave) rt.on('leave', (l) => onLeave(l.screen));
    if (rt.load(file)) {
        if (opts.language) rt.setLanguage(opts.language);
        if (opts.walk) {
            rt.start();
            rt.open(screen);        // nothing when it is the first screen
        } else rt.start(screen);
    }
    return {
        lines,
        controller: (input) => rt.controller(input),
        touch: (phase, x, y) => rt.touch(phase, x, y),
    };
}

/**
 * Draws `screen` of `file` onto `canvas` as the head unit would show it first, in `language` (the file's default
 * when not given). Returns the runtime's log lines.
 */
export function previewScreen(file: ScreenFile, screen: string, canvas: HTMLCanvasElement,
    images: Readonly<Record<string, Uint8Array>> = {}, language?: string | null): string[] {
    return startPreview(file, screen, canvas, { images, language }).lines;
}

function paint(words: Uint32Array, canvas: HTMLCanvasElement) {
    const cv = new mgu.Canvas(canvas.width, canvas.height);
    mgu.play(words, cv);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(cv.d.buffer, cv.d.byteOffset, cv.d.byteLength), cv.w, cv.h), 0, 0);
}

/** The characters of `s` the kit can't draw in `language` (the head unit shows '?' for them). */
export function undrawable(s: string, language?: string | null): string[] {
    return mgu.text.undrawable(s, language);
}
