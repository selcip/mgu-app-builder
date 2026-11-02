// The preview: the runtime and the vendored kit (virtual:mgu-runtime) draw a screen; its recording is played back
// in software onto a canvas. Each frame is also announced as a 'mgu-preview-frame' event on window, with the
// screen's name and the draw commands as bytes (little-endian words, what the renderer would receive).
import mgu from 'virtual:mgu-runtime';
import type { ScreenFile } from './model/index.ts';

export interface PreviewFrame {
    screen: string;
    words: Uint8Array;
}

/**
 * Draws `screen` of `file` onto `canvas` as the head unit would show it first, in `language` (the file's default
 * when not given). Returns the runtime's log lines.
 */
export function previewScreen(file: ScreenFile, screen: string, canvas: HTMLCanvasElement, language?: string | null): string[] {
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
    // the runtime shows a file's first screen: preview the chosen one by making it first
    if (rt.load(Object.assign({}, file, { first: screen }))) {
        if (language) rt.setLanguage(language);
        rt.start();
    }
    return lines;
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
