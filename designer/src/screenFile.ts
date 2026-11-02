// The little the Designer reads of a screen file before ticket 04's document model: its screens' names and titles.
// The runtime reads and validates the rest.

export interface Screen {
    name: string;
    title?: string;
    [key: string]: unknown;
}

export interface ScreenFile {
    schema?: number;
    first?: string;
    design?: { w: number; h: number };
    screens: Screen[];
    [key: string]: unknown;
}

export function firstScreen(f: ScreenFile): string {
    return f.first !== undefined ? f.first : f.screens[0].name;
}

export function titleOf(s: Screen): string {
    return typeof s.title === 'string' && s.title ? s.title : s.name;
}
