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
        setLanguage(code: string): boolean;
        language(): string | null;
    }
    export interface KitCanvas {
        w: number;
        h: number;
        d: Uint8Array<ArrayBuffer>;     // RGBA, straight alpha
    }
    const mgu: {
        createRuntime(opts: { sink: Sink; log?: Log; kit?: unknown }): Runtime;
        kit: unknown;
        play(words: Uint32Array, canvas: KitCanvas): void;
        Canvas: new (w: number, h: number) => KitCanvas;
        text: {
            /** The characters of `s` the kit draws as '?' in `language`, once each, in order. */
            undrawable(s: string, language?: string | null): string[];
        };
    };
    export default mgu;
}
