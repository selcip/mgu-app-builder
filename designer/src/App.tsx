import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';
import {
    apply, canRedo, canUndo, createHistory, dispatch, exportZip, firstScreenOf, imagePathFor, importZip, languagesOf, missingImages, newDocument, redo,
    textIn, themeOf, titleOf, undo,
    type Doc, type Element, type History, type Op, type Screen,
} from './model/index.ts';
import { THEMES, WIDGETS, widget } from './catalog.ts';
import { startPreview, type Action, type Preview } from './preview';
import { FocusOverlay } from './FocusOverlay';
import { FocusPanel } from './FocusPanel';
import { ActionField } from './ActionField';
import { TryPanel, controllerKey } from './TryPanel';
import { PropertyPanel, CommitInput } from './PropertyPanel';
import { LanguageSwitcher, TextInput, TextIssues, shownLanguage } from './Languages';
import { Canvas, WIDGET_DRAG_TYPE, type CanvasSettings } from './Canvas';
import { EditBar, type Clipboard } from './EditBar';
import { ImagesPanel } from './Pictures';
import { AutosaveProblem, RestorePrompt, useAutosave } from './Autosave';

const W = 1796, H = 632;   // iDrive 7, embedded in the HMI page

export function App() {
    const [history, setHistory] = useState<History>(() => createHistory(newDocument()));
    const [selected, setSelected] = useState<string>(() => firstScreenOf(history.present.file));
    const [selection, setSelection] = useState<string[]>([]);
    const [settings, setSettings] = useState<CanvasSettings>({ grid: 8, snap: true, guides: { xs: [], ys: [] } });
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [dragOp, setDragOp] = useState<Op | null>(null);     // the canvas edit being dragged, previewed until committed
    const [problem, setProblem] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [picked, setPicked] = useState<string | null>(null);     // the language shown and edited
    const canvas = useRef<HTMLCanvasElement>(null);
    const preview = useRef<Preview | null>(null);
    const stage = useRef<HTMLDivElement>(null);
    const [trying, setTrying] = useState(false);
    const [showFocus, setShowFocus] = useState(true);
    const [actions, setActions] = useState<Action[]>([]);
    const doc = history.present;
    const file = doc.file;
    const language = shownLanguage(file, picked);

    /** Applies an edit; a refusal is shown and changes nothing. Returns the edited document, or null if refused. */
    function edit(op: Op): Doc | null {
        try {
            const next = dispatch(history, op);
            setHistory(next);
            setProblem(null);
            return next.present;
        } catch (err) {
            setProblem((err as Error).message);
            return null;
        }
    }

    function open(d: Doc) {
        setHistory(createHistory(d));
        setSelected(firstScreenOf(d.file));
        setSelection([]);
        setProblem(null);
    }

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

    const saved = useAutosave(doc, open);

    // the selected screen may be gone after an edit (deleted, renamed): fall back to the first screen
    const screen: Screen | undefined = file.screens.find((s) => s.name === selected);
    useEffect(() => {
        if (!screen) setSelected(firstScreenOf(file));
    }, [screen, file]);
    const selected1 = selection.length === 1 ? selection[0] : null;
    const el: Element | undefined = screen && selected1 !== null ? screen.components.find((c) => c.name === selected1) : undefined;

    useEffect(() => {
        if (!screen || !canvas.current) return;
        let shown = file;
        if (dragOp && !trying) {
            try { shown = apply(doc, dragOp).file; } catch { /* refused: show the file as it is */ }
        }
        const p = startPreview(shown, screen.name, canvas.current, doc.images, language,
            (a) => setActions((l) => l.concat([a]).slice(-50)));
        preview.current = p;
        setLog(p.lines);
    }, [doc, file, screen, dragOp, language, trying]);     // trying starts the screen afresh, and so does stopping

    // trying the screen: keys as the iDrive controller, pointer down/up on the canvas as touches (in screen px)
    function onKey(e: KeyboardEvent) {
        const input = trying ? controllerKey(e.key) : null;
        if (!input || !preview.current) return;
        e.preventDefault();
        preview.current.controller(input);
    }
    function onPointer(e: PointerEvent<HTMLCanvasElement>, phase: 'down' | 'move' | 'up') {
        if (!trying || !preview.current || (phase === 'move' && !e.buttons)) return;
        const r = e.currentTarget.getBoundingClientRect();
        preview.current.touch(phase, (e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
    }

    const editOk = (op: Op) => edit(op) !== null;
    const setGuides = useCallback((guides: CanvasSettings['guides']) => setSettings((s) => ({ ...s, guides })), []);
    const selectOnly = (name: string | null) => setSelection(name === null ? [] : [name]);

    /** The title the HMI page shows in the shown language (the screen's name when it has none). */
    function shownTitle(s: Screen): string {
        const langs = languagesOf(file);
        const t = langs.length && language ? textIn(s.title, langs, language) : s.title;
        return typeof t === 'string' && t ? t : titleOf(s);
    }

    function addElement(type: string) {
        if (!screen) return;
        const n = screen.components.length;
        const before = new Set(screen.components.map((c) => c.name));
        const op: Op = { type: 'addElement', screen: screen.name, widget: type, x: 24 + (n % 12) * 24, y: 24 + (n % 12) * 24 };
        const next = edit(op);
        if (!next) return;
        const added = next.file.screens.find((s) => s.name === screen.name)!.components.find((c) => !before.has(c.name));
        if (added) selectOnly(added.name);
    }

    return (
        <div className="app">
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
                <LanguageSwitcher file={file} language={language} onLanguage={setPicked} edit={edit} />
                {problem && <span className="problem" role="alert">{problem}</span>}
                <AutosaveProblem problem={saved.problem} />
            </header>
            {saved.offer && <RestorePrompt onRestore={saved.restore} onDecline={saved.decline} />}
            <main>
                <nav aria-label="Screens">
                    <ul>{file.screens.map((s) => (
                        <li key={s.name}>
                            <button data-screen={s.name} aria-current={s.name === selected}
                                onClick={() => { setSelected(s.name); setSelection([]); }}>
                                {s.name}{s.name === firstScreenOf(file) ? ' (first)' : ''}
                            </button>
                        </li>
                    ))}</ul>
                    <button onClick={() => edit({ type: 'addScreen' })}>Add screen</button>
                    {screen && (
                        <div className="screen-props">
                            <h2>Screen</h2>
                            <label>Name
                                <CommitInput value={screen.name} onCommit={(v) => {
                                    if (edit({ type: 'renameScreen', screen: screen.name, name: v })) setSelected(v);
                                }} />
                            </label>
                            <label>Title
                                <TextInput file={file} language={language} value={screen.title}
                                    onCommit={(v) => edit({ type: 'setText', screen: screen.name, language: language || undefined, value: v })} />
                            </label>
                            <div className="row-buttons">
                                <button disabled={screen.name === firstScreenOf(file)}
                                    onClick={() => edit({ type: 'setFirstScreen', screen: screen.name })}>Make first</button>
                                <button onClick={() => edit({ type: 'duplicateScreen', screen: screen.name })}>Duplicate</button>
                                <button disabled={file.screens.length < 2}
                                    onClick={() => edit({ type: 'deleteScreen', screen: screen.name })}>Delete</button>
                            </div>
                        </div>
                    )}
                </nav>
                <section className="stage">
                    {screen && !trying && (     // trying: no canvas editing, and the keys are the controller's
                        <EditBar screen={screen} design={{ w: W, h: H }} selection={selection} settings={settings} clipboard={clipboard}
                            canUndo={canUndo(history)} canRedo={canRedo(history)} onEdit={editOk}
                            onUndo={() => setHistory(undo(history))} onRedo={() => setHistory(redo(history))}
                            onSelect={setSelection} onSettings={setSettings} onClipboard={setClipboard} />
                    )}
                    <div className="hmi-page" ref={stage} style={{ width: W }} tabIndex={0} onKeyDown={onKey} data-trying={trying}>
                        <div className="hmi-title" data-hmi-title="">{screen ? shownTitle(screen) : ''}</div>
                        {screen && !trying ? (
                            <Canvas screen={screen} design={{ w: W, h: H }} selection={selection} settings={settings}
                                onSelect={setSelection} onEdit={editOk} onDrag={setDragOp} onGuides={setGuides}>
                                <canvas ref={canvas} width={W} height={H} />
                                {showFocus && <FocusOverlay screen={screen} />}
                            </Canvas>
                        ) : (
                            <div className="canvas-wrap">
                                <canvas ref={canvas} width={W} height={H}
                                    onPointerDown={(e) => onPointer(e, 'down')} onPointerMove={(e) => onPointer(e, 'move')}
                                    onPointerUp={(e) => onPointer(e, 'up')} />
                            </div>
                        )}
                    </div>
                    <div className="row-buttons">
                        <label><input type="checkbox" checked={showFocus} onChange={(e) => setShowFocus(e.target.checked)} /> Show focus order</label>
                    </div>
                    <TryPanel trying={trying} onTrying={(on) => { setTrying(on); setDragOp(null); if (on) stage.current?.focus(); }}
                        actions={actions} onClear={() => setActions([])} />
                    {log.length > 0 && <ul className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                    <div className="palette" aria-label="Widgets">
                        <h2>Add a widget</h2>
                        {WIDGETS.map((wd) => (
                            <button key={wd.type} data-widget={wd.type} onClick={() => addElement(wd.type)} draggable
                                title="Click to add, or drag onto the screen"
                                onDragStart={(e) => { e.dataTransfer.setData(WIDGET_DRAG_TYPE, wd.type); e.dataTransfer.effectAllowed = 'copy'; }}>
                                {wd.label}
                            </button>
                        ))}
                    </div>
                </section>
                <aside className="inspector">
                    <h2>Elements</h2>
                    <ul className="elements">{screen && screen.components.map((c) => (
                        <li key={c.name}>
                            <button data-element={c.name} aria-current={selection.includes(c.name)} title="Shift- or Ctrl-click to select several"
                                onClick={(e) => setSelection(e.shiftKey || e.metaKey || e.ctrlKey
                                    ? (selection.includes(c.name) ? selection.filter((n) => n !== c.name) : selection.concat([c.name]))
                                    : [c.name])}>
                                {c.name} <small>{(widget(c.gpu) || { label: c.gpu }).label}</small>
                            </button>
                        </li>
                    ))}</ul>
                    {screen && el && (
                        <PropertyPanel
                            element={el}
                            onRename={(v) => { if (edit({ type: 'renameElement', screen: screen.name, element: el.name, name: v })) selectOnly(v); }}
                            onDelete={() => { if (edit({ type: 'deleteElement', screen: screen.name, element: el.name })) selectOnly(null); }}
                            onOption={(key, value) => edit({ type: 'setOption', screen: screen.name, element: el.name, key, value })}
                            onRows={(e) => edit({ ...e, screen: screen.name, element: el.name })}
                            renderText={(o, value) => (
                                <TextInput file={file} language={language} value={value}
                                    onCommit={(v) => edit({ type: 'setText', screen: screen.name, element: el.name, key: o.key, language: language || undefined, value: v })} />
                            )}
                            images={doc.images}
                            onUploadPicture={(key, name, bytes) => edit({
                                type: 'uploadPicture', screen: screen.name, element: el.name, key, path: imagePathFor(name), bytes,
                            })}
                        />
                    )}
                    <TextIssues file={file} onSelect={(p, l) => {
                        setSelected(p.screen);
                        selectOnly(p.element === undefined ? null : p.element);
                        if (l) setPicked(l);
                    }} />
                    {screen && el && <ActionField screen={screen.name} element={el} edit={edit} />}
                    {screen && <FocusPanel screen={screen} edit={edit} />}
                    <ImagesPanel doc={doc} missing={missingImages(doc)}
                        onAdd={(name, bytes) => edit({ type: 'addImage', path: imagePathFor(name), bytes })}
                        onRemove={(p) => edit({ type: 'removeImage', path: p })} />
                </aside>
            </main>
        </div>
    );
}
