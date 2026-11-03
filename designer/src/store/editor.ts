// The editor's state: the document's history, what is selected, the canvas settings, the clipboard, the edit being
// dragged, the language shown, and trying. Every panel reads it and edits through it, so no panel needs the document
// or edit() handed down. Plain TypeScript over zustand/vanilla (no React), so Node runs it in the tests; the React
// binding is ./react.tsx.
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
    canRedo, canUndo, createHistory, dispatch, firstScreenOf, languagesOf, newDocument, redo, undo,
    type Doc, type Element, type History, type Op, type Screen, type ScreenFile,
} from '../model/index.ts';
import type { Lines } from '../canvas/snap.ts';
import type { Action, ScreenChange } from '../preview.ts';
import { centred, fitted, stepZoom, zoomAbout, type Size, type View } from '../shell/view.ts';

/** The app's box on iDrive 7, inside the HMI page. */
export const DESIGN = { w: 1796, h: 632 } as const;

export interface CanvasSettings {
    grid: number;           // px; 0 = off
    snap: boolean;          // to edges, centres and guides
    guides: Lines;
}

/** What was copied, and from which screen (pasting there again moves each paste a little further). */
export interface Clipboard {
    screen: string;
    elements: Element[];
    pastes: number;
}

/** One thing the runtime reported while trying. */
export type Report = { action: Action } | { change: ScreenChange } | { leave: string };

const REPORTS = 50;     // the reports kept while trying

export interface EditorState {
    history: History;
    /** The screen being edited; always one of the file's screens. */
    selected: string;
    /** The selected elements of that screen. */
    selection: string[];
    settings: CanvasSettings;
    showFocus: boolean;
    clipboard: Clipboard | null;
    /** The canvas edit being dragged, previewed until committed. */
    dragOp: Op | null;
    /** The last refused edit's message (or a failed upload's), shown until the next edit. */
    problem: string | null;
    /** The language picked to show and edit; see languageOf. */
    picked: string | null;
    trying: boolean;
    reports: Report[];
    /** While trying: the screen the runtime shows. */
    walking: string | null;
    /** The canvas's zoom and where the HMI page sits; null until the canvas is first measured (then: centred, 100 %). */
    view: View | null;
    /** The canvas's size and the HMI page's (unzoomed), as last measured; null until then. */
    measure: { canvas: Size; page: Size } | null;

    /** Applies an edit; a refusal sets `problem` and changes nothing. Returns the edited document, or null if refused. */
    edit(op: Op): Doc | null;
    undo(): void;
    redo(): void;
    /** Opens a document with a fresh history, its first screen selected. */
    open(doc: Doc): void;
    setProblem(problem: string | null): void;
    selectScreen(screen: string): void;
    select(elements: string[]): void;
    /** Selects one element of the screen, or none. */
    selectOnly(element: string | null): void;
    /** Shows a screen with one of its elements selected (or none), and optionally a language. */
    goTo(screen: string, element: string | null, language?: string | null): void;
    /** Adds a widget to the screen, a little below and right of the last one added, and selects it. */
    addElement(widget: string): void;
    setSettings(settings: CanvasSettings): void;
    setGuides(guides: Lines): void;
    setShowFocus(show: boolean): void;
    setClipboard(clipboard: Clipboard | null): void;
    setDragOp(op: Op | null): void;
    pick(language: string | null): void;
    /** Starts or stops trying; stopping goes back to editing the screen the walk ended on. */
    setTrying(on: boolean): void;
    setWalking(screen: string | null): void;
    report(r: Report): void;
    clearReports(): void;
    setMeasure(canvas: Size, page: Size): void;
    setView(view: View): void;
    /** Zooms to `zoom` about a point of the canvas (its middle when none given). */
    zoomTo(zoom: number, at?: { x: number; y: number }): void;
    /** The next zoom level up or down, about the canvas's middle. */
    zoomStep(dir: 1 | -1): void;
    /** The page as large as fits in the canvas. */
    zoomToFit(): void;
    panBy(dx: number, dy: number): void;
}

export type EditorStore = StoreApi<EditorState>;

/** The selected screen once `file` replaced the old one: renamed with it, else kept, else the first screen. */
function followScreen(file: ScreenFile, selected: string, op: Op | null): string {
    if (op && op.type === 'renameScreen' && op.screen === selected) selected = op.name;
    return file.screens.some((s) => s.name === selected) ? selected : firstScreenOf(file);
}

export function createEditorStore(doc: Doc = newDocument()): EditorStore {
    return createStore<EditorState>()((set, get) => {
        /** A new history: the selected screen follows it, and the selection keeps only elements still on it. */
        function moveTo(history: History, op: Op | null) {
            const s = get();
            const file = history.present.file;
            const selected = followScreen(file, s.selected, op);
            const screen = file.screens.find((x) => x.name === selected)!;
            let selection = selected === s.selected ? s.selection : [];
            if (op && op.type === 'renameElement' && op.screen === s.selected) {
                selection = selection.map((n) => (n === op.element ? op.name : n));
            }
            selection = selection.filter((n) => screen.components.some((c) => c.name === n));
            set({ history, selected, selection, problem: null });
        }

        return {
            history: createHistory(doc),
            selected: firstScreenOf(doc.file),
            selection: [],
            settings: { grid: 8, snap: true, guides: { xs: [], ys: [] } },
            showFocus: true,
            clipboard: null,
            dragOp: null,
            problem: null,
            picked: null,
            trying: false,
            reports: [],
            walking: null,
            view: null,
            measure: null,

            edit(op) {
                let next: History;
                try {
                    next = dispatch(get().history, op);
                } catch (err) {
                    set({ problem: (err as Error).message });
                    return null;
                }
                moveTo(next, op);
                return next.present;
            },
            undo() { if (canUndo(get().history)) moveTo(undo(get().history), null); },
            redo() { if (canRedo(get().history)) moveTo(redo(get().history), null); },
            open(d) {
                set({ history: createHistory(d), selected: firstScreenOf(d.file), selection: [], problem: null, dragOp: null });
            },
            setProblem(problem) { set({ problem }); },
            selectScreen(screen) {
                if (fileOf(get()).screens.some((s) => s.name === screen)) set({ selected: screen, selection: [] });
            },
            select(elements) { set({ selection: elements }); },
            selectOnly(element) { set({ selection: element === null ? [] : [element] }); },
            goTo(screen, element, language) {
                get().selectScreen(screen);
                get().selectOnly(element);
                if (language) set({ picked: language });
            },
            addElement(widget) {
                const screen = screenOf(get());
                const n = screen.components.length;
                const before = new Set(screen.components.map((c) => c.name));
                const next = get().edit({ type: 'addElement', screen: screen.name, widget, x: 24 + (n % 12) * 24, y: 24 + (n % 12) * 24 });
                if (!next) return;
                const added = next.file.screens.find((s) => s.name === screen.name)!.components.find((c) => !before.has(c.name));
                if (added) get().selectOnly(added.name);
            },
            setSettings(settings) { set({ settings }); },
            setGuides(guides) { set((s) => ({ settings: { ...s.settings, guides } })); },
            setShowFocus(showFocus) { set({ showFocus }); },
            setClipboard(clipboard) { set({ clipboard }); },
            setDragOp(dragOp) { set({ dragOp }); },
            pick(picked) { set({ picked }); },
            setTrying(on) {
                const s = get();
                if (!on && s.walking !== null && s.walking !== s.selected) s.selectScreen(s.walking);
                set({ trying: on, dragOp: null });
            },
            setWalking(walking) { set({ walking }); },
            report(r) { set((s) => ({ reports: s.reports.concat([r]).slice(-REPORTS) })); },
            clearReports() { set({ reports: [] }); },
            setMeasure(canvas, page) {
                const s = get();
                set({ measure: { canvas, page }, view: s.view || centred(canvas, page, 1) });
            },
            setView(view) { set({ view }); },
            zoomTo(zoom, at) {
                const { view, measure } = get();
                if (!view || !measure) return;
                const p = at || { x: measure.canvas.w / 2, y: measure.canvas.h / 2 };
                set({ view: zoomAbout(view, zoom, p.x, p.y) });
            },
            zoomStep(dir) { const v = get().view; if (v) get().zoomTo(stepZoom(v.zoom, dir)); },
            zoomToFit() { const m = get().measure; if (m) set({ view: fitted(m.canvas, m.page) }); },
            panBy(dx, dy) { const v = get().view; if (v) set({ view: { ...v, x: v.x + dx, y: v.y + dy } }); },
        };
    });
}

// derived state, for selectors

export const docOf = (s: EditorState): Doc => s.history.present;
export const fileOf = (s: EditorState): ScreenFile => s.history.present.file;
export const screenOf = (s: EditorState): Screen => fileOf(s).screens.find((x) => x.name === s.selected)!;
/** The one selected element, or undefined when none or several are selected. */
export const elementOf = (s: EditorState): Element | undefined =>
    s.selection.length === 1 ? screenOf(s).components.find((c) => c.name === s.selection[0]) : undefined;
export const canUndoOf = (s: EditorState) => canUndo(s.history);
export const canRedoOf = (s: EditorState) => canRedo(s.history);

/** The language shown: the one picked if the file has it, else the default (null when the file has none). */
export function shownLanguage(file: ScreenFile, picked: string | null): string | null {
    const langs = languagesOf(file);
    return picked !== null && langs.includes(picked) ? picked : langs.length ? langs[0] : null;
}
export const languageOf = (s: EditorState) => shownLanguage(fileOf(s), s.picked);
