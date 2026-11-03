// Element operations: add from the palette, rename, delete, set an option.
import { defaultsOf, widget } from '../../catalog.ts';
import { EditError, checkName, elementOf, screenOf, uniqueName, type Draft, type Screen } from '../core.ts';
import { checkOptionValue } from '../options.ts';
import { actionOf, joinFocus } from './focus.ts';
import { carryLink, dropLink } from './navigation.ts';

/** The name an element of `widget` added to `screen` gets unless one is given: button1, button2, ... */
export function newElementName(screen: Screen, type: string): string {
    return uniqueName(type, screen.components.map((c) => c.name));
}

const taken = (s: Screen) => s.components.map((c) => c.name);

export const elementOps = {
    /** A new element on top of the screen, with the widget's default options and size unless a box is given. */
    addElement(d: Draft, a: { screen: string; widget: string; name?: string; x?: number; y?: number; w?: number; h?: number }) {
        const s = screenOf(d, a.screen);
        const wd = widget(a.widget);
        if (!wd) throw new EditError(`The catalog has no widget "${a.widget}".`);
        const name = a.name === undefined ? newElementName(s, a.widget) : checkName(a.name, taken(s), 'element');
        s.components.push({
            name, rtype: 'gpu', gpu: a.widget,
            x: a.x === undefined ? 0 : a.x, y: a.y === undefined ? 0 : a.y,
            w: a.w === undefined ? wd.size.w : a.w, h: a.h === undefined ? wd.size.h : a.h,
            opts: defaultsOf(a.widget),
        });
        joinFocus(s, s.components[s.components.length - 1]);
    },

    renameElement(d: Draft, a: { screen: string; element: string; name: string }) {
        const s = screenOf(d, a.screen);
        const e = elementOf(s, a.element);
        if (a.name === e.name) return;
        const was = actionOf(e);
        e.name = checkName(a.name, taken(s), 'element');
        if (s.focus) s.focus = s.focus.map((n) => (n === a.element ? a.name : n));
        carryLink(s, was, actionOf(e));        // an element reporting its name: its link goes with the new name
    },

    deleteElement(d: Draft, a: { screen: string; element: string }) {
        const s = screenOf(d, a.screen);
        const e = elementOf(s, a.element);
        s.components.splice(s.components.indexOf(e), 1);
        if (s.focus) s.focus = s.focus.filter((n) => n !== a.element);
        dropLink(s, actionOf(e));
    },

    /** Sets one of the widget's options; `value: undefined` removes it, so the widget's default applies. */
    setOption(d: Draft, a: { screen: string; element: string; key: string; value: unknown }) {
        const e = elementOf(screenOf(d, a.screen), a.element);
        const wd = widget(e.gpu);
        if (!wd) throw new EditError(`The catalog has no widget "${e.gpu}"; its options can’t be edited.`);
        const o = wd.options.find((x) => x.key === a.key);
        if (!o) throw new EditError(`A ${wd.label} has no option "${a.key}".`);
        if (a.value === undefined) {
            delete e.opts[a.key];
            return;
        }
        checkOptionValue(o, a.value);
        if (!e.opts) e.opts = {};
        e.opts[a.key] = a.value;
    },
};
