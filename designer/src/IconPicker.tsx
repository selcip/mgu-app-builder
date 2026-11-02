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
    return <canvas ref={ref} width={size} height={size} className="vicon" aria-hidden="true" />;
}

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
    const [open, setOpen] = useState(false);
    const pick = (name: string) => { onChange(name); setOpen(false); };
    return (
        <span className="icon-picker">
            <button type="button" className="icon-current" aria-expanded={open} onClick={() => setOpen(!open)}>
                <Vicon name={value} /> {value || '(none)'}
            </button>
            {open && (
                <span className="icon-grid" role="listbox" aria-label="Vector icons">
                    <button type="button" role="option" aria-selected={value === ''} data-icon="" onClick={() => pick('')}>
                        <Vicon name="" /><small>none</small>
                    </button>
                    {ICONS.map((name) => (
                        <button type="button" role="option" key={name} aria-selected={name === value} data-icon={name} title={name}
                            onClick={() => pick(name)}>
                            <Vicon name={name} /><small>{name}</small>
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
}
