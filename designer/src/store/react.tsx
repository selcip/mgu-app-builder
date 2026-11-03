// The editor store in React: a provider for one store (the Designer's, or a story's built from a fixture), and hooks
// that read it. A selector should return state as it is or a value that compares equal (===) when nothing changed.
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { EditorState, EditorStore } from './editor.ts';

const Store = createContext<EditorStore | null>(null);

export function EditorProvider({ store, children }: { store: EditorStore; children: ReactNode }) {
    return <Store.Provider value={store}>{children}</Store.Provider>;
}

/** The store itself, for actions and for reading state in event handlers without re-rendering on it. */
export function useEditorStore(): EditorStore {
    const store = useContext(Store);
    if (!store) throw new Error('useEditor outside an EditorProvider');
    return store;
}

/** A piece of the editor's state; the component re-renders when it changes. */
export function useEditor<T>(select: (s: EditorState) => T): T {
    return useStore(useEditorStore(), select);
}

/** The editor's actions (they never change, so reading them never re-renders). */
export function useActions(): EditorState {
    return useEditorStore().getState();
}
