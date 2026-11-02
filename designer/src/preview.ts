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

/** A running preview: the runtime showing one screen, taking the stand-ins for the controller and touch. */
export interface Preview {
    lines: string[];                                            // the runtime's log lines
    controller(input: 'left' | 'right' | 'press' | 'back'): void;
    touch(phase: 'down' | 'move' | 'up', x: number, y: number): void;     // in screen px (1796 x 632)
}

/**
 * Starts the runtime on `screen` of `file`, drawing onto `canvas` as the head unit would show it, and reporting
 * the actions it reports to `onAction`.
 */
export function startPreview(file: ScreenFile, screen: string, canvas: HTMLCanvasElement, onAction?: (a: Action) => void): Preview {
    const lines: string[] = [];
    const put = (m: string) => { lines.push(String(m)); };
    const rt = mgu.createRuntime({
        kit: mgu.kit,
        log: { error: put, warn: put, info: () => {} },
        sink: {
            frame(rec) {
                const w = rec.words();
                const words = new Uint8Array(w.buffer.slice(w.byteOffset, w.byteOffset + w.byteLength));
                paint(new Uint32Array(words.buffer), canvas);
                window.dispatchEvent(new CustomEvent<PreviewFrame>('mgu-preview-frame', { detail: { screen, words } }));
                return true;
            },
        },
    });
    if (onAction) rt.on('action', onAction);
    // the runtime shows a file's first screen: preview the chosen one by making it first
    if (rt.load(Object.assign({}, file, { first: screen }))) rt.start();
    return {
        lines,
        controller: (input) => rt.controller(input),
        touch: (phase, x, y) => rt.touch(phase, x, y),
    };
}

/** Draws `screen` of `file` onto `canvas` as the head unit would show it first. Returns the runtime's log lines. */
export function previewScreen(file: ScreenFile, screen: string, canvas: HTMLCanvasElement): string[] {
    return startPreview(file, screen, canvas).lines;
}

function paint(words: Uint32Array, canvas: HTMLCanvasElement) {
    const cv = new mgu.Canvas(canvas.width, canvas.height);
    mgu.play(words, cv);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(cv.d.buffer, cv.d.byteOffset, cv.d.byteLength), cv.w, cv.h), 0, 0);
}
