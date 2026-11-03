// The left panel's lists: the screen file's screens (the first one and the ones with dead links marked; add one) and,
// under them, the selected screen's elements (click to select one, Shift/Ctrl/Cmd-click to select several), like a
// layer list.
import { Home, Image, LayoutList, Plus, RectangleHorizontal, Square, ToggleRight, TriangleAlert, Type, type LucideIcon } from 'lucide-react';
import { deadLinks, firstScreenOf } from '../../model/index.ts';
import { widget } from '../../catalog.ts';
import { Button } from '@/components/ui/button';
import { Hint, Section, listRowClass } from '@/components/designer/form';
import { fileOf, screenOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

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

export function ElementList() {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const { select } = useActions();
    return (
        <Section title={<>Elements <span className="font-normal">on {screen.name}</span></>} data-elements="">
            {screen.components.length === 0 && <Hint>No elements yet: add a widget.</Hint>}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{screen.components.map((c) => {
                const Icon = ICONS[c.gpu] || Square;
                return (
                    <li key={c.name}>
                        <button data-element={c.name} aria-current={selection.includes(c.name)} className={listRowClass}
                            title="Shift- or Ctrl-click to select several"
                            onClick={(e) => select(e.shiftKey || e.metaKey || e.ctrlKey
                                ? (selection.includes(c.name) ? selection.filter((n) => n !== c.name) : selection.concat([c.name]))
                                : [c.name])}>
                            <Icon className="size-3.5 flex-none text-muted-foreground" />
                            <span className="flex-1 truncate">{c.name}</span>
                            <small className="truncate text-[0.7rem] text-muted-foreground">{(widget(c.gpu) || { label: c.gpu }).label}</small>
                        </button>
                    </li>
                );
            })}</ul>
        </Section>
    );
}
