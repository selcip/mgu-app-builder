// Navigation operations: link an action to the screen it opens, or unlink it. The screen file keeps a screen's links
// as its `nav` (action name -> screen name); the runtime opens the linked screen when an element reporting that
// action is selected (runtime/mgu_runtime.js). Renaming a screen points its links at the new name (ops/screens.ts);
// deleting it leaves them dead, which deadLinks() reports.
import { EditError, screenOf, type Draft, type Screen, type ScreenFile } from '../core.ts';
import { actionOf } from './focus.ts';

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** The screen an action opens, or undefined when it is not linked. */
export function linkOf(s: Screen, action: string): string | undefined {
    return s.nav && has(s.nav, action) ? s.nav[action] : undefined;
}

/** One link of the navigation view: on `screen`, `action` (reported by `elements`) opens `to`. */
export interface Link {
    screen: string;
    action: string;
    to: string;
    elements: string[];     // the screen's elements that report the action (none: the link is never followed)
    dead: boolean;          // `to` is not a screen of the file
}

/** Every link of the file, screen by screen in file order, each screen's links in its nav's order. */
export function linksOf(file: ScreenFile): Link[] {
    const names = new Set(file.screens.map((s) => s.name));
    const out: Link[] = [];
    for (const s of file.screens) {
        if (!s.nav) continue;
        for (const action of Object.keys(s.nav)) {
            const to = s.nav[action];
            out.push({
                screen: s.name, action, to,
                elements: (s.components || []).filter((c) => actionOf(c) === action).map((c) => c.name),
                dead: !names.has(to),
            });
        }
    }
    return out;
}

/** The links to screens that are not in the file: the driver would hit a dead end there. */
export function deadLinks(file: ScreenFile): Link[] {
    return linksOf(file).filter((l) => l.dead);
}

function unlink(s: Screen, action: string) {
    if (!s.nav) return;
    delete s.nav[action];
    if (!Object.keys(s.nav).length) delete s.nav;
}

/**
 * Called when an element's action changes from `from` to `to` (a new action name, or the element renamed while it
 * reports its name): the link goes with it, unless another element still reports `from` or `to` is linked already.
 */
export function carryLink(s: Screen, from: string, to: string) {
    const link = linkOf(s, from);
    if (from === to || link === undefined || linkOf(s, to) !== undefined) return;
    if (s.components.some((c) => actionOf(c) === from)) return;
    unlink(s, from);
    s.nav = { ...(s.nav || {}), [to]: link };
}

/** Called when an element is deleted: its action's link goes too, unless another element still reports it. */
export function dropLink(s: Screen, action: string) {
    if (!s.components.some((c) => actionOf(c) === action)) unlink(s, action);
}

export const navigationOps = {
    /** Links `action` on `screen` to the screen `to` opens; `to` null or '' unlinks it. */
    setLink(d: Draft, a: { screen: string; action: string; to: string | null }) {
        const s = screenOf(d, a.screen);
        if (typeof a.action !== 'string' || !a.action) throw new EditError('A link needs an action name.');
        if (a.to === null || a.to === '') {
            unlink(s, a.action);
            return;
        }
        const to = screenOf(d, a.to);
        if (to === s) throw new EditError('A screen can’t link to itself.');
        s.nav = { ...(s.nav || {}), [a.action]: to.name };
    },
};
