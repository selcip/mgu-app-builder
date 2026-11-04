// The icon picker: the kit's vector icons (kit_vicons.js), each drawn by the kit itself, to set an element's icon.
import { useEffect, useRef, useState } from 'react';
import mgu from 'virtual:mgu-runtime';
import { ICONS } from './catalog.ts';

const SIZE = 28;

/** One vector icon, drawn by the kit onto a small canvas. */
export function Vicon({ name, size = SIZE }: { name: string; size?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas && canvas.getContext('2d');
        if (!canvas || !ctx) return;
        const cv = new mgu.Canvas(size, size);
        if (name) mgu.vicon(cv, name, 2, 2, size - 4, '#ffffff');
        ctx.putImageData(new ImageData(new Uint8ClampedArray(cv.d.buffer, cv.d.byteOffset, cv.d.byteLength), size, size), 0, 0);
    }, [name, size]);
    return <canvas ref={ref} width={size} height={size} className="block flex-none" aria-hidden="true" />;
}

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
    const [open, setOpen] = useState(false);
    const pick = (name: string) => { onChange(name); setOpen(false); };
    return (
        <span className="relative min-w-0">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
                className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md border border-input bg-input/30 px-1.5 text-xs">
                <Vicon name={value} size={20} /> <span className="truncate">{value || '(none)'}</span>
            </button>
            {open && (
                <span role="listbox" aria-label="Vector icons"
                    className="absolute right-0 z-40 mt-1 grid max-h-80 w-72 grid-cols-4 gap-1 overflow-y-auto rounded-lg border bg-popover p-1.5 shadow-xl">
                    {['', ...ICONS].map((name) => (
                        <button type="button" role="option" key={name || '(none)'} aria-selected={name === value} data-icon={name} title={name || 'none'}
                            onClick={() => pick(name)}
                            className="flex flex-col items-center gap-0.5 rounded-md border border-transparent p-1 hover:bg-accent aria-selected:border-blue-500">
                            <Vicon name={name} /><small className="max-w-full truncate text-[0.65rem] text-muted-foreground">{name || 'none'}</small>
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
}
