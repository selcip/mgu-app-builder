// The demo signals Trying a cluster layout feeds the engine (plain TypeScript, no React). The panel's sliders are in
// the units a person reads (rpm, km/h, degrees C, bar); the engine takes what the car sends, raw SOME/IP values,
// which `feedsOf` makes the way the apps bench does (bench/run-app.js, itself a copy of kit/runtime/car.js's scaling
// and hud.js's FES boost and TPMS fields). The vendored engine is not edited; this is the Designer's own copy of that
// mapping, kept honest by test/cluster-signals.test.js and the pixel golden against the bench's stage.

export type DriveMode = 'sport' | 'comfort' | 'eco';

export interface Signals {
    rpm: number; speed: number; gear: number; oil: number; coolant: number; boost: number;
    /** Tyre pressure (bar) and temperature (C) of the front pair; the rear pair reads a notch higher, as on the bench. */
    tyreP: number; tyreT: number;
    drive: DriveMode;
}
export type SliderKey = Exclude<keyof Signals, 'drive'>;

export interface Slider { key: SliderKey; label: string; unit: string; min: number; max: number; step: number }

export const SLIDERS: Slider[] = [
    { key: 'rpm', label: 'Engine speed', unit: 'rpm', min: 0, max: 8000, step: 50 },
    { key: 'speed', label: 'Speed', unit: 'km/h', min: 0, max: 300, step: 1 },
    { key: 'gear', label: 'Gear', unit: '', min: 0, max: 8, step: 1 },
    { key: 'oil', label: 'Oil temperature', unit: '°C', min: 0, max: 150, step: 1 },
    { key: 'coolant', label: 'Coolant temperature', unit: '°C', min: 0, max: 150, step: 1 },
    { key: 'boost', label: 'Boost', unit: 'bar', min: 0, max: 2, step: 0.05 },
    { key: 'tyreP', label: 'Tyre pressure', unit: 'bar', min: 1.5, max: 3.5, step: 0.1 },
    { key: 'tyreT', label: 'Tyre temperature', unit: '°C', min: 0, max: 100, step: 1 },
];

/** The drive modes, by the number the car's mode buttons send (1 Sport, 4 Comfort, 7 Eco Pro). */
export const DRIVE_MODES: { id: DriveMode; label: string; wire: number }[] = [
    { id: 'sport', label: 'Sport', wire: 1 },
    { id: 'comfort', label: 'Comfort', wire: 4 },
    { id: 'eco', label: 'Eco Pro', wire: 7 },
];

export const defaultSignals = (): Signals => ({ rpm: 0, speed: 0, gear: 0, oil: 100, coolant: 90, boost: 0, tyreP: 2.3, tyreT: 24, drive: 'comfort' });

/** A value clamped to its slider's range; null for a name that is not a slider. */
export function clampSignal(key: string, value: number): number | null {
    const s = SLIDERS.find((x) => x.key === key);
    if (!s || !Number.isFinite(value)) return null;
    return Math.min(s.max, Math.max(s.min, value));
}

export interface Feed { iface: string; field: string; value: Record<string, unknown> }

// the car's scaling: raw = (value - offset) / factor
const rpmRaw = (v: number) => Math.round(v / 0.25);
const speedRaw = (v: number) => Math.round(v / 0.015625);
const tempRaw = (v: number) => Math.round(v + 48);
const accelRaw = (g: number) => Math.round((g * 9.80665 + 65) / 0.002);
const torqueRaw = (nm: number) => Math.round((nm + 1023.5) / 0.5);
const boostRaw = (bar: number) => Math.round(Math.max(0, bar) / 0.01);

/** Every field the bench feeds, with the signals as raw values. What the sliders do not set is the bench's default. */
export function feedsOf(s: Signals): Feed[] {
    const g = Math.round(s.gear);
    const tp = Math.round(s.tyreP * 10), tt = Math.round(s.tyreT + 40);
    const wire = DRIVE_MODES.find((m) => m.id === s.drive)!.wire;
    return [
        { iface: 'de.bmw.infotainment.vehicle.CDS', field: 'statusEngineSpeed2', value: { actualValueRPMEngineCrankshaft: rpmRaw(s.rpm) } },
        { iface: 'de.bmw.infotainment.vehicle.Vehicle2', field: 'statusCarSpeed2', value: { speedVehicleCentreOfGravity: speedRaw(s.speed) } },
        { iface: 'de.bmw.infotainment.vehicle.CDS2', field: 'statusLongitudinalAccelerationMassCenter', value: { longitudinalAccelerationCentreOfGravity: accelRaw(0) } },
        { iface: 'de.bmw.infotainment.vehicle.CDS2', field: 'statusLateralAccelerationMassCenter', value: { lateralAccelerationCentreOfGravity: accelRaw(0) } },
        { iface: 'de.bmw.infotainment.vehicle.CDS', field: 'statusEngineTemperature', value: { temperatureEngineDrive: tempRaw(s.coolant), temperatureEngineOilDrive: tempRaw(s.oil) } },
        { iface: 'de.bmw.infrastructure.VehicleInformation', field: 'statusGearboxDrive', value: { statusActualGearDrive: g > 0 ? 'G' + g : 'N_OR_P', statusActualStageDrive: g > 0 ? 'D' : 'P' } },
        { iface: 'de.bmw.infotainment.drivingexcitement.FES', field: 'statusActualValueTorque2', value: { actualValueTorqueCrankshaft: torqueRaw(0) } },
        { iface: 'de.bmw.infotainment.drivingexcitement.FES', field: 'statusSwitchDriveDynamicSport2', value: { displayBoostPressure: boostRaw(s.boost) } },
        { iface: 'de.bmw.infotainment.drivingexcitement.FES', field: 'statusFESVehicleDynamicSwitchHMI', value: { actualValueModeDrivingExperience: wire } },
        { iface: 'de.bmw.infotainment.KombiIF', field: 'statusRangeTankStatus', value: { fluidLevelFuelTank: 40, range: 450 } },
        { iface: 'de.bmw.infrastructure.EnvironmentalInformation', field: 'ExteriorTemperature', value: { temperatureExterior: Math.round((22 + 40) / 0.5) } },
        { iface: 'de.bmw.infotainment.vehicle.TPMS', field: 'statusTyrePressure', value: { actualValuePressureTyreFLH: tp, actualValuePressureTyreFRH: tp, actualValuePressureTyreRLH: tp + 2, actualValuePressureTyreRRH: tp + 2 } },
        { iface: 'de.bmw.infotainment.vehicle.TPMS', field: 'statusTyreTemperature', value: { actualValueTemperatureTyreFLH: tt, actualValueTemperatureTyreFRH: tt, actualValueTemperatureTyreRLH: tt + 3, actualValueTemperatureTyreRRH: tt + 3 } },
    ];
}
