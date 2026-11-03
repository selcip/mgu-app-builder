// The selected screen's name, title, making it first, duplicating and deleting it.
import { firstScreenOf } from './model/index.ts';
import { CommitInput } from './PropertyPanel';
import { TextInput } from './Languages';
import { fileOf, screenOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';

export function ScreenProps() {
    const file = useEditor(fileOf);
    const screen = useEditor(screenOf);
    const { edit } = useActions();
    return (
        <div className="screen-props" data-screen-props="">
            <h2>Screen</h2>
            <label data-screen-name="">Name
                <CommitInput value={screen.name} onCommit={(name) => edit({ type: 'renameScreen', screen: screen.name, name })} />
            </label>
            <label>Title
                <TextInput value={screen.title} onCommit={(value, language) => edit({ type: 'setText', screen: screen.name, language, value })} />
            </label>
            <div className="row-buttons">
                <button disabled={screen.name === firstScreenOf(file)}
                    onClick={() => edit({ type: 'setFirstScreen', screen: screen.name })}>Make first</button>
                <button onClick={() => edit({ type: 'duplicateScreen', screen: screen.name })}>Duplicate</button>
                <button data-delete-screen="" disabled={file.screens.length < 2}
                    onClick={() => edit({ type: 'deleteScreen', screen: screen.name })}>Delete</button>
            </div>
        </div>
    );
}
