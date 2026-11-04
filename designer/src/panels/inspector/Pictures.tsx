// Pictures: the app author's PNGs, kept under images/ beside the screen file. A picture option picks one of them or
// takes an upload; the images panel lists them (used or not) and the pictures elements name that the design lacks.
import { useEffect, useState, type ChangeEvent } from 'react';
import { imagePathFor, missingImages, usedImages } from '../../model/index.ts';
import { docOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';
import { ImagePlus, Upload, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Section, selectClass } from '@/components/designer/form';
import { cn } from '@/lib/utils';

/** A small preview of a PNG's bytes. */
function Thumb({ bytes }: { bytes: Uint8Array | undefined }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!bytes) { setUrl(null); return; }
        const u = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [bytes]);
    const box = 'size-7 flex-none rounded border bg-black object-contain';
    return url ? <img className={box} src={url} alt="" /> : <span className={box} />;
}

/** Reads a chosen file and hands it on; clears the input so the same file can be chosen again. */
function readUpload(e: ChangeEvent<HTMLInputElement>, then: (name: string, bytes: Uint8Array) => void) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) f.arrayBuffer().then((b) => then(f.name, new Uint8Array(b)));
}

interface PictureInputProps {
    value: string;
    images: Readonly<Record<string, Uint8Array>>;
    onChange(path: string): void;
    onUpload(fileName: string, bytes: Uint8Array): void;
}

/** A picture option: one of the design's images, none, or a new upload. */
export function PictureInput({ value, images, onChange, onUpload }: PictureInputProps) {
    const paths = Object.keys(images).sort();
    const missing = value !== '' && !(value in images);
    return (
        <span className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-1">
                <Thumb bytes={images[value]} />
                <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
                    <option value="">(none)</option>
                    {paths.map((p) => <option key={p} value={p}>{p}</option>)}
                    {missing && <option value={value}>{value} (missing)</option>}
                </select>
                <label className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'flex-none cursor-pointer')} title="Upload a PNG">
                    <Upload />
                    <input type="file" accept="image/png,.png" className="hidden" onChange={(e) => readUpload(e, onUpload)} />
                </label>
            </span>
            {missing && <span className="text-xs text-destructive">{value} is not in the design</span>}
        </span>
    );
}

/** The design's images, which are in use (unused ones are left out of the download), and the missing ones. */
export function ImagesPanel() {
    const doc = useEditor(docOf);
    const { edit } = useActions();
    const missing = missingImages(doc);
    const used = new Set(usedImages(doc));
    const paths = Object.keys(doc.images).sort();
    return (
        <Section title="Images" data-images=""
            actions={
                <label className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'cursor-pointer')} title="Add a PNG">
                    <ImagePlus />
                    <input type="file" accept="image/png,.png" className="hidden"
                        onChange={(e) => readUpload(e, (name, bytes) => edit({ type: 'addImage', path: imagePathFor(name), bytes }))} />
                </label>
            }>
            {missing.length > 0 && (
                <ul className="m-0 mb-2 list-none p-0 text-xs text-destructive" role="alert">{missing.map((m, i) => (
                    <li key={i} data-missing={m.path}>Missing {m.path} ({m.screen} / {m.element})</li>
                ))}</ul>
            )}
            {paths.length === 0 && missing.length === 0 && <p className="m-0 text-xs text-muted-foreground">No images yet.</p>}
            <ul className="m-0 flex list-none flex-col gap-1 p-0">{paths.map((p) => (
                <li key={p} data-image={p} className="flex min-w-0 items-center gap-2 text-xs">
                    <Thumb bytes={doc.images[p]} />
                    <span className="flex-1 truncate">{p.slice('images/'.length)}</span>
                    {used.has(p)
                        ? <small className="text-muted-foreground">in use</small>
                        : <>
                            <small className="text-muted-foreground" title="Not used, so not in the download">unused</small>
                            <Button variant="ghost" size="icon-xs" title="Remove" onClick={() => edit({ type: 'removeImage', path: p })}><X /></Button>
                        </>}
                </li>
            ))}</ul>
        </Section>
    );
}
