// The Designer's layout: the toolbar across the top, the screens panel on the left, the canvas in the middle and
// the inspector panel on the right. Every part reads the editor store and edits through it (store/editor.ts); App only places them.
import { RestorePrompt, useAutosave } from './shell/Autosave';
import { ElementList, ScreenList } from './panels/screens/ScreensPanel';
import { ClusterStage } from './canvas/ClusterStage';
import { Stage } from './canvas/Stage';
import { useEditKeys } from './shell/keys.ts';
import { Inspector } from './panels/inspector/Inspector';
import { TryReport } from './shell/Try';
import { SignalsPanel } from './shell/Signals';
import { Panel, PanelArea, usePanelKeys } from './shell/Panel';
import { readPanels, writePanels } from './shell/panels.ts';
import { Toolbar } from './shell/Toolbar';
import { LayoutPanel } from './panels/layout/LayoutPanel';
import { LayoutInspector } from './panels/layout/LayoutInspector';
import { createEditorStore, kindOf, type EditorStore } from './store/editor.ts';
import { EditorProvider, useEditor } from './store/react.tsx';

export function App({ store }: { store?: EditorStore }) {
    return (
        <EditorProvider store={store || defaultStore()}>
            <Designer />
        </EditorProvider>
    );
}

let designerStore: EditorStore | null = null;

/** The Designer's own store: its panel layouts are the ones this browser kept, and every change is kept again. */
function defaultStore(): EditorStore {
    if (designerStore) return designerStore;
    const storage = (() => { try { return window.localStorage; } catch { return null; } })();
    const store = createEditorStore(undefined, { panels: readPanels(storage) });
    store.subscribe((s, prev) => { if (s.panels !== prev.panels) writePanels(storage, s.panels); });
    return (designerStore = store);
}

function Designer() {
    const saved = useAutosave();
    usePanelKeys();
    useEditKeys();
    const layout = useEditor(kindOf) === 'cluster-layout';
    return (
        <div className="app flex h-screen flex-col overflow-hidden">
            <Toolbar autosaveProblem={saved.problem} />
            {saved.offer && <RestorePrompt onRestore={saved.restore} onDecline={saved.decline} />}
            {layout ? (
            <PanelArea>
                <Panel side="left" title="Cluster layout">
                    <LayoutPanel />
                </Panel>
                <ClusterStage />
                <Panel side="right" title="Inspector" className="inspector">
                    <LayoutInspector />
                </Panel>
                <SignalsPanel />
            </PanelArea>
            ) : (
            <PanelArea>
                <Panel side="left" title="Screen file">
                    <ScreenList />
                    <ElementList />
                </Panel>
                <Stage />
                <Panel side="right" title="Inspector" className="inspector">
                    <Inspector />
                </Panel>
                <TryReport />
            </PanelArea>
            )}
        </div>
    );
}
