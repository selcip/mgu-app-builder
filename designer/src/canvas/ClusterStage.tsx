// The cluster canvas: the open cluster layout drawn at 1920x720 by the apps repo's own engine and WebGL stage
// (virtual:cluster-engine, ADR 0005) on the same zoomable viewport the screens use. Read-only here. The engine is
// started with the layout and told the new layout when it changes (setLayout); its layers and pixels go to the stage,
// which is redrawn when something changed and on every frame while an effect layer animates. A layout the engine
// refuses is shown with the engine's own reason (its status row) over the empty canvas.
// While trying, the engine is started afresh (no data, as on opening) and fed the signals panel's values (feedsOf) as the car
// would send them, again every REFEED ms (the engine counts a boost reading older than 3 s as gone), or runs the kit's
// demo drive (the engine's own "demo" setting). Leaving Trying starts it afresh once more, so nothing of the signals stays.
// Each drawn frame is announced as a 'mgu-cluster-frame' event on window with the time it was drawn at.
import { useEffect, useRef, useState } from 'react';
import cluster, { type ClusterEngine } from 'virtual:cluster-engine';
import { apply } from '../model/index.ts';
import { Canvas } from './Canvas';
import { Viewport } from '../shell/Viewport';
import { layoutOf } from '../store/editor.ts';
import { settingByKey } from '../model/index.ts';
import { feedsOf } from '../store/signals.ts';
import { useActions, useEditor, useEditorStore } from '../store/react.tsx';

const [W, H] = cluster.TARGETS.panel;
const REFEED = 250;

export function ClusterStage() {
    const layout = useEditor(layoutOf);
    const trying = useEditor((s) => s.trying);
    const store = useEditorStore();
    const { zoomToFit } = useActions();
    const canvas = useRef<HTMLCanvasElement>(null);
    const engine = useRef<ClusterEngine | null>(null);
    const drawn = useRef<unknown>(null);          // the layout the engine has been given
    const [refusal, setRefusal] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        const el = canvas.current;
        const first = layoutOf(store.getState());
        if (!el || !first) return;
        let alive = true, dirty = true, raf = 0;
        const lines: string[] = [];
        const note = (level: string, text: string) => { if (level !== 'info' && alive) { lines.push(text); setLog(lines.slice(-4)); } };
        const stage = cluster.createStage({ canvas: el, log: (level, text) => note(String(level), String(text)) });
        stage.setView('panel', cluster.TARGETS);
        let e: ClusterEngine | null = null;
        const refresh = () => {
            if (!alive || !e) return;
            // the engine keeps the reason it refused a layout in hud.problem; the status row says it
            const problem = e.hud.problem;
            setRefusal(problem ? e.status() : null);
        };
        e = cluster.createEngine({
            name: 'design', layout: first, settings: store.getState().previewSettings,
            onChange() { if (e) stage.setScene(e.scene()); dirty = true; },
            onPixels(l, x, y, w, h) {
                const layer = l as { key: string; iw: number; ih: number };
                const px = e && e.pixelRect({ key: layer.key, x, y, w, h });
                if (px) stage.putPixels(layer.key, layer.iw, layer.ih, x, y, w, h, px);
                dirty = true;
            },
            onStatus() { dirty = true; Promise.resolve().then(refresh); },
        });
        engine.current = e;
        const live = e;
        // the signals, while trying: fed as the car sends them (a field the layout does not watch is not fed)
        const feedAll = () => {
            const s = store.getState();
            if (!s.trying || s.demoDrive) return;
            feedsOf(s.signals).forEach((f) => { try { live.feed(f.iface, f.field, f.value); } catch { /* not watched */ } });
        };
        const setDemo = () => live.setSetting('demo', store.getState().trying && store.getState().demoDrive ? 'on' : 'off');
        let refeed = 0;
        if (trying) { setDemo(); feedAll(); refeed = window.setInterval(feedAll, REFEED); }
        drawn.current = first;
        stage.setScene(e.scene());
        refresh();
        const frame = (t: number) => {
            if (!alive) return;
            if (dirty || stage.animated()) {
                dirty = false;
                stage.draw(t);
                window.dispatchEvent(new CustomEvent('mgu-cluster-frame', { detail: { t, layers: e!.scene().length } }));
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        // the layout the engine draws: the open one, with the edit being dragged applied (the canvas edits show at once)
        const shown = (s: ReturnType<typeof store.getState>) => {
            const open = layoutOf(s);
            if (!open || !s.dragOp) return open;
            try { const d = apply(s.history.present, s.dragOp); return d.kind === 'cluster-layout' ? d.layout : open; } catch { return open; }
        };
        const stopWatching = store.subscribe((s, prev) => {
            if (s.previewSettings !== prev.previewSettings) {      // a preview setting flipped: the engine rebuilds with it
                for (const k of new Set([...Object.keys(s.previewSettings), ...Object.keys(prev.previewSettings)])) {
                    const was = prev.previewSettings[k], now = s.previewSettings[k] ?? settingByKey(k)?.default;
                    if (s.previewSettings[k] !== was) live.setSetting(k, now);
                }
                dirty = true;
            }
            if (trying && s.signals !== prev.signals) feedAll();
            if (trying && s.demoDrive !== prev.demoDrive) { setDemo(); feedAll(); }
            if (layoutOf(s) === layoutOf(prev) && s.dragOp === prev.dragOp) return;
            const next = shown(s);
            if (!next || next === drawn.current) return;
            drawn.current = next;
            e!.setLayout(next);
            dirty = true;
            Promise.resolve().then(refresh);
        });
        return () => { alive = false; cancelAnimationFrame(raf); clearInterval(refeed); stopWatching(); e!.stop(); engine.current = null; };
    }, [store, trying]);

    // open fitted: the cluster is wider than the canvas area at 100 %
    useEffect(() => { zoomToFit(); }, [zoomToFit]);

    if (!layout) return null;
    return (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" data-stage="" data-cluster-stage="">
            <Viewport overlay={(
                <>
                    {refusal && (
                        <div role="alert" data-cluster-refusal="" className="absolute inset-x-6 top-6 z-20 rounded-md border border-destructive/40 bg-card p-3 text-sm shadow">
                            <p className="m-0 font-medium text-destructive">The engine does not draw this layout</p>
                            <p className="m-0 mt-1 break-words font-mono text-xs">{refusal}</p>
                        </div>
                    )}
                    {log.length > 0 && <ul className="absolute bottom-2 left-3 z-20 m-0 list-none p-0 font-mono text-xs text-amber-300">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                </>
            )}>
                <div data-cluster-page="" data-trying={trying} style={{ width: W, height: H, background: '#000' }}>
                    <Canvas design={{ w: W, h: H }} rings={false}>
                        <canvas ref={canvas} width={W} height={H} data-cluster-canvas="" style={{ display: 'block' }} />
                    </Canvas>
                </div>
            </Viewport>
        </section>
    );
}
