'use strict';
// Writes screens.json and redline.zip: an example screen file after idrive7-apps' Redline (apps/redline), for
// trying the Designer (main menu → Open… → redline.zip). Run: node examples/redline/make.js
//
// Redline draws every frame in code (1600 × 520, gauges.js); this is a hand port of its fixed layout onto the
// Designer's 1796 × 632 screen with the kit's widgets, showing sample values. The live parts (the rev bar filling,
// the shift lights, the gear) are rectangles and texts here: on the car the app's code would set them, or draw them
// in a Drawing area (.scratch/import-idrive7/spec.md). Redline's HMI side buttons and settings list become
// elements and a Settings screen (docs/adr/0003-import-copies-idrive7-apps.md).
const fs = require('fs');
const path = require('path');
const { zipSync, strToU8 } = require('fflate');

const THEME = 'm_tricolour';
const el = (name, gpu, x, y, w, h, opts) => ({ name, rtype: 'gpu', gpu, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), opts });
const text = (name, x, y, w, h, t, size, more) => el(name, 'text', x, y, w, h, Object.assign({ text: t, size, font: 'label', align: 'left', color: 'text' }, more));
const label = (name, x, y, w, t, align) => text(name, x, y, w, 30, t, 22, { font: 'bold', color: 'dim', align: align || 'left' });

// ---- tach: the rev bar across the middle, rpm above, gear below, speed and temperatures left, shift info right
const RPM = 6420, SHIFT = 6700, REDLINE = 7000, MAX = 8000;
const BAR = { x: 449, y: 262, w: 898, h: 72 };
const SEG = 16, SEG_GAP = 4, SEG_W = (BAR.w - (SEG - 1) * SEG_GAP) / SEG;   // 500 rpm segments
const tach = [];

// angular frame lines (Redline's polylines, scaled)
const fx = (x) => x * 1796 / 1600, fy = (y) => y * 632 / 520;
const frame = [[24, 92], [330, 92], [370, 122], [1230, 122], [1270, 92], [1576, 92]];
const frameB = [[24, 512], [330, 512], [370, 486], [1230, 486], [1270, 512], [1576, 512]];
[['frameTop', frame], ['frameBottom', frameB]].forEach(([n, pts]) => pts.slice(1).forEach((p, i) => {
    const a = pts[i];
    tach.push(el(`${n}${i + 1}`, 'line', fx(a[0]), fy(a[1]), fx(p[0]) - fx(a[0]), fy(p[1]) - fy(a[1]), { color: i === 2 ? 'accent' : 'dim', width: i === 2 ? 3 : 2 }));
}));

// the top bar: the HMI's side buttons as elements
tach.push(el('toLog', 'vbutton', 27, 22, 300, 62, { text: 'Shift log', vicon: 'stopwatch', style: 'outline', color: '', disabled: false, size: 0 }));
tach.push(el('toSettings', 'vbutton', 1469, 22, 300, 62, { text: 'Settings', vicon: 'gear', style: 'outline', color: '', disabled: false, size: 0 }));
tach.push(el('resetMax', 'button', 1150, 22, 300, 62, { text: 'Reset max', style: 'ghost', size: 0, radius: 16, color: '' }));

// rpm readout
tach.push(text('rpm', 640, 158, 400, 76, String(RPM), 72, { font: 'num', align: 'center' }));
tach.push(label('rpmUnit', 1010, 196, 100, 'RPM'));

// shift lights: 12 over the last 2000 rpm before the shift point, green → yellow → red
const LEDS = 12, LED_W = 62, LED_GAP = 13, ledX = BAR.x + (BAR.w - (LEDS * LED_W + (LEDS - 1) * LED_GAP)) / 2;
const lit = Math.floor(Math.max(0, Math.min(1, (RPM - (SHIFT - 2000)) / 2000)) * LEDS);
for (let i = 0; i < LEDS; i++) {
    const col = i < 5 ? '#2fd27a' : i < 9 ? '#ffc21a' : '#ff2a2a';
    tach.push(el(`light${i + 1}`, 'rect', ledX + i * (LED_W + LED_GAP), 236, LED_W, 14, { color: i < lit ? col : 'track', radius: 4 }));
}

// rev bar: 16 segments of 500 rpm, filled up to the rpm, red past the redline
for (let i = 0; i < SEG; i++) {
    const from = i * 500, filled = RPM > from;
    const col = !filled ? (from >= REDLINE ? '#4a1418' : 'track') : from >= SHIFT - 1000 ? '#ffc21a' : i < 6 ? '#1c69d4' : '#3d8bff';
    tach.push(el(`seg${i + 1}`, 'rect', BAR.x + i * (SEG_W + SEG_GAP), BAR.y, SEG_W, BAR.h, { color: col, radius: 3 }));
}
// scale: a number every 1000 rpm under the bar
for (let k = 0; k <= MAX / 1000; k++) {
    const x = BAR.x + (k * 1000 / MAX) * BAR.w;
    tach.push(text(`scale${k}`, x - 30, 346, 60, 34, String(k), 26, { font: 'bold', align: 'center', color: k * 1000 >= REDLINE ? 'crit' : 'text' }));
}

// gear
tach.push(text('gear', 748, 384, 300, 230, '3', 200, { font: 'gear', align: 'center' }));

// left column: speed, oil, water, peak
tach.push(label('speedLabel', 45, 182, 200, 'SPEED'));
tach.push(text('speed', 40, 214, 220, 124, '128', 116, { font: 'num' }));
tach.push(text('speedUnit', 262, 290, 100, 34, 'km/h', 26, { color: 'dim' }));
tach.push(el('leftRule', 'line', 45, 362, 337, 0, { color: 'dim', width: 1 }));
tach.push(label('oilLabel', 45, 392, 120, 'OIL'));
tach.push(text('oil', 45, 424, 140, 50, '92°', 40, { font: 'bold' }));
tach.push(label('waterLabel', 213, 392, 140, 'WATER'));
tach.push(text('water', 213, 424, 140, 50, '88°', 40, { font: 'bold' }));
tach.push(label('peak', 45, 560, 420, 'PEAK 6880  ·  LIMITER 0x'));

// right column: shift point, last shift and its verdict
const RX = 1414, RW = 337;
tach.push(label('shiftAtLabel', RX, 182, RW, 'SHIFT AT', 'right'));
tach.push(text('shiftAt', RX, 214, RW, 80, String(SHIFT), 64, { font: 'num', align: 'right' }));
tach.push(el('rightRule', 'line', RX, 362, RW, 0, { color: 'dim', width: 1 }));
tach.push(label('lastShiftLabel', RX, 392, RW, 'LAST SHIFT', 'right'));
tach.push(text('lastShift', RX + 120, 424, RW - 120, 64, '6610', 52, { font: 'num', align: 'right' }));
tach.push(label('lastGears', RX + 60, 446, 110, '2 > 3', 'right'));
tach.push(text('verdict', RX, 500, RW, 34, 'SPOT ON', 24, { font: 'bold', align: 'right', color: '#2fd27a' }));

// ---- shift log: recent upshifts on the left, shift accuracy on the right
const log = [
    el('recentCard', 'card', 27, 20, 856, 592, { title: 'Recent upshifts', badge: '', link: '', selected: false, radius: 20, size: 34, color: '' }),
    el('reset', 'button', 603, 34, 260, 60, { text: 'Reset max', style: 'outline', size: 0, radius: 16, color: '' }),
    el('shifts', 'list', 51, 112, 808, 480, {
        items: ['SPOT ON, 2 > 3 · 6610 rpm, 14:02:11 · target 6700', 'EARLY, 3 > 4 · 6120 rpm, 14:02:16 · target 6700',
            'SPOT ON, 4 > 5 · 6650 rpm, 14:02:23 · target 6700', 'LATE, 1 > 2 · 6980 rpm, 14:05:40 · target 6700',
            'LIMITER, 2 > 3 · 7000 rpm, 14:05:44 · target 6700'].join('\n'),
        sel: -1, top: 0, rowH: 96, chevron: false, empty: 'No shifts yet: go and use the rev range.', size: 0, color: '',
    }),
    el('accuracyCard', 'card', 913, 20, 856, 592, { title: 'Shift accuracy', badge: '', link: '', selected: false, radius: 20, size: 34, color: '' }),
    text('spotOn', 945, 110, 400, 120, '67%', 110, { font: 'num', color: '#2fd27a' }),
    label('spotOnLabel', 950, 236, 500, 'SPOT ON  (12 SHIFTS)'),
    el('early', 'progress', 945, 290, 790, 96, { label: 'Early', right: '2', sub: '', min: 0, max: 12, value: 2, percent: false, size: 0, color: 'warn' }),
    el('late', 'progress', 945, 396, 790, 96, { label: 'Late', right: '1', sub: '', min: 0, max: 12, value: 1, percent: false, size: 0, color: 'crit' }),
    el('limiter', 'progress', 945, 502, 790, 96, { label: 'Limiter', right: '1', sub: '', min: 0, max: 12, value: 1, percent: false, size: 0, color: 'crit' }),
];

// ---- settings: Redline's settings list as rows (the app's code fills and handles them)
const row = (name, i, lbl, control, more) => el(name, 'row', 48, 16 + i * 86, 1700, 80, Object.assign({
    label: lbl, sub: '', subColor: '', control, on: false, text: '', min: 0, max: 100, value: 70, unit: '', boxed: false,
    divider: true, size: 0, color: '',
}, more));
const settings = [
    row('redline', 0, 'Redline', 'value', { text: '7000 rpm' }),
    row('shiftBefore', 1, 'Shift point before redline', 'value', { text: '300 rpm' }),
    row('lights', 2, 'Shift light style', 'dropdown', { text: 'M (green-yellow-red)' }),
    row('flash', 3, 'Blink and flash at shift point', 'toggle', { on: false }),
    row('coldGuard', 4, 'Cold-engine rev guard', 'toggle', { on: true, sub: 'Shift point pulled down until the oil is warm' }),
    row('speedUnit', 5, 'Units', 'dropdown', { text: 'km/h' }),
    row('theme', 6, 'Colour theme', 'dropdown', { text: 'M Tricolour', divider: false }),
];

const file = {
    schema: 1,
    first: 'tach',
    design: { w: 1796, h: 632 },
    screens: [
        { name: 'tach', kind: 'gpu', title: 'Redline', theme: THEME, bg: 'theme', nav: { toLog: 'log', toSettings: 'settings' }, components: tach },
        { name: 'log', kind: 'gpu', title: 'Shift log', theme: THEME, bg: 'theme', components: log },
        { name: 'settings', kind: 'gpu', title: 'Settings', theme: THEME, bg: 'theme', components: settings },
    ],
};

const json = JSON.stringify(file, null, 1) + '\n';
fs.writeFileSync(path.join(__dirname, 'screens.json'), json);
fs.writeFileSync(path.join(__dirname, 'redline.zip'), zipSync({ 'screens.json': strToU8(json) }));
console.log(`screens.json and redline.zip: ${file.screens.map((s) => `${s.name} (${s.components.length})`).join(', ')}`);
