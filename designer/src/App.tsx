import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { readDesignZip, type Design } from './zip';
import { firstScreen, titleOf } from './screenFile';
import { previewScreen } from './preview';

const W = 1796, H = 632;   // iDrive 7, embedded in the HMI page

export function App() {
    const [design, setDesign] = useState<Design | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const canvas = useRef<HTMLCanvasElement>(null);

    async function upload(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            const d = readDesignZip(new Uint8Array(await f.arrayBuffer()));
            setProblem(null);
            setDesign(d);
            setSelected(firstScreen(d.file));
        } catch (err) {
            setProblem((err as Error).message);
        }
    }

    useEffect(() => {
        if (!design || !selected || !canvas.current) return;
        setLog(previewScreen(design.file, selected, canvas.current));
    }, [design, selected]);

    const screen = design && design.file.screens.find((s) => s.name === selected);

    return (
        <div className="app">
            <header>
                <h1>mgu Designer</h1>
                <label className="upload">
                    Open design (.zip)
                    <input type="file" accept=".zip,application/zip" onChange={upload} />
                </label>
                {problem && <span className="problem" role="alert">{problem}</span>}
            </header>
            <main>
                <nav aria-label="Screens">
                    {design
                        ? <ul>{design.file.screens.map((s) => (
                            <li key={s.name}>
                                <button data-screen={s.name} aria-current={s.name === selected} onClick={() => setSelected(s.name)}>
                                    {s.name}
                                </button>
                            </li>
                        ))}</ul>
                        : <p className="hint">Open a zip with screens.json (and images/) to see its screens.</p>}
                </nav>
                <section className="stage">
                    <div className="hmi-page" style={{ width: W }}>
                        <div className="hmi-title" data-hmi-title="">{screen ? titleOf(screen) : ''}</div>
                        <canvas ref={canvas} width={W} height={H} />
                    </div>
                    {log.length > 0 && <ul className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                </section>
            </main>
        </div>
    );
}
