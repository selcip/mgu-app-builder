// The widget catalog: every widget the vendored kit draws, its options with their kinds and defaults, its default
// size on the iDrive 7 screen (1796 x 632) and whether it takes focus by default. It drives the Designer's palette
// and property panel, and the document model's checks. Hand-written; test/widget-catalog.test.js holds it to the
// kit (kit/am_elements.js ELEMENTS: same options, kinds, defaults and choices).
//
// Left out on purpose (the kit can't draw them on the head unit):
// - the kit's gauge, table, header and bar widgets that have no drawing (radial, needle, ring, bar, segBar, stat,
//   readout, gear, shiftLights, chart, table, tyres, gmeter, pill, panel, header, menuBar);
// - the `icon` widget and every HMI icon option (button.icon, tile.icon, row.icon, ...): the kit has no HMI icon
//   atlas, so they draw nothing (and a button with an icon throws). The `icon` kind here is a kit vector icon.

/** What an option holds, which picks its input in the property panel. */
export type OptionKind =
    | 'text'        // a string (or, later, a map of language code to string)
    | 'number'      // `integer` when only whole numbers make sense
    | 'colour'      // a theme colour name (COLOURS), '#rrggbb[aa]', or '' for the widget's own colour
    | 'boolean'
    | 'choice'      // one of `choices`
    | 'icon'        // a kit vector icon name (ICONS)
    | 'image'       // a picture: 'images/x.png' beside the screen file
    | 'rows';       // list rows: one per line, fields comma separated (see the option's label), or an array of objects

export interface WidgetOption {
    key: string;
    label: string;
    kind: OptionKind;
    default: unknown;
    integer?: boolean;
    choices?: string[];
}

export interface Widget {
    type: string;               // the element's `gpu`
    label: string;
    size: { w: number; h: number };
    focusable: boolean;         // in the focus order unless the app author leaves it out
    options: WidgetOption[];
}

export const THEMES: { id: string; label: string }[] = [
    { id: 'm_tricolour', label: 'M Tricolour' },
    { id: 'm_red', label: 'M Red' },
    { id: 'ice', label: 'Ice White' },
    { id: 'amber', label: 'Night Amber' },
];
export const DEFAULT_THEME = 'm_tricolour';

/** Theme colour names a colour option can use. */
export const COLOURS = ['accent', 'accent2', 'text', 'dim', 'ok', 'warn', 'crit', 'cold', 'oil', 'bar', 'track', 'panelTop', 'bg'];

/** The kit's vector icons (kit_vicons.js). */
export const ICONS = ['grid', 'check', 'arrowDown', 'clock', 'back', 'chevron', 'plus', 'trash', 'lock', 'unlock', 'warning',
    'gear', 'usb', 'refresh', 'gauge', 'stopwatch', 'camera', 'phone', 'tether', 'display', 'route', 'wrench', 'wifi'];

const FONTS = ['label', 'bold', 'num', 'light', 'gear'];

// option builders
const text = (key: string, label: string, def: string): WidgetOption => ({ key, label, kind: 'text', default: def });
const num = (key: string, label: string, def: number): WidgetOption => ({ key, label, kind: 'number', default: def });
const int = (key: string, label: string, def: number): WidgetOption => ({ key, label, kind: 'number', default: def, integer: true });
const bool = (key: string, label: string, def: boolean): WidgetOption => ({ key, label, kind: 'boolean', default: def });
const colour = (key: string, label: string, def = ''): WidgetOption => ({ key, label, kind: 'colour', default: def });
const choice = (key: string, label: string, def: string, choices: string[]): WidgetOption => ({ key, label, kind: 'choice', default: def, choices });
const icon = (key: string, label: string, def: string): WidgetOption => ({ key, label, kind: 'icon', default: def });
const image = (key: string, label: string, def: string): WidgetOption => ({ key, label, kind: 'image', default: def });
const rows = (key: string, label: string, def: string): WidgetOption => ({ key, label, kind: 'rows', default: def });
const SIZE = int('size', 'Text size (0 = fit)', 0);

const w = (type: string, label: string, size: [number, number], focusable: boolean, options: WidgetOption[]): Widget =>
    ({ type, label, size: { w: size[0], h: size[1] }, focusable, options });

export const WIDGETS: Widget[] = [
    // drawing
    w('text', 'Text', [374, 60], false, [text('text', 'Text', 'Hello'), int('size', 'Size', 48),
        choice('font', 'Font', 'label', FONTS), choice('align', 'Align', 'left', ['left', 'center', 'right']),
        colour('color', 'Colour', 'text'), bool('wrap', 'Wrap into the box (more lines, left aligned)', false)]),
    w('rect', 'Rectangle', [249, 125], false, [colour('color', 'Colour', 'panelTop'), num('radius', 'Corner radius', 16)]),
    w('line', 'Line', [249, 0], false, [colour('color', 'Colour', 'dim'), num('width', 'Width', 3)]),
    w('image', 'Picture', [160, 160], false, [image('src', 'Picture', ''), num('radius', 'Corner radius', 0)]),

    // controls
    w('button', 'Button', [349, 52], true, [text('text', 'Text', 'Apply'),
        choice('style', 'Style', 'primary', ['primary', 'secondary', 'outline', 'ghost']), SIZE, num('radius', 'Corner radius', 16),
        colour('color', 'Colour')]),
    w('roundButton', 'Round button', [75, 75], true, [choice('style', 'Style', 'tinted', ['tinted', 'filled', 'ring', 'outline']),
        bool('glow', 'Glow rings', false), colour('color', 'Colour')]),
    w('vbutton', 'Button with icon', [412, 75], true, [text('text', 'Text', 'Install'), icon('vicon', 'Icon', 'arrowDown'),
        choice('style', 'Style', 'primary', ['primary', 'outline', 'tinted', 'round']), colour('color', 'Colour'),
        bool('disabled', 'Greyed out', false), SIZE]),
    w('toggle', 'Switch', [81, 45], true, [bool('on', 'On', true), colour('color', 'Colour')]),
    w('slider', 'Slider', [499, 37], true, [num('min', 'Lowest', 0), num('max', 'Highest', 100), num('value', 'Value', 40),
        text('unit', 'Unit', '%'), int('decimals', 'Decimals', 0), bool('showValue', 'Show the value', true), colour('color', 'Colour')]),
    w('dropdown', 'Drop-down', [324, 52], true, [text('text', 'Text', 'Comfort'), bool('open', 'Open (arrow up)', false), SIZE]),
    w('tabs', 'Tabs / chips', [873, 52], true, [text('items', 'Items (comma separated)', 'Comfort,Cluster,Lighting,Multimedia'),
        int('sel', 'Selected (0 = first)', 0), choice('style', 'Style', 'joined', ['joined', 'chips', 'underline']), SIZE,
        colour('color', 'Colour')]),
    w('field', 'Text box', [437, 62], true, [text('text', 'Text', 'Turn on the fog lights'),
        text('label', 'Small label (inside, top)', ''), bool('caret', 'Typing cursor', false), bool('focus', 'Highlighted', false),
        choice('align', 'Align', 'left', ['left', 'center']), SIZE]),
    w('swatches', 'Colour swatches', [437, 45], true, [text('colors', 'Colours (comma separated)', '#ffffff,#f39c12,#2f6bff,#783cfe,#27ae60,#e1001a'),
        int('sel', 'Selected (-1 none)', 3), bool('add', 'Plus button', true)]),
    w('keyboard', 'Keyboard', [1472, 323], true, [bool('shift', 'Capitals', false), choice('layout', 'Keys', 'url', ['url', 'text']),
        text('go', 'Enter key text', 'Next'), bool('symbols', 'Symbols key #+= (word keys only)', false),
        bool('sym', 'Showing the symbols', false)]),

    // cards and rows
    w('card', 'Card', [624, 312], false, [text('title', 'Title', 'Changes'), text('badge', 'Count badge', ''),
        text('link', 'Link text (right)', ''), bool('selected', 'Highlighted', false), num('radius', 'Corner radius', 20),
        int('size', 'Title size', 34), colour('color', 'Highlight colour')]),
    w('tile', 'Menu tile', [384, 177], true, [text('title', 'Title', 'Coding'), text('sub', 'Text', 'Personal settings'),
        choice('layout', 'Layout', 'side', ['side', 'stacked']), bool('arrow', 'Arrow button', true),
        bool('selected', 'Highlighted', false), SIZE, colour('color', 'Colour')]),
    w('choice', 'Choice card', [368, 206], true, [text('title', 'Title', '2WD'), text('sub', 'Text', 'Rear-wheel drive'),
        bool('selected', 'Selected', true), SIZE, colour('color', 'Colour')]),
    w('row', 'Settings row', [1060, 65], true, [text('label', 'Text', 'Fold mirrors when locking'), text('sub', 'Small line', ''),
        colour('subColor', 'Small line colour'),
        choice('control', 'Control (right)', 'toggle', ['none', 'toggle', 'dropdown', 'slider', 'value', 'chevron', 'button']),
        bool('on', 'Switch on', true), text('text', 'Drop-down / value / chevron text', ''), num('min', 'Slider lowest', 0),
        num('max', 'Slider highest', 100), num('value', 'Slider value', 70), text('unit', 'Slider unit', '°'),
        bool('boxed', 'On a card', false), bool('divider', 'Line below', true), SIZE, colour('color', 'Colour')]),

    // lists and menus
    w('list', 'List', [873, 324], true, [rows('items', 'Rows, one per line: badge, title, small line',
        '3, Engine electronics, 0x12 · 2 active\n1, Body domain controller, 0x40 · stored\n2, Dynamic stability control, 0x29 · 1 active'),
        int('sel', 'Selected row (-1 none)', -1), int('top', 'First row shown (scrolled)', 0), int('rowH', 'Row height', 104),
        bool('chevron', 'Arrow on each row', true), text('empty', 'Text when there are no rows', 'Nothing here'), SIZE,
        colour('color', 'Colour')]),
    w('navRail', 'Side menu', [150, 417], true, [rows('items', 'Items, one per line: Label, icon',
        'Home, MainMenu\nGauges, AverageSpeed\nLighting, AmbientLight\nSettings, Settings'), int('sel', 'Selected (0 = first)', 0),
        choice('direction', 'Direction', 'vertical', ['vertical', 'horizontal']), bool('panel', 'Background', true), SIZE,
        colour('color', 'Colour')]),
    w('sideNav', 'Side menu with icons', [187, 453], true, [rows('items', 'Items, one per line: Label, icon, badge',
        'Store, grid\nInstalled, check, 2\nUSB, usb\nSettings, gear'), int('sel', 'Selected (0 = first)', 0)]),
    w('appGrid', 'App grid', [1484, 342], true, [rows('items', 'Tiles, one per line: title, small line, icon, colour',
        'Car Data, Update 1.1.4, gauge, #ff4b55\nFault Codes, Installed, wrench, #ffc24d\nDrag Timer, 1.1.2 · 0.9 MB, stopwatch, #5fb4ff'),
        int('cols', 'Columns', 5), int('tileH', 'Tile height', 274), int('top', 'First row shown', 0), text('empty', 'Text when empty', 'No apps')]),
    w('appList', 'App list', [798, 299], true, [rows('items', 'Rows, one per line: title, small line, right (chevron, trash, toggle:on, chip:Text; several: toggle:on+trash), icon',
        'Car Data, 1.1.3 → 1.1.4, chip:Update, gauge\nFault Codes, 1.1.1, chevron, wrench'),
        int('rowH', 'Row height', 120), int('top', 'First row shown', 0), text('empty', 'Text when empty', 'Nothing here')]),
    w('chips', 'Chips', [748, 42], false, [text('items', 'Chips: text|colour|dot; …', 'Version 1.1.4|text; 0.9 MB|text; App|#3d9bff'),
        choice('align', 'Align', 'left', ['left', 'right'])]),

    // headings and readouts
    w('titleBar', 'Title bar', [1796, 60], false, [text('title', 'Page title', 'Home'), text('right', 'Right text', ''),
        bool('line', 'Line below', true), int('size', 'Text size (0 = fit)', 0)]),
    w('metric', 'Metric card', [276, 143], false, [text('label', 'Label', 'Oil temperature'), num('value', 'Value', 96),
        text('unit', 'Unit', '°C'), int('decimals', 'Decimals', 0), num('min', 'Bar lowest', 0), num('max', 'Bar highest', 150),
        bool('bar', 'Bar', true), int('size', 'Number size (0 = fit)', 0), colour('color', 'Colour')]),
    w('progress', 'Progress', [561, 81], false, [text('label', 'Label', 'Recording storage'), text('right', 'Right text', 'Free 82 GB'),
        text('sub', 'Small line', 'USB · 128 GB'), num('min', 'Lowest', 0), num('max', 'Highest', 100), num('value', 'Value', 36),
        bool('percent', 'Show percent', true), SIZE, colour('color', 'Colour')]),
    w('colorPicker', 'Colour picker', [511, 387], false, [text('value', 'Colour (#rrggbb)', '#783cfe'),
        bool('fields', 'R G B + hex boxes', true)]),
    w('waveform', 'Waveform', [773, 125], false, [int('bars', 'Bars', 56), num('level', 'Loudness (0-1)', 0.8),
        num('gap', 'Gap in the middle (0-0.5)', 0.2), colour('color', 'Colour')]),
    w('appIcon', 'App icon', [187, 187], false, [text('icon', 'Picture (key:name, from the app)', ''), icon('vicon', 'Icon', 'gauge'),
        text('letter', 'Letter (no icon)', ''), choice('kind', 'Kind', 'app', ['app', 'service']),
        text('colors', 'Colours (two, comma separated)', '#ff4b55,#a8101c'), choice('badge', 'Badge', '', ['', 'installed', 'update', 'queued']),
        num('progress', 'Download progress (-1 none, 0-1)', -1)]),
    w('qr', 'QR code', [249, 249], false, [text('text', 'Text', '')]),
    w('sheet', 'Sheet (dims the screen)', [935, 324], false, [num('dim', 'Dim (0-1)', 0.55), num('radius', 'Corner radius', 32)]),
];

const BY_TYPE = new Map(WIDGETS.map((x) => [x.type, x]));

/** The catalog entry for a widget type, or undefined when the catalog doesn't offer it. */
export function widget(type: string): Widget | undefined {
    return BY_TYPE.get(type);
}

/** A widget's options set to their defaults: what a new element starts with. */
export function defaultsOf(type: string): Record<string, unknown> {
    const wd = BY_TYPE.get(type);
    if (!wd) throw new Error(`no widget ${type}`);
    const o: Record<string, unknown> = {};
    for (const opt of wd.options) o[opt.key] = opt.default;
    return o;
}
