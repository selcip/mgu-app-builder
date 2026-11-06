// The cluster widget catalog: the generic widgets of the apps repo's cluster engine that the Designer offers, with
// their options, defaults and ranges. Hand-written, like catalog.ts for the kit; `test/cluster-catalog.test.js` keeps
// it equal to the engine (engine/shared/layouts.js TYPES and the validator, the widget reference in the header of
// engine/shared/hud.js, the baked fonts, icons.js). No React: the model and the inspector both read it.
//
// Ranges: only what the engine itself enforces is a hard limit here, each cited where it is: conn 0..3 (layouts.js
// _validate) and atext cells 1..32 (hud.js clamps them). Elsewhere the engine has no upper bound (z, light and segment
// counts are plain numbers in the shaders, with no array or loop sized by them), so only a meaningful minimum is kept and the
// hint says the engine sets no limit; the layer budget is what bounds a layout, not a refusal here.
//
// A widget in a layout file is { id, type, x, y, w, h, ...options }. `required` are the options the engine refuses a
// widget without. An option's `default` is what the engine uses when the key is absent (shown as the placeholder);
// putting the option back to nothing removes the key, so a file keeps only what the author set.

export type ClusterOptionKind =
    | 'int' | 'number' | 'boolean' | 'choice'
    | 'role'        // a role of the layout's palette
    | 'font'        // one of the baked fonts
    | 'template'    // text with {{tokens}}
    | 'signal'      // a car signal the engine reads (arc, segment bar)
    | 'icon';       // one of the engine's vector icons

export interface ClusterOption {
    key: string;
    label: string;
    kind: ClusterOptionKind;
    /** What the engine uses when the key is absent. */
    default?: string | number | boolean;
    min?: number;
    max?: number;
    choices?: readonly string[];
    /** Words under the field. */
    hint?: string;
}

export interface ClusterWidgetType {
    type: string;
    label: string;
    /** The engine's required options (layouts.js TYPES). */
    required: readonly string[];
    /** The box a new element gets. */
    box: { w: number; h: number };
    /** The fields a new element starts with besides id, type and box. */
    start: Readonly<Record<string, unknown>>;
    options: readonly ClusterOption[];
}

/** The baked fonts (engine/apps/cluster_themes/hud/fonts/<name>.json). */
export const CLUSTER_FONTS = [
    'big', 'gear', 'head', 'scale', 'small', 'unit', 'value',
    'm_gear', 'm_gl', 'm_label', 'm_mid', 'm_num', 'm_speed', 'm_stage', 'm_tiny', 'm_tyre', 'm_unit', 'm_val',
    's_gear', 's_gl', 's_label', 's_scale', 's_speed', 's_unit', 's_val',
] as const;

export const ALIGNMENTS = ['left', 'center', 'right'] as const;
export const CLASSES = ['ambient', 'content', 'overlay', 'alert'] as const;
export const TONES = ['verdict', 'cold'] as const;
export const CLUSTER_ICONS = ['gauge', 'shock', 'wheel', 'cog', 'stack', 'therm', 'fuel', 'tyre', 'oilcan'] as const;

/** The signals an arc or a segment bar can read (car.js's data keys, and the engine's own derived ones). */
export const CLUSTER_SIGNALS = ['rpm', 'speed', 'boost', 'oil', 'coolant', 'fuel', 'range', 'ambient', 'torquePct', 'powerPct',
    'setupLevel:engine', 'setupLevel:chassis', 'setupLevel:steering', 'setupLevel:gearbox'] as const;

export interface Token { token: string; label: string }

/** The {{tokens}} a text template can use (hud.js header, "Text tokens"). A token with a parameter is given with an example. */
export const CLUSTER_TOKENS: readonly Token[] = [
    { token: 'speed', label: 'Speed' }, { token: 'u:speed', label: 'Speed unit (MPH, KM/H)' }, { token: 'u:speedLc', label: 'Speed unit (mph, km/h)' },
    { token: 'rpm', label: 'Engine speed' }, { token: 'rpm10', label: 'Engine speed to 10' },
    { token: 'gear', label: 'Gear with selector (D3)' }, { token: 'gearnum', label: 'Gear number' }, { token: 'stage', label: 'Selector letter (P R N D)' },
    { token: 'gearInD', label: 'Gear number while in D' }, { token: 'mode', label: 'Drive mode' },
    { token: 'oil', label: 'Oil temperature' }, { token: 'coolant', label: 'Coolant temperature' }, { token: 'u:temp', label: 'Temperature unit' },
    { token: 'boost', label: 'Boost' }, { token: 'u:boost', label: 'Boost unit' }, { token: 'boostHi', label: 'Boost gauge label, high' }, { token: 'boostMid', label: 'Boost gauge label, middle' },
    { token: 'range', label: 'Range' }, { token: 'u:distLc', label: 'Distance unit' }, { token: 'ambient', label: 'Outside temperature' },
    { token: 'torque', label: 'Torque' }, { token: 'u:torque', label: 'Torque unit' }, { token: 'torquePct', label: 'Torque, % of peak' }, { token: 'powerPct', label: 'Power, % of peak' },
    { token: 'time', label: 'Time' }, { token: 'ampm', label: 'AM or PM' }, { token: 'ampmLc', label: 'am or pm' },
    { token: 'gLat', label: 'Lateral g' }, { token: 'gLong', label: 'Longitudinal g' },
    { token: 'shiftAt', label: 'Shift point' }, { token: 'lastShift', label: 'Last shift rpm' }, { token: 'lastGears', label: 'Last shift gears (4 > 5)' },
    { token: 'verdict', label: 'Last shift grade' }, { token: 'shiftPrompt', label: 'SHIFT at the shift point' }, { token: 'coldNote', label: 'Cold oil note' },
    { token: 'spd:0', label: 'Speed scale label (number after the colon)' }, { token: 'temp:100', label: 'A temperature in the display unit (°C after the colon)' },
    { token: 'setup:engine', label: 'Drive mode setup (engine, chassis, steering, gearbox)' }, { token: 'signal:rpm', label: 'A raw signal, 1 decimal' },
    { token: 'tyreP:FL', label: 'Tyre pressure (FL, FR, RL, RR)' }, { token: 'tyreT:FL', label: 'Tyre temperature (FL, FR, RL, RR)' }, { token: 'u:pressure', label: 'Pressure unit' },
];

const o = (key: string, label: string, kind: ClusterOptionKind, extra: Partial<ClusterOption> = {}): ClusterOption => ({ key, label, kind, ...extra });
const colour = (def: string, label = 'Colour') => o('color', label, 'role', { default: def });

/** On every widget: where it is drawn (stacking class and z) and on which connection to cluster-render. */
export const COMMON_OPTIONS: readonly ClusterOption[] = [
    o('class', 'Layer class', 'choice', { choices: CLASSES, default: 'content', hint: 'Ambient draws under content, then overlay, then alert.' }),
    o('z', 'Layer z', 'int', { default: 0, hint: 'Within a class, higher draws on top. The engine sets no limit.' }),
    // layouts.js _validate refuses a connection outside 0..3
    o('conn', 'Connection', 'int', { min: 0, max: 3, default: 0, hint: 'The car draws 8 layers per connection to cluster-render.' }),
];

const TEXT_OPTIONS: ClusterOption[] = [
    o('text', 'Template', 'template'),
    o('font', 'Font', 'font'),
    colour('fg'),
    o('align', 'Alignment', 'choice', { choices: ALIGNMENTS, default: 'left' }),
];

const MAP_WINDOW: ClusterOption[] = [
    o('holeInset', 'Map window inset', 'int', { min: 0, default: 6, hint: 'The engine sets no upper limit.' }),
    o('holeRadius', 'Map window corner radius', 'int', { min: 0, default: 28, hint: 'The engine sets no upper limit.' }),
];

export const CLUSTER_WIDGETS: readonly ClusterWidgetType[] = [
    { type: 'text', label: 'Text', required: ['text', 'font'], box: { w: 200, h: 40 }, start: { text: 'Text', font: 'head', color: 'fg' },
      options: [...TEXT_OPTIONS, o('color2', 'Colour at the bottom', 'role', { hint: 'A second role: a top-to-bottom gradient.' }), o('glow', 'Glow', 'boolean', { default: false })] },
    { type: 'atext', label: 'GPU text', required: ['text', 'font'], box: { w: 88, h: 27 }, start: { text: '{{speed}}', font: 'head', color: 'fg' },
      options: [...TEXT_OPTIONS,
          // hud.js clamps the cells to 1..32 (u_cells)
          o('cells', 'Cells', 'int', { min: 1, max: 32, hint: 'Equal cells across the width, up to 32. Default: the width over the font’s widest advance.' })] },
    { type: 'boxes', label: 'Boxes', required: ['boxes'], box: { w: 480, h: 240 }, start: { class: 'ambient', z: -10, boxes: [] },
      options: [colour('bg', 'Background'), ...MAP_WINDOW] },
    { type: 'fill', label: 'Fill', required: [], box: { w: 480, h: 240 }, start: { class: 'ambient', z: -10 },
      options: [colour('bg'), ...MAP_WINDOW] },
    { type: 'revbar', label: 'Rev bar', required: ['barH'], box: { w: 600, h: 80 }, start: { barH: 40 },
      options: [o('barH', 'Bar height', 'int', { min: 1 }), o('top', 'Room for marks above', 'int', { min: 0, default: 8 }),
          o('slant', 'Slant', 'int', { min: 0, default: 12 }),
          o('over', 'Scale past the redline', 'int', { min: 0, default: 0, hint: 'rpm past the redline’s thousand the scale runs to.' })] },
    { type: 'lights', label: 'Shift lights', required: [], box: { w: 600, h: 40 }, start: {},
      options: [o('count', 'Lights', 'int', { min: 1, default: 12, hint: 'The engine sets no upper limit.' }), o('from', 'First light at rpm', 'int', { min: 0, default: 3000 }),
          o('tail', 'Blue lights at the end', 'int', { min: 0, default: 0 }), o('round', 'Round', 'boolean', { default: false }),
          o('off', 'Unlit opacity', 'number', { min: 0, max: 1, default: 0.14 })] },
    { type: 'arc', label: 'Arc', required: ['signal', 'min', 'max'], box: { w: 240, h: 240 }, start: { signal: 'rpm', min: 0, max: 8000 },
      options: [o('signal', 'Signal', 'signal'), o('min', 'Minimum', 'number'), o('max', 'Maximum', 'number'), colour('arc'),
          o('start', 'Start angle', 'number', { default: 225, hint: 'Degrees clockwise from 12 o’clock.' }),
          o('sweep', 'Sweep', 'number', { default: 270, hint: 'Degrees; negative runs anticlockwise.' }),
          o('width', 'Width', 'int', { min: 1, default: 7 })] },
    { type: 'segbar', label: 'Segment bar', required: ['signal', 'max'], box: { w: 160, h: 24 }, start: { signal: 'setupLevel:engine', max: 3 },
      options: [o('signal', 'Signal', 'signal'), o('max', 'Segments', 'int', { min: 1, hint: 'The engine sets no upper limit.' }), o('slant', 'Slant', 'int', { min: 0, default: 0 }), colour('hot')] },
    { type: 'icon', label: 'Icon', required: ['icon'], box: { w: 48, h: 48 }, start: { icon: 'gauge', color: 'fg' },
      options: [o('icon', 'Icon', 'icon'), colour('fg')] },
    { type: 'badge', label: 'Badge', required: ['text', 'font', 'tone'], box: { w: 160, h: 40 }, start: { text: '{{verdict}}', font: 'head', tone: 'verdict' },
      options: [o('text', 'Template', 'template'), o('font', 'Font', 'font'), o('tone', 'Tone', 'choice', { choices: TONES, hint: 'verdict: the last shift’s grade colour; cold: blue.' })] },
    { type: 'scale', label: 'Scale', required: ['font'], box: { w: 700, h: 30 }, start: { font: 'scale', color: 'dim' },
      options: [o('font', 'Font', 'font'), colour('dim'), o('over', 'Scale past the redline', 'int', { min: 0, default: 0 }),
          o('redFrom', 'Red from the redline', 'boolean', { default: false })] },
    { type: 'stripe', label: 'Stripe', required: [], box: { w: 400, h: 20 }, start: {}, options: [] },
    { type: 'shiftbar', label: 'Shift bar', required: [], box: { w: 1000, h: 60 }, start: {},
      options: [o('segments', 'Segments', 'int', { min: 1, default: 40 })] },
];

export const clusterWidget = (type: string): ClusterWidgetType | undefined => CLUSTER_WIDGETS.find((w) => w.type === type);

/** The options of a widget type: its own, then the ones every widget has. */
export const optionsOf = (type: string): readonly ClusterOption[] => [...(clusterWidget(type)?.options || []), ...COMMON_OPTIONS];
