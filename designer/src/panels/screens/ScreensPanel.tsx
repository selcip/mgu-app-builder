// The left panel's lists: the screen file's screens (the first one and the ones with dead links marked; add one) and,
// under them, the selected screen's elements (click to select one, Shift/Ctrl/Cmd-click to select several), like a
// layer list: the top row is the element drawn on top, and dragging rows changes the stacking order.
import { Fragment, useState, type DragEvent } from 'react';
import { Home, Image, LayoutList, Plus, RectangleHorizontal, Square, ToggleRight, TriangleAlert, Type, type LucideIcon } from 'lucide-react';
import { deadLinks, firstScreenOf } from '../../model/index.ts';
import { widget } from '../../catalog.ts';
import { Button } from '@/components/ui/button';
import { Hint, Section, listRowClass } from '@/components/designer/form';
import { fileOf, kindOf, screenOf } from '../../store/editor.ts';
import { useActions, useEditor, useEditorStore } from '../../store/react.tsx';
import { dropPlace, stack } from '../../shell/commands.ts';

export function ScreenList() {
    const file = useEditor(fileOf);
    const selected = useEditor((s) => s.selected);
    const { edit, selectScreen } = useActions();
    const dead = deadLinks(file);
    const first = firstScreenOf(file);
    return (
        <Section title="Screens" data-screens=""
            actions={<Button variant="ghost" size="icon-xs" title="Add screen" data-add-screen="" onClick={() => edit({ type: 'addScreen' })}><Plus /></Button>}>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{file.screens.map((s) => (
                <li key={s.name}>
                    <button data-screen={s.name} aria-current={s.name === selected} className={listRowClass} onClick={() => selectScreen(s.name)}>
                        <span className="flex-1 truncate">{s.name}</span>
                        {s.name === first && <Home className="size-3.5 text-muted-foreground" aria-label="first screen" />}
                        {dead.some((l) => l.screen === s.name) && (
                            <TriangleAlert className="dead-link size-3.5 text-amber-400" aria-label="links to a screen that no longer exists" />
                        )}
                    </button>
                </li>
            ))}</ul>
        </Section>
    );
}

const ICONS: Record<string, LucideIcon> = {
    text: Type, image: Image, button: RectangleHorizontal, vbutton: RectangleHorizontal, roundButton: RectangleHorizontal,
    toggle: ToggleRight, list: LayoutList, appList: LayoutList, row: LayoutList,
};

/** The drag type of rows being dragged in the element list (the data is unused: the selection is what moves). */
const ROW_DRAG_TYPE = 'application/x-mgu-element';

export function ElementList() {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const cluster = useEditor(kindOf) === 'cluster-layout';        // the layout's widgets: their kind is the engine's, not the catalog's
    const store = useEditorStore();
    const { select } = useActions();
    const [gap, setGap] = useState<number | null>(null);        // the gap a drag would drop into
    const shown = screen.components.slice().reverse();          // top first
    const names = shown.map((c) => c.name);

    function dragStart(e: DragEvent, name: string) {
        if (!selection.includes(name)) select([name]);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(ROW_DRAG_TYPE, name);
    }
    function dragOver(e: DragEvent, i: number) {
        if (!e.dataTransfer.types.includes(ROW_DRAG_TYPE)) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setGap(e.clientY < r.top + r.height / 2 ? i : i + 1);
    }
    function drop(e: DragEvent) {
        if (!e.dataTransfer.types.includes(ROW_DRAG_TYPE) || gap === null) return;
        e.preventDefault();
        const moving = store.getState().selection;
        setGap(null);
        stack(store, dropPlace(names, moving, gap));
    }
    const line = <li aria-hidden className="pointer-events-none -my-px h-0.5 rounded bg-blue-500" data-drop-line="" />;
    return (
        <Section title={cluster ? 'Elements' : <>Elements <span className="font-normal">on {screen.name}</span></>} data-elements="">
            {shown.length === 0 && <Hint>{cluster ? 'No elements in this layout.' : 'No elements yet: add a widget.'}</Hint>}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0"
                onDragOver={(e) => { if (e.dataTransfer.types.includes(ROW_DRAG_TYPE)) e.preventDefault(); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setGap(null); }}
                onDrop={drop} onDragEnd={() => setGap(null)}>{shown.map((c, i) => {
                const Icon = ICONS[c.gpu] || Square;
                return (
                    <Fragment key={c.name}>
                        {gap === i && line}
                        <li draggable onDragStart={(e) => dragStart(e, c.name)} onDragOver={(e) => dragOver(e, i)}>
                            <button data-element={c.name} data-element-kind={cluster ? c.gpu : undefined} data-boxless={c.boxless ? '' : undefined} aria-current={selection.includes(c.name)} className={listRowClass}
                                title="Shift- or Ctrl-click to select several; drag to change which is drawn on top"
                                onClick={(e) => select(e.shiftKey || e.metaKey || e.ctrlKey
                                    ? (selection.includes(c.name) ? selection.filter((n) => n !== c.name) : selection.concat([c.name]))
                                    : [c.name])}>
                                <Icon className="size-3.5 flex-none text-muted-foreground" />
                                <span className="flex-1 truncate">{c.name}</span>
                                <small className="truncate text-[0.7rem] text-muted-foreground">{cluster ? c.gpu : (widget(c.gpu) || { label: c.gpu }).label}</small>
                            </button>
                        </li>
                    </Fragment>
                );
            })}{gap === shown.length && line}</ul>
        </Section>
    );
}
