import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
    createHistory, dispatch, exportZip, firstScreenOf, importZip, newDocument, themeOf, titleOf,
    type Doc, type Element, type History, type Op, type Screen,
} from './model/index.ts';
import { THEMES, WIDGETS, widget } from './catalog.ts';
import { previewScreen } from './preview';
import { PropertyPanel, CommitInput } from './PropertyPanel';

const W = 1796, H = 632;   // iDrive 7, embedded in the HMI page

export function App() {
    const [history, setHistory] = useState<History>(() => createHistory(newDocument()));
    const [selected, setSelected] = useState<string>(() => firstScreenOf(history.present.file));
    const [element, setElement] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const canvas = useRef<HTMLCanvasElement>(null);
    const doc = history.present;
    const file = doc.file;

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
        setElement(null);
        setProblem(null);
    }

    async function upload(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            open(importZip(new Uint8Array(await f.arrayBuffer())));
        } catch (err) {
            setProblem((err as Error).message);
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

    // the selected screen may be gone after an edit (deleted, renamed): fall back to the first screen
    const screen: Screen | undefined = file.screens.find((s) => s.name === selected);
    useEffect(() => {
        if (!screen) setSelected(firstScreenOf(file));
    }, [screen, file]);
    const el: Element | undefined = screen && element !== null ? screen.components.find((c) => c.name === element) : undefined;

    useEffect(() => {
        if (!screen || !canvas.current) return;
        setLog(previewScreen(file, screen.name, canvas.current));
    }, [file, screen]);

    function addElement(type: string) {
        if (!screen) return;
        const n = screen.components.length;
        const before = new Set(screen.components.map((c) => c.name));
        const op: Op = { type: 'addElement', screen: screen.name, widget: type, x: 24 + (n % 12) * 24, y: 24 + (n % 12) * 24 };
        const next = edit(op);
        if (!next) return;
        const added = next.file.screens.find((s) => s.name === screen.name)!.components.find((c) => !before.has(c.name));
        if (added) setElement(added.name);
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
                {problem && <span className="problem" role="alert">{problem}</span>}
            </header>
            <main>
                <nav aria-label="Screens">
                    <ul>{file.screens.map((s) => (
                        <li key={s.name}>
                            <button data-screen={s.name} aria-current={s.name === selected}
                                onClick={() => { setSelected(s.name); setElement(null); }}>
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
                                <CommitInput value={typeof screen.title === 'string' ? screen.title : ''}
                                    onCommit={(v) => edit({ type: 'setScreenTitle', screen: screen.name, title: v })} />
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
                    <div className="hmi-page" style={{ width: W }}>
                        <div className="hmi-title" data-hmi-title="">{screen ? titleOf(screen) : ''}</div>
                        <canvas ref={canvas} width={W} height={H} />
                    </div>
                    {log.length > 0 && <ul className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                    <div className="palette" aria-label="Widgets">
                        <h2>Add a widget</h2>
                        {WIDGETS.map((wd) => (
                            <button key={wd.type} data-widget={wd.type} onClick={() => addElement(wd.type)}>{wd.label}</button>
                        ))}
                    </div>
                </section>
                <aside className="inspector">
                    <h2>Elements</h2>
                    <ul className="elements">{screen && screen.components.map((c) => (
                        <li key={c.name}>
                            <button data-element={c.name} aria-current={c.name === element} onClick={() => setElement(c.name)}>
                                {c.name} <small>{(widget(c.gpu) || { label: c.gpu }).label}</small>
                            </button>
                        </li>
                    ))}</ul>
                    {screen && el && (
                        <PropertyPanel
                            element={el}
                            onRename={(v) => { if (edit({ type: 'renameElement', screen: screen.name, element: el.name, name: v })) setElement(v); }}
                            onDelete={() => { if (edit({ type: 'deleteElement', screen: screen.name, element: el.name })) setElement(null); }}
                            onOption={(key, value) => edit({ type: 'setOption', screen: screen.name, element: el.name, key, value })}
                            onRows={(e) => edit({ ...e, screen: screen.name, element: el.name })}
                        />
                    )}
                </aside>
            </main>
        </div>
    );
}
