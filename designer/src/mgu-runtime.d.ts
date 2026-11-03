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
    export interface Action {
        screen: string;
        element: string;
        action: string;
        value?: unknown;
    }
    export interface ScreenChange {
        screen: string;
        from: string | null;
        by: 'start' | 'link' | 'back' | 'open';
    }
    export interface Runtime {
        load(file: unknown): boolean;
        /** Shows the first screen, or the one named, with nothing to go BACK to. */
        start(screen?: string): boolean;
        /** Opens a screen from the app's code, as a link would; false if refused (logged). */
        open(screen: string): boolean;
        /** The name of the screen shown; null before start. */
        screen(): string | null;
        /** Sets what an element shows (text, on/off, number, rows, picture); false if refused (logged). */
        set(screen: string, element: string, value: unknown): boolean;
        setLanguage(code: string): boolean;
        language(): string | null;
        on(event: 'action', fn: (a: Action) => void): void;
        on(event: 'screen', fn: (c: ScreenChange) => void): void;
        on(event: 'leave', fn: (l: { screen: string }) => void): void;
        controller(input: 'left' | 'right' | 'press' | 'back', steps?: number): void;
        touch(phase: 'down' | 'move' | 'up', x: number, y: number): void;
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
        text: {
            /** The characters of `s` the kit draws as '?' in `language`, once each, in order. */
            undrawable(s: string, language?: string | null): string[];
        };
        /** Draws the kit's vector icon `name` in an s x s box at x, y in colour c ('#rrggbb'); false if there is none. */
        vicon(cv: KitCanvas, name: string, x: number, y: number, s: number, c: string): boolean;
    };
    export default mgu;
}
