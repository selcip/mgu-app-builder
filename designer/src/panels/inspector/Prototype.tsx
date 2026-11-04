// The inspector's Prototype tab: how the app behaves rather than how it looks.
//   Interaction: the selected element's action (what it reports to the app's code) and the screen it opens.
//   Focus order: the order the iDrive controller moves the highlight in; reorder, leave out, take back in, reset.
//   Navigation: every link of the screen file, screen by screen, links to missing screens flagged; selecting a link
//               selects its screen and element.
// Every change is a document-model operation.
import { ArrowDown, ArrowUp, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { actionOf, focusOrderOf, linkOf, linksOf, type Link } from '../../model/index.ts';
import { CommitInput } from '@/components/designer/CommitInput';
import { Button } from '@/components/ui/button';
import { Hint, Row, Section, checkboxClass, listRowClass, selectClass } from '@/components/designer/form';
import { cn } from '@/lib/utils';
import { elementOf, fileOf, screenOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

/** The selected element's action and the screen it opens (nothing when none or several are selected). */
export function Interaction() {
    const file = useEditor(fileOf);
    const screen = useEditor(screenOf);
    const element = useEditor(elementOf);
    const { edit } = useActions();
    if (!element) return null;
    const action = actionOf(element);
    const to = linkOf(screen, action);
    const dead = to !== undefined && !file.screens.some((s) => s.name === to);
    const others = file.screens.filter((s) => s.name !== screen.name).map((s) => s.name);
    return (
        <Section title={<>Interaction <span className="font-normal">of {element.name}</span></>} data-interaction="">
            <div data-action-field="">
                <Row label="Action">
                    <CommitInput value={actionOf(element)} placeholder={element.name}
                        onCommit={(v) => edit({ type: 'setAction', screen: screen.name, element: element.name, action: v.trim() })} />
                </Row>
            </div>
            <Hint className="mb-2 text-[0.7rem]">Reported to your code when the driver selects it; empty: the element’s name.</Hint>
            <Row label="Opens screen">
                <select data-link-field="" className={selectClass} value={to === undefined ? '' : to}
                    onChange={(e) => edit({ type: 'setLink', screen: screen.name, action, to: e.target.value || null })}>
                    <option value="">(none)</option>
                    {others.map((n) => <option key={n} value={n}>{n}</option>)}
                    {dead && <option value={to}>{to} (missing)</option>}
                </select>
            </Row>
            <Hint className="text-[0.7rem]">BACK there returns here.</Hint>
            {dead && (
                <p className="m-0 mt-2 flex gap-1.5 text-xs text-amber-400" role="alert" data-link-problem="">
                    <TriangleAlert className="mt-0.5 size-3.5 flex-none" />
                    Screen “{to}” no longer exists: the driver would hit a dead end.
                </p>
            )}
        </Section>
    );
}

export function FocusOrder() {
    const screen = useEditor(screenOf);
    const showFocus = useEditor((s) => s.showFocus);
    const { edit, setShowFocus } = useActions();
    const order = focusOrderOf(screen);
    const out = screen.components.map((c) => c.name).filter((n) => !order.includes(n));
    const s = screen.name;
    const custom = Array.isArray(screen.focus);
    return (
        <Section title={<>Focus order <span className="font-normal">({custom ? 'custom' : 'reading order'})</span></>} data-focus-panel=""
            actions={custom && (
                <Button variant="ghost" size="icon-xs" data-reset-focus="" title="Back to reading order"
                    onClick={() => edit({ type: 'resetFocusOrder', screen: s })}><RotateCcw /></Button>
            )}>
            {order.length === 0 && <Hint className="mb-2">Nothing takes focus on this screen.</Hint>}
            <ol className="m-0 mb-2 flex list-none flex-col gap-0.5 p-0">{order.map((n, i) => (
                <li key={n} data-focus-item={n} className={cn(listRowClass, 'pr-0.5')}>
                    <span className="flex size-4 flex-none items-center justify-center rounded-full bg-amber-300 text-[0.6rem] font-semibold text-black">{i + 1}</span>
                    <span className="flex-1 truncate">{n}</span>
                    <Button variant="ghost" size="icon-xs" title="Earlier" disabled={i === 0} onClick={() => edit({ type: 'moveInFocus', screen: s, element: n, to: i - 1 })}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-xs" title="Later" disabled={i === order.length - 1} onClick={() => edit({ type: 'moveInFocus', screen: s, element: n, to: i + 1 })}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-xs" title="Leave out of the focus order" onClick={() => edit({ type: 'excludeFromFocus', screen: s, element: n })}><X /></Button>
                </li>
            ))}</ol>
            {out.length > 0 && <>
                <h4 className="m-0 mb-1 text-[0.7rem] font-medium text-muted-foreground">Not in focus</h4>
                <ul className="m-0 mb-2 flex list-none flex-col gap-0.5 p-0">{out.map((n) => (
                    <li key={n} data-focus-out={n} className={cn(listRowClass, 'pr-0.5 text-muted-foreground')}>
                        <span className="flex-1 truncate">{n}</span>
                        <Button variant="ghost" size="icon-xs" title="Add at the end of the focus order" onClick={() => edit({ type: 'includeInFocus', screen: s, element: n })}><Plus /></Button>
                    </li>
                ))}</ul>
            </>}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" className={checkboxClass} data-show-focus="" checked={showFocus} onChange={(e) => setShowFocus(e.target.checked)} />
                Number the elements on the canvas
            </label>
        </Section>
    );
}

/** How the screens connect: each screen's links, and the screens that open the selected one. */
export function NavigationPanel() {
    const file = useEditor(fileOf);
    const selected = useEditor((s) => s.selected);
    const { goTo } = useActions();
    const links = linksOf(file);
    const dead = links.filter((l) => l.dead);
    const into = links.filter((l) => l.to === selected);
    const label = (l: Link) => (l.elements.length ? l.elements.join(', ') : '(no element)') + (l.elements.length === 1 && l.elements[0] === l.action ? '' : ` [${l.action}]`);
    const select = (l: Link) => goTo(l.screen, l.elements[0] === undefined ? null : l.elements[0]);
    const linkRow = (l: Link) => cn(listRowClass, 'h-auto min-h-7 py-1', l.dead && 'text-amber-400');
    return (
        <Section title="Navigation" data-navigation="">
            {dead.length > 0 && (
                <p className="m-0 mb-2 flex gap-1.5 text-xs text-amber-400" role="alert" data-dead-links={dead.length}>
                    <TriangleAlert className="mt-0.5 size-3.5 flex-none" />
                    {dead.length === 1 ? '1 link leads' : `${dead.length} links lead`} to a screen that no longer exists.
                </p>
            )}
            {links.length === 0 && <Hint>No links yet: select an element and choose the screen it opens.</Hint>}
            {file.screens.filter((s) => links.some((l) => l.screen === s.name)).map((s) => (
                <div key={s.name} className="mb-2">
                    <h4 className="m-0 mb-0.5 text-[0.7rem] font-medium text-muted-foreground">{s.name}</h4>
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{links.filter((l) => l.screen === s.name).map((l) => (
                        <li key={l.action} data-link={`${l.screen}:${l.action}`} data-dead={l.dead || undefined}>
                            <button className={linkRow(l)} onClick={() => select(l)}>{label(l)} → {l.to}{l.dead ? ' (missing)' : ''}</button>
                        </li>
                    ))}</ul>
                </div>
            ))}
            {into.length > 0 && <>
                <h4 className="m-0 mb-0.5 text-[0.7rem] font-medium text-muted-foreground">{selected} is opened from</h4>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{into.map((l) => (
                    <li key={l.screen + ':' + l.action} data-link-into={`${l.screen}:${l.action}`}>
                        <button className={linkRow(l)} onClick={() => select(l)}>{l.screen}: {label(l)}</button>
                    </li>
                ))}</ul>
            </>}
        </Section>
    );
}
