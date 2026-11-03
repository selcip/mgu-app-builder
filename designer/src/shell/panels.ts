// How the two panels are laid out: each docked beside the canvas or floating over it (where it was dragged, as wide
// as it was made, collapsed to its header or not). Kept per browser. Plain data and maths, no DOM, so Node tests it.

export type Side = 'left' | 'right';

export interface PanelLayout {
    mode: 'docked' | 'floating';
    /** px; the same docked and floating. */
    width: number;
    /** Floating: the panel's top-left corner in the area under the toolbar; null until first floated. */
    x: number | null;
    y: number | null;
    /** Floating: shown as its header only. */
    collapsed: boolean;
}

export type PanelLayouts = Record<Side, PanelLayout>;

export interface Area {
    w: number;
    h: number;
}

export const MIN_WIDTH = 200;
export const MAX_WIDTH = 560;
/** A floating panel's header height: what must stay on screen so it can be dragged back. */
export const HEADER = 40;
/** The gap between a floating panel and the area's edge where it first floats. */
export const MARGIN = 12;
const KEY = 'mgu-designer.panels';

export const DEFAULT_PANELS: PanelLayouts = {
    left: { mode: 'docked', width: 240, x: null, y: null, collapsed: false },
    right: { mode: 'docked', width: 320, x: null, y: null, collapsed: false },
};

export const clampWidth = (w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));

/** A floating panel's position kept inside the area: all of its width (when it fits) and its header. */
export function clampPosition(x: number, y: number, width: number, area: Area): { x: number; y: number } {
    return {
        x: Math.round(Math.max(0, Math.min(area.w - width, x))),
        y: Math.round(Math.max(0, Math.min(area.h - HEADER, y))),
    };
}

/** Where a floating panel shows: where it was put, or first in its own top corner; always inside the area. */
export function floatingAt(layout: PanelLayout, side: Side, area: Area): { x: number; y: number } {
    const x = layout.x ?? (side === 'left' ? MARGIN : area.w - layout.width - MARGIN);
    const y = layout.y ?? MARGIN;
    return clampPosition(x, y, layout.width, area);
}

/** How much of the area's left edge a docked, shown left panel takes (the canvas starts after it). */
export const leftInset = (p: PanelLayouts, hidden: boolean) => (!hidden && p.left.mode === 'docked' ? p.left.width : 0);

function valid(v: unknown, fallback: PanelLayout): PanelLayout {
    if (!v || typeof v !== 'object') return fallback;
    const o = v as Record<string, unknown>;
    const num = (n: unknown) => (typeof n === 'number' && isFinite(n) ? n : null);
    return {
        mode: o.mode === 'floating' ? 'floating' : 'docked',
        width: clampWidth(num(o.width) ?? fallback.width),
        x: num(o.x),
        y: num(o.y),
        collapsed: o.collapsed === true,
    };
}

/** The layouts kept in `storage`; the defaults when there are none or they can't be read. */
export function readPanels(storage: Pick<Storage, 'getItem'> | null): PanelLayouts {
    try {
        const raw = storage && storage.getItem(KEY);
        const o = raw ? JSON.parse(raw) : null;
        return { left: valid(o && o.left, DEFAULT_PANELS.left), right: valid(o && o.right, DEFAULT_PANELS.right) };
    } catch {
        return DEFAULT_PANELS;
    }
}

/** Keeps the layouts in `storage`; a storage that refuses (full, private browsing) only loses them. */
export function writePanels(storage: Pick<Storage, 'setItem'> | null, layouts: PanelLayouts): void {
    try { if (storage) storage.setItem(KEY, JSON.stringify(layouts)); } catch { /* not kept */ }
}
