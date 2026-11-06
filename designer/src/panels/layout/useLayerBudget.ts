// The Layer budget of the open cluster layout, live. The canvas's own engine (ClusterStage) reads its packing plan with
// cluster.budgetOf and publishes it to the store; this reads it. One engine serves both: the plan (layers per connection,
// pixel memory) is the engine's own work, the same whether or not the stand-in holds layers back at the car's cap, so the
// canvas keeps drawing everything it is asked to and no second engine runs. null until the first plan is read.
import type { LayerBudget } from 'virtual:cluster-engine';
import { useEditor } from '../../store/react.tsx';

export function useLayerBudget(): LayerBudget | null {
    return useEditor((s) => s.layerBudget);
}
