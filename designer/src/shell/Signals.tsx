// Trying a cluster layout: a card over the canvas with the demo signals (sliders in rpm, km/h, degrees C and bar, the
// drive mode) and the Demo drive, which moves them by itself (the kit's simulated drive, run by the engine). The values
// live in the editor store and reach the engine through feed() (ClusterStage); they are never part of the document.
import { useActions, useEditor } from '../store/react.tsx';
import { kindOf } from '../store/editor.ts';
import { DRIVE_MODES, SLIDERS } from '../store/signals.ts';
import { Button } from '@/components/ui/button';

export function SignalsPanel() {
    const trying = useEditor((s) => s.trying);
    const layout = useEditor(kindOf) === 'cluster-layout';
    const signals = useEditor((s) => s.signals);
    const demo = useEditor((s) => s.demoDrive);
    const { setSignal, setDemoDrive } = useActions();
    if (!trying || !layout) return null;
    return (
        <div data-signals-panel="" aria-label="Signals"
            className="absolute right-3 bottom-3 z-30 flex max-h-[70%] w-80 flex-col rounded-lg border bg-card text-card-foreground shadow-xl shadow-black/40">
            <div className="flex h-10 flex-none items-center gap-1 border-b px-3 text-xs font-medium text-muted-foreground">
                <span className="flex-1">Signals</span>
                <Button variant={demo ? 'default' : 'ghost'} size="xs" role="switch" aria-checked={demo} data-demo-drive=""
                    title="The kit's simulated drive moves the signals by itself" onClick={() => setDemoDrive(!demo)}>
                    {demo ? 'Stop demo drive' : 'Demo drive'}
                </Button>
            </div>
            <div className={`flex flex-col gap-2 overflow-y-auto px-3 py-2 text-xs ${demo ? 'opacity-50' : ''}`}>
                {SLIDERS.map((s) => (
                    <label key={s.key} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-2">
                        <span>{s.label}</span>
                        <input type="range" data-signal={s.key} aria-label={s.label} min={s.min} max={s.max} step={s.step}
                            value={signals[s.key]} disabled={demo} onChange={(e) => setSignal(s.key, Number(e.target.value))} />
                        <output className="text-right font-mono tabular-nums">{signals[s.key]}{s.unit && ' ' + s.unit}</output>
                    </label>
                ))}
                <div role="radiogroup" aria-label="Drive mode" className="flex items-center gap-1">
                    <span className="w-[7.5rem]">Drive mode</span>
                    {DRIVE_MODES.map((m) => (
                        <Button key={m.id} role="radio" aria-checked={signals.drive === m.id} data-drive-mode={m.id}
                            variant={signals.drive === m.id ? 'default' : 'outline'} size="xs" disabled={demo} onClick={() => setSignal('drive', m.id)}>
                            {m.label}
                        </Button>
                    ))}
                </div>
                {demo && <p className="m-0 text-[0.7rem] text-muted-foreground">The demo drive sets rpm, speed, gear and temperatures; stop it to use the sliders.</p>}
            </div>
        </div>
    );
}
