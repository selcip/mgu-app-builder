// The Designer's layout: the toolbar across the top, the screens panel on the left, the canvas in the middle and
// the inspector panel on the right. Every part reads the editor store and edits through it (store/editor.ts); App only places them.
import { ActionField } from './ActionField';
import { RestorePrompt, useAutosave } from './Autosave';
import { ElementList } from './Elements';
import { FocusPanel } from './FocusPanel';
import { TextIssues } from './Languages';
import { LinkField, NavigationPanel } from './Navigation';
import { ImagesPanel } from './Pictures';
import { PropertyPanel } from './PropertyPanel';
import { ScreenList, ScreenProps } from './Screens';
import { EditBarRow, Palette, ShowFocusToggle, Stage } from './Stage';
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
    return (
        <div className="app flex h-screen flex-col overflow-hidden">
            <Toolbar autosaveProblem={saved.problem} />
            {saved.offer && <RestorePrompt onRestore={saved.restore} onDecline={saved.decline} />}
            <EditBarRow />
            <PanelArea>
                <Panel side="left" title="Screens">
                    <nav aria-label="Screens" className="screens">
                        <ScreenList />
                    </nav>
                    <ScreenProps />
                    <Palette />
                </Panel>
                <Stage />
                <Panel side="right" title="Inspector" className="inspector">
                    <h2>Elements</h2>
                    <ElementList />
                    <PropertyPanel />
                    <TextIssues />
                    <ActionField />
                    <LinkField />
                    <FocusPanel />
                    <ShowFocusToggle />
                    <NavigationPanel />
                    <ImagesPanel />
                    <TryPanel />
                </Panel>
            </PanelArea>
        </div>
    );
}
