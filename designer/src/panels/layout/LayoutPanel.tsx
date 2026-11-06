// What the Designer shows while a cluster layout is open: the layout's name (rename) and facts in the left panel,
// (the canvas is canvas/ClusterStage.tsx). Words follow GLOSSARY.md: Cluster layout, never "theme".
import { EXPOSED_TARGETS } from '../../model/index.ts';
import { ElementList } from '../screens/ScreensPanel';
import { CommitInput } from '@/components/designer/CommitInput';
import { layoutOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

const TARGET_NAMES: Record<string, string> = { cluster: 'Instrument cluster, 1920 × 720', hud: 'Head-up display, 800 × 480' };

export function LayoutPanel() {
    const layout = useEditor(layoutOf);
    const { edit } = useActions();
    if (!layout) return null;
    const target = layout.target || 'cluster';
    return (
        <>
        <div data-layout-panel="" className="flex flex-col gap-3 p-3 text-xs">
            <label className="flex flex-col gap-1" data-layout-name="">
                <span className="text-muted-foreground">Name</span>
                <CommitInput value={layout.name} onCommit={(name) => edit({ type: 'renameLayout', name })} />
            </label>
            <div className="flex flex-col gap-1" data-layout-target={target}>
                <span className="text-muted-foreground">Shown on</span>
                <span>{TARGET_NAMES[target] || target}</span>
                {EXPOSED_TARGETS.length === 1 && <span className="text-muted-foreground">The Designer designs the cluster only for now.</span>}
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Elements</span>
                <span data-layout-widgets="">{layout.widgets.length}</span>
            </div>
        </div>
        <ElementList />
        </>
    );
}
