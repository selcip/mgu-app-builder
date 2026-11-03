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
import { Palette, ShowFocusToggle, Stage } from './Stage';
import { TryPanel } from './TryPanel';
import { Panel } from './shell/Panel';
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
const defaultStore = () => designerStore || (designerStore = createEditorStore());

function Designer() {
    const saved = useAutosave();
    return (
        <div className="app flex h-screen flex-col overflow-hidden">
            <Toolbar autosaveProblem={saved.problem} />
            {saved.offer && <RestorePrompt onRestore={saved.restore} onDecline={saved.decline} />}
            <main className="flex min-h-0 flex-1">
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
            </main>
        </div>
    );
}
