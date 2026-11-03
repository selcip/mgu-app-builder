// Every story renders inside an editor store made from a fixture screen file, in the Designer's dark appearance.
// A story names its screen file with `parameters.screenFile` (the empty one when it names none) and can set the
// store up further (select a screen, an element, a language) with `parameters.editor`.
import type { Decorator, Preview } from '@storybook/react-vite';
import type { Doc } from '../src/model/index.ts';
import { empty } from '../src/fixtures/screen-files.ts';
import { createEditorStore, type EditorState, type EditorStore } from '../src/store/editor.ts';
import { EditorProvider } from '../src/store/react.tsx';
import '../src/index.css';
import '../src/styles.css';

document.documentElement.classList.add('dark');

/** One store per story, kept while the story is open, so edits made in it last until it is reloaded. */
const stores = new Map<string, EditorStore>();

const withEditor: Decorator = (Story, { id, parameters }) => {
    let store = stores.get(id);
    if (!store) {
        store = createEditorStore((parameters.screenFile as Doc | undefined) || empty);
        (parameters.editor as ((s: EditorState) => void) | undefined)?.(store.getState());
        stores.set(id, store);
    }
    return (
        <EditorProvider store={store}>
            <div className="bg-background p-4 text-foreground">
                <Story />
            </div>
        </EditorProvider>
    );
};

const preview: Preview = {
    decorators: [withEditor],
    parameters: { layout: 'fullscreen' },
};

export default preview;
