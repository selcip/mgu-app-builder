// virtual:cluster-engine: the apps repo's cluster engine (engine/), its stand-in for cluster-render and the WebGL stage,
// and cluster/host.js, bundled for the browser by vite.config.ts (ADR 0005).
declare module 'virtual:cluster-engine' {
    export interface ClusterLayer {
        key: string; conn: number; ref: number; app: string; kind: 'image' | 'effect' | 'asset'; target: string;
        class: string; z: number; x: number; y: number; w: number; h: number; visible: boolean; opacity: number;
        exclusive: boolean; iw: number; ih: number; fs?: string; time?: boolean; uniforms: Record<string, unknown>;
        binds: Record<string, unknown>; format?: string; state: string; reason?: string; warnings: string[];
    }
    export interface ClusterEngine {
        /** Every layer and asset the layout registered, with its rect, class, z, state and visibility warnings. */
        scene(): ClusterLayer[];
        /** An image layer's RGBA rows for the rect, or null. */
        pixelRect(r: { key: string; x: number; y: number; w: number; h: number }): Uint8Array | null;
        /** The status row text the car's centre screen shows. */
        status(): string;
        settings(): Record<string, unknown>;
        setSetting(key: string, value: unknown): void;
        /** A new layout under the same name; the engine reloads it. */
        setLayout(layout: unknown): void;
        /** One signal field as the car's watch delivers it (raw SOME/IP values). */
        feed(iface: string, field: string, value: unknown): void;
        watched(): { iface: string; fields: string[] }[];
        logs: { level: string; text: string }[];
        stop(): void;
    }
    export interface ClusterEngineOptions {
        name?: string;
        layout: unknown;
        settings?: Record<string, unknown>;
        layerCap?: number;
        pixelBytes?: number;
        onChange?: () => void;
        onPixels?: (layer: unknown, x: number, y: number, w: number, h: number) => void;
        onStatus?: (text: string) => void;
        onLog?: (level: string, text: string) => void;
    }
    export interface ClusterEngineModule {
        createEngine(opts: ClusterEngineOptions): ClusterEngine;
        createStage(opts: { canvas: HTMLCanvasElement; log?: (...a: unknown[]) => void; createCanvas?: () => HTMLCanvasElement }): unknown;
        TARGETS: Record<string, [number, number]>;
    }
    const cluster: ClusterEngineModule;
    export default cluster;
}
