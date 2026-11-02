'use strict';
// Seam 3: the widget catalog's default sizes against the vendored kit. A widget dropped on the iDrive 7 screen
// (1796 x 632, drawn at scale 1) gets its catalog size; drawn there with its defaults, its texts must stay inside
// its box and be large enough to read on the head unit (the Store's iDrive 7 screens use 20 px and up).
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { record } = require(path.join(ROOT, 'kit', 'am_gpu.js'));
const { Recorder } = require(path.join(ROOT, 'kit', 'kit_record.js'));

const DESIGN = { w: 1796, h: 632 };
const SMALLEST = 18;
// The kit draws a text box's small label (the colour picker's R, G and B) at 16 px however large the box is.
const SMALL_LABELS = { colorPicker: ['R', 'G', 'B'] };

let catalog;
before(async () => { catalog = await import(path.join(ROOT, 'designer', 'src', 'catalog.ts')); });

/** The texts the kit draws for one element: string, left, right, top and bottom (roughly: y is the baseline), size. */
function textsOf(element) {
    const texts = [];
    const text = Recorder.prototype.text;
    Recorder.prototype.text = function (str, x, y, size, c, opts) {
        const w = text.call(this, str, x, y, size, c, opts);
        const align = (opts && opts.align) || 'left';
        const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        texts.push({ s: String(str), left, right: left + w, top: y - size * 0.8, bottom: y + size * 0.2, size });
        return w;
    };
    try {
        record({ bg: 'none', theme: 'm_tricolour', components: [element] },
            { textScale: 1, design: DESIGN, area: { x: 0, y: 0, w: DESIGN.w, h: DESIGN.h } });
    } finally {
        Recorder.prototype.text = text;
    }
    return texts;
}

test('every widget at its default size keeps its default texts inside its box, at a size the driver can read', () => {
    const problems = [];
    for (const w of catalog.WIDGETS) {
        const x = 40, y = 0, width = w.size.w, height = w.size.h;
        const el = { name: w.type, gpu: w.type, x, y, w: width, h: height, opts: catalog.defaultsOf(w.type) };
        for (const t of textsOf(el)) {
            if (t.left < x - 1 || t.right > x + width + 1) problems.push(`${w.type}: "${t.s}" runs out of the box`);
            else if (t.top < y - 4 || t.bottom > y + height + 4) problems.push(`${w.type}: "${t.s}" runs out of the box`);
            if (t.size < SMALLEST && !(SMALL_LABELS[w.type] || []).includes(t.s)) problems.push(`${w.type}: "${t.s}" is ${Math.round(t.size)} px`);
        }
    }
    assert.deepStrictEqual(problems, []);
});
