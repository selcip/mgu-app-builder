// The Designer's layout: the header, the screens on the left, the stage in the middle and the inspector on the
// right. Every part reads the editor store and edits through it (store/editor.ts); App only places them.
import { type ChangeEvent } from 'react';
import { exportZip, importZip, newDocument, themeOf } from './model/index.ts';
import { THEMES } from './catalog.ts';
import { ActionField } from './ActionField';
import { AutosaveProblem, RestorePrompt, useAutosave } from './Autosave';
import { ElementList } from './Elements';
import { FocusPanel } from './FocusPanel';
import { LanguageSwitcher, TextIssues } from './Languages';
import { LinkField, NavigationPanel } from './Navigation';
import { ImagesPanel } from './Pictures';
import { PropertyPanel } from './PropertyPanel';
import { ScreenList, ScreenProps } from './Screens';
import { Stage } from './Stage';
import { createEditorStore, docOf, fileOf, type EditorStore } from './store/editor.ts';
import { EditorProvider, useActions, useEditor } from './store/react.tsx';

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
        <div className="app">
            <Header autosaveProblem={saved.problem} />
            {saved.offer && <RestorePrompt onRestore={saved.restore} onDecline={saved.decline} />}
            <main>
                <nav aria-label="Screens">
                    <ScreenList />
                    <ScreenProps />
                </nav>
                <Stage />
                <aside className="inspector">
                    <h2>Elements</h2>
                    <ElementList />
                    <PropertyPanel />
                    <TextIssues />
                    <ActionField />
                    <LinkField />
                    <FocusPanel />
                    <NavigationPanel />
                    <ImagesPanel />
                </aside>
            </main>
        </div>
    );
}

function Header({ autosaveProblem }: { autosaveProblem: string | null }) {
    const doc = useEditor(docOf);
    const file = useEditor(fileOf);
    const problem = useEditor((s) => s.problem);
    const { edit, open, setProblem } = useActions();

    async function upload(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            open(importZip(new Uint8Array(await f.arrayBuffer())));
        } catch (err) {
            setProblem(`Couldn’t open ${f.name}: ${(err as Error).message} Your design is unchanged.`);
        }
    }

    function download() {
        const bytes = exportZip(doc);
        const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'design.zip';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return (
        <header>
            <h1>mgu Designer</h1>
            <button onClick={() => open(newDocument())}>New</button>
            <label className="upload">
                Open design (.zip)
                <input type="file" accept=".zip,application/zip" onChange={upload} />
            </label>
            <button onClick={download}>Download (.zip)</button>
            <label>
                Theme{' '}
                <select value={themeOf(file)} onChange={(e) => edit({ type: 'setTheme', theme: e.target.value })}>
                    {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
            </label>
            <LanguageSwitcher />
            {problem && <span className="problem" role="alert">{problem}</span>}
            <AutosaveProblem problem={autosaveProblem} />
        </header>
    );
}
