// The Designer's layout: the toolbar across the top, the screens panel on the left, the canvas in the middle and
// the inspector panel on the right. Every part reads the editor store and edits through it (store/editor.ts); App only places them.
import { RestorePrompt, useAutosave } from './Autosave';
import { ElementList, ScreenList } from './panels/screens/ScreensPanel';
import { Stage } from './Stage';
import { useEditKeys } from './shell/keys.ts';
import { Inspector } from './panels/inspector/Inspector';
import { TryPanel } from './TryPanel';
import { Panel, PanelArea, usePanelKeys } from './shell/Panel';
import { readPanels, writePanels } from './shell/panels.ts';
import { Toolbar } from './shell/Toolbar';
import { createEditorStore, type EditorStore } from './store/editor.ts';
import { EditorProvider } from './store/react.tsx';

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
    return (
        <div className="app flex h-screen flex-col overflow-hidden">
            <Toolbar autosaveProblem={saved.problem} />
            {saved.offer && <RestorePrompt onRestore={saved.restore} onDecline={saved.decline} />}
            <PanelArea>
                <Panel side="left" title="Screen file">
                    <ScreenList />
                    <ElementList />
                </Panel>
                <Stage />
                <Panel side="right" title="Inspector" className="inspector">
                    <Inspector />
                    <div className="px-3 pb-3"><TryPanel /></div>
                </Panel>
            </PanelArea>
        </div>
    );
}
