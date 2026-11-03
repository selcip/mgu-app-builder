// The selected screen's elements: click to select one, Shift- or Ctrl-click to select several.
import { widget } from './catalog.ts';
import { screenOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';

export function ElementList() {
    const screen = useEditor(screenOf);
    const selection = useEditor((s) => s.selection);
    const { select } = useActions();
    return (
        <ul className="elements">{screen.components.map((c) => (
            <li key={c.name}>
                <button data-element={c.name} aria-current={selection.includes(c.name)} title="Shift- or Ctrl-click to select several"
                    onClick={(e) => select(e.shiftKey || e.metaKey || e.ctrlKey
                        ? (selection.includes(c.name) ? selection.filter((n) => n !== c.name) : selection.concat([c.name]))
                        : [c.name])}>
                    {c.name} <small>{(widget(c.gpu) || { label: c.gpu }).label}</small>
                </button>
            </li>
        ))}</ul>
    );
}
