// virtual:mgu-runtime: the runtime and the vendored kit, bundled for the browser by vite.config.ts.
declare module 'virtual:mgu-runtime' {
    export interface Recorder {
        words(): Uint32Array;
        errors?: string[];
    }
    export interface Sink {
        frame(rec: Recorder): boolean | void;
    }
    export interface Log {
        error(msg: string): void;
        warn(msg: string): void;
        info(msg: string): void;
    }
    export interface Runtime {
        load(file: unknown): boolean;
        start(): boolean;
        /** Sets what an element shows (text, on/off, number, rows, picture); false if refused (logged). */
        set(screen: string, element: string, value: unknown): boolean;
    }
    export interface KitCanvas {
        w: number;
        h: number;
        d: Uint8Array<ArrayBuffer>;     // RGBA, straight alpha
    }
    const mgu: {
        createRuntime(opts: { sink: Sink; log?: Log; kit?: unknown; readImage?: (path: string) => Uint8Array | null }): Runtime;
        kit: unknown;
        play(words: Uint32Array, canvas: KitCanvas): void;
        Canvas: new (w: number, h: number) => KitCanvas;
        /** Draws the kit's vector icon `name` in an s x s box at x, y in colour c ('#rrggbb'); false if there is none. */
        vicon(cv: KitCanvas, name: string, x: number, y: number, s: number, c: string): boolean;
    };
    export default mgu;
}
