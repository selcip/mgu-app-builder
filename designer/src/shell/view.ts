// The canvas's view: how far it is zoomed and where the HMI page sits in it. `x` and `y` are the page's top-left
// corner in the canvas's own pixels; a point p of the page shows at (x + p.x * zoom, y + p.y * zoom). Plain maths,
// no DOM, so Node tests it.

export interface View {
    zoom: number;
    x: number;
    y: number;
}

export interface Size {
    w: number;
    h: number;
}

/** The zoom levels the zoom buttons step through (Ctrl+wheel zooms freely between the ends). */
export const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export const MIN_ZOOM = ZOOMS[0];
export const MAX_ZOOM = ZOOMS[ZOOMS.length - 1];
/** The space kept around the page when fitting it. */
const FIT_MARGIN = 32;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** `view` zoomed to `zoom`, keeping the canvas point (px, py) over the same point of the page. */
export function zoomAbout(view: View, zoom: number, px: number, py: number): View {
    const z = clampZoom(zoom);
    const k = z / view.zoom;
    return { zoom: z, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

/** The next zoom level up (dir 1) or down (dir -1) from `zoom`. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
    const eps = 1e-6;
    if (dir > 0) return ZOOMS.find((z) => z > zoom + eps) ?? MAX_ZOOM;
    return [...ZOOMS].reverse().find((z) => z < zoom - eps) ?? MIN_ZOOM;
}

/** The page at `zoom`, centred in the canvas. */
export function centred(canvas: Size, page: Size, zoom: number): View {
    const z = clampZoom(zoom);
    return { zoom: z, x: (canvas.w - page.w * z) / 2, y: (canvas.h - page.h * z) / 2 };
}

/** The page as large as fits in the canvas with a margin around it, centred. */
export function fitted(canvas: Size, page: Size): View {
    const z = Math.min((canvas.w - 2 * FIT_MARGIN) / page.w, (canvas.h - 2 * FIT_MARGIN) / page.h);
    return centred(canvas, page, z > 0 ? z : MIN_ZOOM);
}

/** The zoom a Ctrl+wheel (or pinch) step of `deltaY` pixels gives: smooth, about 10 % per notch. */
export const wheelZoom = (zoom: number, deltaY: number) => clampZoom(zoom * Math.exp(-deltaY / 1000));
