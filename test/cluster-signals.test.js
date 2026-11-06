'use strict';
// Seam 1 of Trying a cluster layout: the signals panel's slider units (rpm, km/h, C, bar) become the raw SOME/IP values
// the car sends, as the apps bench does (bench/run-app.js); and trying (with signals and a demo drive) never touches the
// document or its undo history. Expected raw values are worked by hand from the car's scaling (rpm x0.25, speed x1/64,
// temperature -48, FES boost x0.01, TPMS 0.1 bar and raw - 40 C), not computed with the code's own formulas.
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
let SIG, S, model;
before(async () => {
    SIG = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'store', 'signals.ts')).href);
    S = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'store', 'editor.ts')).href);
    model = await import(pathToFileURL(path.join(ROOT, 'designer', 'src', 'model', 'index.ts')).href);
});

const CDS = 'de.bmw.infotainment.vehicle.CDS', FES = 'de.bmw.infotainment.drivingexcitement.FES', TPMS = 'de.bmw.infotainment.vehicle.TPMS';
const feed = (feeds, iface, field) => { const f = feeds.find((x) => x.iface === iface && x.field === field); assert.ok(f, `${iface} ${field} is fed`); return f.value; };

test('slider units become the raw values the car sends', () => {
    const f = SIG.feedsOf({ ...SIG.defaultSignals(), rpm: 6800, speed: 100, gear: 3, oil: 100, coolant: 90, boost: 0.8, drive: 'sport', tyreP: 2.3, tyreT: 24 });
    assert.deepStrictEqual(feed(f, CDS, 'statusEngineSpeed2'), { actualValueRPMEngineCrankshaft: 27200 });
    assert.deepStrictEqual(feed(f, 'de.bmw.infotainment.vehicle.Vehicle2', 'statusCarSpeed2'), { speedVehicleCentreOfGravity: 6400 });
    assert.deepStrictEqual(feed(f, CDS, 'statusEngineTemperature'), { temperatureEngineDrive: 138, temperatureEngineOilDrive: 148 });
    assert.deepStrictEqual(feed(f, 'de.bmw.infrastructure.VehicleInformation', 'statusGearboxDrive'), { statusActualGearDrive: 'G3', statusActualStageDrive: 'D' });
    assert.deepStrictEqual(feed(f, FES, 'statusSwitchDriveDynamicSport2'), { displayBoostPressure: 80 });
    assert.deepStrictEqual(feed(f, FES, 'statusFESVehicleDynamicSwitchHMI'), { actualValueModeDrivingExperience: 1 });
    // tyres: pressure in 0.1 bar, temperature raw - 40 C, the rear pair a notch higher
    assert.deepStrictEqual(feed(f, TPMS, 'statusTyrePressure'), { actualValuePressureTyreFLH: 23, actualValuePressureTyreFRH: 23, actualValuePressureTyreRLH: 25, actualValuePressureTyreRRH: 25 });
    assert.deepStrictEqual(feed(f, TPMS, 'statusTyreTemperature'), { actualValueTemperatureTyreFLH: 64, actualValueTemperatureTyreFRH: 64, actualValueTemperatureTyreRLH: 67, actualValueTemperatureTyreRRH: 67 });
});

test('gear 0 is neutral/park, and the drive modes are the car\'s wire numbers', () => {
    const f = SIG.feedsOf({ ...SIG.defaultSignals(), gear: 0, drive: 'eco' });
    assert.deepStrictEqual(feed(f, 'de.bmw.infrastructure.VehicleInformation', 'statusGearboxDrive'), { statusActualGearDrive: 'N_OR_P', statusActualStageDrive: 'P' });
    assert.strictEqual(feed(f, FES, 'statusFESVehicleDynamicSwitchHMI').actualValueModeDrivingExperience, 7);
    assert.strictEqual(feed(SIG.feedsOf({ ...SIG.defaultSignals(), drive: 'comfort' }), FES, 'statusFESVehicleDynamicSwitchHMI').actualValueModeDrivingExperience, 4);
});

test('every slider has a range that holds its default, and every value is fed as a whole number', () => {
    const d = SIG.defaultSignals();
    for (const s of SIG.SLIDERS) {
        assert.ok(s.min <= d[s.key] && d[s.key] <= s.max, s.key);
        for (const v of [s.min, s.max]) {
            const f = SIG.feedsOf({ ...d, [s.key]: v });
            for (const x of f) for (const n of Object.values(x.value)) if (typeof n === 'number') assert.ok(Number.isInteger(n), `${s.key}=${v}: ${n}`);
        }
    }
    assert.deepStrictEqual(SIG.SLIDERS.map((s) => s.key), ['rpm', 'speed', 'gear', 'oil', 'coolant', 'boost', 'tyreP', 'tyreT']);
});

test('trying a cluster layout with signals and a demo drive leaves the document and its history as they were', () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', 'gt3.json')));
    const store = S.createEditorStore();
    store.getState().open(model.openBytes(bytes));
    assert.ok(store.getState().edit({ type: 'renameLayout', name: 'Mine' }));
    const history = store.getState().history;
    const doc = store.getState().history.present;
    store.getState().setTrying(true);
    store.getState().setSignal('rpm', 6800);
    store.getState().setSignal('drive', 'sport');
    store.getState().setDemoDrive(true);
    assert.strictEqual(store.getState().signals.rpm, 6800);
    assert.strictEqual(store.getState().demoDrive, true);
    store.getState().setTrying(false);
    assert.strictEqual(store.getState().history, history);
    assert.strictEqual(store.getState().history.present, doc);
    assert.strictEqual(store.getState().demoDrive, false, 'the demo drive stops with trying');
    store.getState().undo();
    assert.strictEqual(S.layoutOf(store.getState()).name, 'GT3');
});

test('a signal outside its slider\'s range is clamped, and an unknown signal is ignored', () => {
    const store = S.createEditorStore();
    store.getState().setSignal('rpm', 99999);
    assert.strictEqual(store.getState().signals.rpm, SIG.SLIDERS.find((s) => s.key === 'rpm').max);
    store.getState().setSignal('nope', 1);
    assert.strictEqual('nope' in store.getState().signals, false);
});

test('what feedsOf sends is decoded by the vendored engine\'s own decoders back to the slider values (drift fails)', async () => {
    const { createEngine } = require('../cluster/node.js');
    const gt3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'cluster-layouts', 'gt3.json'), 'utf8'));
    const near = (got, want, what) => assert.ok(Math.abs(got - want) < 1e-6, `${what}: the engine decoded ${got}, the slider said ${want}`);
    for (const sig of [
        { ...SIG.defaultSignals(), rpm: 6800, speed: 100, gear: 3, oil: 105, coolant: 88, boost: 0.8, tyreP: 2.6, tyreT: 31, drive: 'sport' },
        { ...SIG.defaultSignals(), rpm: 1250, speed: 12.5, gear: 0, oil: 20, coolant: 70, boost: 0, tyreP: 1.5, tyreT: 0, drive: 'eco' },
    ]) {
        const engine = createEngine({ name: 'gt3', layout: gt3, settings: { demo: 'off' } });
        try {
            await new Promise((r) => setTimeout(r, 100));
            for (const f of SIG.feedsOf(sig)) engine.feed(f.iface, f.field, f.value);
            const d = engine.hud.car.data(), h = engine.hud;
            near(d.rpm, sig.rpm, 'rpm'); near(d.speed, sig.speed, 'speed');
            near(d.coolant, sig.coolant, 'coolant'); near(d.oil, sig.oil, 'oil');
            assert.strictEqual(d.gear, sig.gear);
            near(d.gLong, 0, 'longitudinal g'); near(d.gLat, 0, 'lateral g'); near(d.torque, 0, 'torque');
            near(h.boostFes, sig.boost, 'boost');
            ['FL', 'FR'].forEach((k) => { near(h.tyres.p[k], sig.tyreP, 'tyre pressure ' + k); near(h.tyres.t[k], sig.tyreT, 'tyre temperature ' + k); });
            ['RL', 'RR'].forEach((k) => { near(h.tyres.p[k], sig.tyreP + 0.2, 'tyre pressure ' + k); near(h.tyres.t[k], sig.tyreT + 3, 'tyre temperature ' + k); });
            near(h.ambient, 22, 'outside temperature');
            assert.strictEqual(h.fuelL, 40); assert.strictEqual(h.rangeKm, 450);
            assert.strictEqual(h.driveMode, sig.drive);
        } finally { engine.stop(); }
    }
});
