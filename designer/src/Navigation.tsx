// Navigation in the Designer: the link field (the screen the selected element's action opens) and the navigation view
// (every link of the screen file, screen by screen, with the links to screens that no longer exist flagged). Every
// change is a document-model operation.
import { actionOf, linkOf, linksOf, type Element, type Link, type Op, type Screen, type ScreenFile } from './model/index.ts';

/** The screen the selected element's action opens: none, or one of the file's other screens. */
export function LinkField({ file, screen, element, edit }: { file: ScreenFile; screen: Screen; element: Element; edit: (op: Op) => unknown }) {
    const action = actionOf(element);
    const to = linkOf(screen, action);
    const dead = to !== undefined && !file.screens.some((s) => s.name === to);
    const others = file.screens.filter((s) => s.name !== screen.name).map((s) => s.name);
    return (
        <label className="link-field">
            Opens screen <small>(when selected; BACK returns here)</small>
            <select data-link-field="" value={to === undefined ? '' : to}
                onChange={(e) => edit({ type: 'setLink', screen: screen.name, action, to: e.target.value || null })}>
                <option value="">(none)</option>
                {others.map((n) => <option key={n} value={n}>{n}</option>)}
                {dead && <option value={to}>{to} (missing)</option>}
            </select>
            {dead && <span className="dead-link" role="alert" data-link-problem="">Screen “{to}” no longer exists: the driver would hit a dead end.</span>}
        </label>
    );
}

/**
 * The navigation view: how the screens connect. Each screen's links (action, the elements reporting it, the screen
 * it opens) and the screens it is opened from; links to missing screens are flagged and counted at the top. Selecting
 * a link selects its screen and element.
 */
export function NavigationPanel({ file, selected, onSelect }: {
    file: ScreenFile; selected: string | undefined; onSelect: (screen: string, element: string | null) => void;
}) {
    const links = linksOf(file);
    const dead = links.filter((l) => l.dead);
    const into = links.filter((l) => l.to === selected);
    const label = (l: Link) => (l.elements.length ? l.elements.join(', ') : '(no element)') + (l.elements.length === 1 && l.elements[0] === l.action ? '' : ` [${l.action}]`);
    return (
        <div className="navigation-panel" data-navigation="">
            <h2>Navigation</h2>
            {dead.length > 0 && (
                <p className="dead-link" role="alert" data-dead-links={dead.length}>
                    {dead.length === 1 ? '1 link leads' : `${dead.length} links lead`} to a screen that no longer exists.
                </p>
            )}
            {links.length === 0 && <p className="hint">No links yet: select an element and choose the screen it opens.</p>}
            {file.screens.filter((s) => links.some((l) => l.screen === s.name)).map((s) => (
                <div key={s.name}>
                    <h3>{s.name}</h3>
                    <ul>{links.filter((l) => l.screen === s.name).map((l) => (
                        <li key={l.action} data-link={`${l.screen}:${l.action}`} data-dead={l.dead || undefined} className={l.dead ? 'dead-link' : undefined}>
                            <button onClick={() => onSelect(l.screen, l.elements[0] === undefined ? null : l.elements[0])}>
                                {label(l)} → {l.to}{l.dead ? ' (missing)' : ''}
                            </button>
                        </li>
                    ))}</ul>
                </div>
            ))}
            {selected !== undefined && into.length > 0 && <>
                <h3>Opened from</h3>
                <ul>{into.map((l) => (
                    <li key={l.screen + ':' + l.action} data-link-into={`${l.screen}:${l.action}`}>
                        <button onClick={() => onSelect(l.screen, l.elements[0] === undefined ? null : l.elements[0])}>{l.screen}: {label(l)}</button>
                    </li>
                ))}</ul>
            </>}
        </div>
    );
}
