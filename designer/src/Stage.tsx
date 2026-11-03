// The stage: the edit bar, and the selected screen in its HMI page on the zoomable canvas, drawn by the runtime and
// the kit, with the layout overlay over it (or, while trying, the iDrive controller's keys and taps going to the
// runtime). Also the widget palette and the focus-order toggle, which the panels show.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { apply, languagesOf, textIn, titleOf, type Screen } from './model/index.ts';
import { WIDGETS } from './catalog.ts';
import { startPreview, type Preview } from './preview';
import { Canvas, WIDGET_DRAG_TYPE } from './Canvas';
import { EditBar } from './EditBar';
import { FocusOverlay } from './FocusOverlay';
import { controllerKey } from './TryPanel';
import { Viewport } from './shell/Viewport';
import { DESIGN, docOf, fileOf, languageOf, screenOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';

const { w: W, h: H } = DESIGN;

export function Stage() {
    const doc = useEditor(docOf);
    const file = useEditor(fileOf);
    const screen = useEditor(screenOf);
    const dragOp = useEditor((s) => s.dragOp);
    const language = useEditor(languageOf);
    const trying = useEditor((s) => s.trying);
    const walking = useEditor((s) => s.walking);
    const showFocus = useEditor((s) => s.showFocus);
    const { setWalking, report } = useActions();
    const canvas = useRef<HTMLCanvasElement>(null);
    const preview = useRef<Preview | null>(null);
    const stage = useRef<HTMLDivElement>(null);
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        if (!canvas.current) return;
        let shown = file;
        if (dragOp && !trying) {
            try { shown = apply(doc, dragOp).file; } catch { /* refused: show the file as it is */ }
        }
        // trying walks through the app: from the first screen to this one, then wherever links and BACK lead
        const p = startPreview(shown, screen.name, canvas.current, {
            images: doc.images, language, walk: trying,
            onScreen: (c) => { setWalking(c.screen); if (trying) report({ change: c }); },
            onAction: trying ? (a) => report({ action: a }) : undefined,
            onLeave: trying ? (n) => report({ leave: n }) : undefined,
        });
        preview.current = p;
        setLog(p.lines);
    }, [doc, file, screen, dragOp, language, trying, setWalking, report]);     // trying starts the screen afresh, and so does stopping
    useEffect(() => { if (trying) stage.current?.focus({ preventScroll: true }); }, [trying]);

    // the screen the HMI page shows: while trying, the one the walk has reached
    const shownScreen: Screen = trying && walking !== null ? file.screens.find((s) => s.name === walking) || screen : screen;

    /** The title the HMI page shows in the shown language (the screen's name when it has none). */
    function shownTitle(s: Screen): string {
        const langs = languagesOf(file);
        const t = langs.length && language ? textIn(s.title, langs, language) : s.title;
        return typeof t === 'string' && t ? t : titleOf(s);
    }

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

    return (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" data-stage="">
            {!trying && <div className="flex-none border-b px-3 pt-2"><EditBar /></div>}{/* trying: no canvas editing, and the keys are the controller's */}
            <Viewport overlay={log.length > 0 && <ul className="log absolute bottom-2 left-3 z-20 m-0">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}>
            <div className="hmi-page" data-hmi-page="" ref={stage} style={{ width: W }} tabIndex={0} onKeyDown={onKey} data-trying={trying}>
                <div className="hmi-title" data-hmi-title="">{shownTitle(shownScreen)}</div>
                {!trying ? (
                    <Canvas>
                        <canvas ref={canvas} width={W} height={H} />
                        {showFocus && <FocusOverlay />}
                    </Canvas>
                ) : (
                    <div className="canvas-wrap">
                        <canvas ref={canvas} width={W} height={H}
                            onPointerDown={(e) => onPointer(e, 'down')} onPointerMove={(e) => onPointer(e, 'move')}
                            onPointerUp={(e) => onPointer(e, 'up')} />
                    </div>
                )}
            </div>
            </Viewport>
        </section>
    );
}

/** Whether the canvas numbers the elements in focus order. */
export function ShowFocusToggle() {
    const showFocus = useEditor((s) => s.showFocus);
    const { setShowFocus } = useActions();
    return (
        <div className="row-buttons">
            <label><input type="checkbox" checked={showFocus} onChange={(e) => setShowFocus(e.target.checked)} /> Show focus order</label>
        </div>
    );
}

/** The widgets to add: click to add one to the screen, or drag it onto the screen. */
export function Palette() {
    const { addElement } = useActions();
    return (
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
    );
}
