// The Layer budget of the open cluster layout, live: a second engine, with no stage and no signals, is run on the layout
// with the car's limits (8 layers on each connection, 16 MiB of pixel memory; cluster/budget.js reads its packing plan) and
// told the new layout on every edit. The engine plans the layers when it is told; its stand-in answers a moment later, so
// the budget is read again when the engine reports a change and shortly after each edit.
import { useEffect, useState } from 'react';
import cluster, { type ClusterEngine, type LayerBudget } from 'virtual:cluster-engine';
import { layoutOf } from '../../store/editor.ts';
import { useEditorStore } from '../../store/react.tsx';

const SETTLE = 120;

export function useLayerBudget(): LayerBudget | null {
    const store = useEditorStore();
    const [budget, setBudget] = useState<LayerBudget | null>(null);
    useEffect(() => {
        const first = layoutOf(store.getState());
        if (!first) return;
        let alive = true, timer = 0, last = '';
        let engine: ClusterEngine | null = null;
        const read = () => {
            if (!alive || !engine) return;
            const b = cluster.budgetOf(engine);
            const key = JSON.stringify(b);
            if (key === last) return;
            last = key;
            setBudget(b);
        };
        const soon = () => { clearTimeout(timer); timer = window.setTimeout(read, SETTLE); };
        engine = cluster.createEngine({
            name: 'budget', layout: first, layerCap: cluster.CAR.perConnection, pixelBytes: cluster.CAR.pixelBytes,
            onChange: soon, onStatus: soon,
        });
        let shown: unknown = first;
        soon();
        const stop = store.subscribe((s) => {
            const open = layoutOf(s);
            if (!open || open === shown) return;
            shown = open;
            engine!.setLayout(open);
            soon();
        });
        return () => { alive = false; clearTimeout(timer); stop(); engine!.stop(); };
    }, [store]);
    return budget;
}
