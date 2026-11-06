// The editor's state: the document's history, what is selected, the canvas settings, the clipboard, the edit being
// dragged, the language shown, and trying. Every panel reads it and edits through it, so no panel needs the document
// or edit() handed down. Plain TypeScript over zustand/vanilla (no React), so Node runs it in the tests; the React
// binding is ./react.tsx.
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
    canRedo, canUndo, createHistory, dispatch, firstScreenOf, kindOf as docKindOf, languagesOf, layoutScreen, newDocument, redo, undo,
    type ClusterLayout, type DocKind,
    type Doc, type Element, type History, type Op, type Screen, type ScreenFile,
} from '../model/index.ts';
import type { Lines } from '../canvas/snap.ts';
import type { Action, ScreenChange } from '../preview.ts';
import { centred, fitted, stepZoom, zoomAbout, type Size, type View } from '../shell/view.ts';
import { DRIVE_MODES, clampSignal, defaultSignals, type DriveMode, type Signals } from './signals.ts';
import { DEFAULT_PANELS, clampWidth, leftInset, type PanelLayout, type PanelLayouts, type Side } from '../shell/panels.ts';

/** The app's box on iDrive 7, inside the HMI page. */
export const DESIGN = { w: 1796, h: 632 } as const;

export interface CanvasSettings {
    grid: number;           // px; 0 = off
    snap: boolean;          // to edges, centres and guides
    guides: Lines;
}

/** What was copied, and from which screen (pasting there again moves each paste a little further). */
export interface Clipboard {
    /** Which kind of document it was copied in: elements of a screen file and of a cluster layout don't mix. */
    kind?: DocKind;
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
    /** While trying a cluster layout: the demo signals the sliders hold, and whether the demo drive moves them instead. */
    signals: Signals;
    demoDrive: boolean;
    /** The canvas's zoom and where the HMI page sits; null until the canvas is first measured (then: centred at 100 %, or fitted when that is too big). */
    view: View | null;
    /** The canvas's size and the HMI page's (unzoomed), as last measured; null until then. */
    measure: { canvas: Size; page: Size } | null;
    /** Each panel docked or floating, its width, where it floats, collapsed or not. */
    panels: PanelLayouts;
    /** Both panels hidden (Ctrl+\), to see the screen alone. */
    panelsHidden: boolean;
    /** The inspector's tab: the element's layout and options, or its action, link and the screen's focus order. */
    inspectorTab: 'design' | 'prototype';

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
    /** Starts trying (afresh: no reports; the panels step aside) or stops (back to editing the screen the walk ended on). */
    setTrying(on: boolean): void;
    setWalking(screen: string | null): void;
    /** Sets a slider (clamped to its range) or the drive mode of the demo signals. */
    setSignal(key: string, value: number | string): void;
    /** Starts or stops the demo drive (the kit's simulated drive) in place of the sliders. */
    setDemoDrive(on: boolean): void;
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
    /** Changes a panel's layout; the HMI page stays where it is on screen when the canvas's left edge moves. */
    setPanel(side: Side, patch: Partial<PanelLayout>): void;
    togglePanelsHidden(): void;
    setInspectorTab(tab: 'design' | 'prototype'): void;
}

export type EditorStore = StoreApi<EditorState>;

/** The selected screen once `file` replaced the old one: renamed with it, else kept, else the first screen. */
function followScreen(file: ScreenFile, selected: string, op: Op | null): string {
    if (op && op.type === 'renameScreen' && op.screen === selected) selected = op.name;
    return file.screens.some((s) => s.name === selected) ? selected : firstScreenOf(file);
}

export interface EditorOptions {
    /** The panel layouts to start with (the ones the browser kept). */
    panels?: PanelLayouts;
}

export function createEditorStore(doc: Doc = newDocument(), options: EditorOptions = {}): EditorStore {
    return createStore<EditorState>()((set, get) => {
        /** New panel layouts; the view moves by as much as the canvas's left edge did, so the page stays put. */
        function layOut(panels: PanelLayouts, panelsHidden: boolean, trying = get().trying) {
            const s = get();
            // while trying the panels are out of the way, as if hidden
            const dx = leftInset(s.panels, s.panelsHidden || s.trying) - leftInset(panels, panelsHidden || trying);
            set({ panels, panelsHidden, trying, view: s.view && dx ? { ...s.view, x: s.view.x + dx } : s.view });
        }
        /** A new history: the selected screen follows it, and the selection keeps only elements still on it. */
        function moveTo(history: History, op: Op | null) {
            const s = get();
            const file = screenFileOf(history.present);
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
            selected: firstScreenOf(screenFileOf(doc)),
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
            signals: defaultSignals(),
            demoDrive: false,
            view: null,
            measure: null,
            panels: options.panels || DEFAULT_PANELS,
            panelsHidden: false,
            inspectorTab: 'design',

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
                set({ history: createHistory(d), selected: firstScreenOf(screenFileOf(d)), selection: [], problem: null, dragOp: null });
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
                const added = screenFileOf(next).screens.find((s) => s.name === screen.name)!.components.find((c) => !before.has(c.name));
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
                if (on === s.trying) return;
                if (!on && s.walking !== null && s.walking !== s.selected) s.selectScreen(s.walking);
                set({ dragOp: null, reports: on ? [] : s.reports, demoDrive: false });
                layOut(s.panels, s.panelsHidden, on);       // the panels step aside while trying, the page stays put
            },
            setWalking(walking) { set({ walking }); },
            setSignal(key, value) {
                if (key === 'drive') {
                    if (DRIVE_MODES.some((m) => m.id === value)) set((s) => ({ signals: { ...s.signals, drive: value as DriveMode } }));
                    return;
                }
                const v = typeof value === 'number' ? clampSignal(key, value) : null;
                if (v !== null) set((s) => ({ signals: { ...s.signals, [key]: v } }));
            },
            setDemoDrive(demoDrive) { set({ demoDrive }); },
            report(r) { set((s) => ({ reports: s.reports.concat([r]).slice(-REPORTS) })); },
            clearReports() { set({ reports: [] }); },
            setMeasure(canvas, page) {
                const s = get();
                // first measured: 100 %, centred, when the page fits; else as large as fits
                const fits = page.w <= canvas.w && page.h <= canvas.h;
                set({ measure: { canvas, page }, view: s.view || (fits ? centred(canvas, page, 1) : fitted(canvas, page)) });
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
            setPanel(side, patch) {
                const s = get();
                const p = { ...s.panels[side], ...patch };
                if (patch.width !== undefined) p.width = clampWidth(patch.width);
                layOut({ ...s.panels, [side]: p }, s.panelsHidden);
            },
            togglePanelsHidden() { layOut(get().panels, !get().panelsHidden); },
            setInspectorTab(inspectorTab) { set({ inspectorTab }); },
        };
    });
}

// derived state, for selectors

/**
 * What the shared canvas, element list and editing commands read while a cluster layout is open: one screen whose
 * elements are the layout's widgets (model/ops/cluster-elements.ts).
 */
const layoutFiles = new WeakMap<ClusterLayout, ScreenFile>();
function screenFileOf(doc: Doc): ScreenFile {
    if (doc.kind !== 'cluster-layout') return doc.file;
    let f = layoutFiles.get(doc.layout);
    if (!f) layoutFiles.set(doc.layout, (f = { screens: [layoutScreen(doc.layout)] }));
    return f;
}

export const docOf = (s: EditorState): Doc => s.history.present;
export const fileOf = (s: EditorState): ScreenFile => screenFileOf(s.history.present);
/** Which kind of document is open. */
export const kindOf = (s: EditorState): DocKind => docKindOf(s.history.present);
/** The open cluster layout, or null when a screen file is open. */
export const layoutOf = (s: EditorState): ClusterLayout | null => { const d = s.history.present; return d.kind === 'cluster-layout' ? d.layout : null; };
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
