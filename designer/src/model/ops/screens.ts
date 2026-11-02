// Screen operations: add, rename, duplicate, delete, mark first, title, and the screen file's one theme.
import { THEMES, DEFAULT_THEME } from '../../catalog.ts';
import { EditError, checkName, screenOf, uniqueName, type Draft, type Screen, type ScreenFile } from '../core.ts';

/** The screen file's theme: the one written on its screens (the first screen's; the kit's default if none). */
export function themeOf(file: ScreenFile): string {
    const t = file.screens.length ? file.screens[0].theme : undefined;
    return typeof t === 'string' && t ? t : DEFAULT_THEME;
}

/** The name the next added screen gets unless one is given. */
export function newScreenName(file: ScreenFile): string {
    return uniqueName('screen', file.screens.map((s) => s.name));
}

/** The title the HMI page's title bar shows for a screen: its title, or its name when it has none. */
export function titleOf(s: Screen): string {
    return typeof s.title === 'string' && s.title ? s.title : s.name;
}

/** The screen the app opens on: `first`, or the top screen in a file without one (Store screen files). */
export function firstScreenOf(file: ScreenFile): string {
    return file.first !== undefined ? file.first : file.screens[0].name;
}

export function blankScreen(name: string, title: string, theme: string): Screen {
    return { name, kind: 'gpu', title, theme, bg: 'theme', components: [] };
}

const taken = (d: Draft) => d.file.screens.map((s) => s.name);

/** Points everything that names screen `from` (first screen, navigation links) at `to`. */
function retarget(d: Draft, from: string, to: string) {
    if (d.file.first === from) d.file.first = to;
    for (const s of d.file.screens) {
        if (!s.nav) continue;
        for (const k of Object.keys(s.nav)) if (s.nav[k] === from) s.nav[k] = to;
    }
}

export const screenOps = {
    addScreen(d: Draft, a: { name?: string; title?: string }) {
        const name = a.name === undefined ? newScreenName(d.file) : checkName(a.name, taken(d), 'screen');
        d.file.screens.push(blankScreen(name, a.title === undefined ? '' : a.title, themeOf(d.file)));
    },

    renameScreen(d: Draft, a: { screen: string; name: string }) {
        const s = screenOf(d, a.screen);
        if (a.name === s.name) return;
        s.name = checkName(a.name, taken(d), 'screen');
        retarget(d, a.screen, a.name);
    },

    /** A copy of the screen right after it, named `name` or `<screen>_copy`. */
    duplicateScreen(d: Draft, a: { screen: string; name?: string }) {
        const s = screenOf(d, a.screen);
        const names = taken(d);
        let name = a.name;
        if (name === undefined) {
            name = s.name + '_copy';
            if (names.includes(name)) name = uniqueName(name, names);
        } else checkName(name, names, 'screen');
        const copy = structuredClone(s);
        copy.name = name;
        d.file.screens.splice(d.file.screens.indexOf(s) + 1, 0, copy);
    },

    deleteScreen(d: Draft, a: { screen: string }) {
        const s = screenOf(d, a.screen);
        if (d.file.screens.length === 1) throw new EditError('The last screen can’t be deleted.');
        d.file.screens.splice(d.file.screens.indexOf(s), 1);
        if (d.file.first === s.name) d.file.first = d.file.screens[0].name;
    },

    setFirstScreen(d: Draft, a: { screen: string }) {
        d.file.first = screenOf(d, a.screen).name;
    },

    setScreenTitle(d: Draft, a: { screen: string; title: string }) {
        screenOf(d, a.screen).title = a.title;
    },

    /** One theme for the whole screen file, written on every screen (the Store's drawing code reads it there). */
    setTheme(d: Draft, a: { theme: string }) {
        if (!THEMES.some((t) => t.id === a.theme)) throw new EditError(`The kit has no theme "${a.theme}".`);
        for (const s of d.file.screens) s.theme = a.theme;
    },
};
