// Pictures: the app author's PNGs, kept under images/ beside the screen file. A picture option picks one of them or
// takes an upload; the images panel lists them (used or not) and the pictures elements name that the design lacks.
import { useEffect, useState, type ChangeEvent } from 'react';
import { imagePathFor, missingImages, usedImages } from './model/index.ts';
import { docOf } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';

/** A small preview of a PNG's bytes. */
function Thumb({ bytes }: { bytes: Uint8Array | undefined }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!bytes) { setUrl(null); return; }
        const u = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [bytes]);
    return url ? <img className="thumb" src={url} alt="" /> : <span className="thumb" />;
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
        <span className="picture-input">
            <Thumb bytes={images[value]} />
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">(none)</option>
                {paths.map((p) => <option key={p} value={p}>{p}</option>)}
                {missing && <option value={value}>{value} (missing)</option>}
            </select>
            <label className="upload">
                Upload PNG…
                <input type="file" accept="image/png,.png" onChange={(e) => readUpload(e, onUpload)} />
            </label>
            {missing && <span className="problem" role="alert">{value} is not in the design</span>}
        </span>
    );
}

/** The design's images, which are in use (unused ones are left out of the download), and the missing ones. */
export function ImagesPanel() {
    const doc = useEditor(docOf);
    const { edit } = useActions();
    const missing = missingImages(doc);
    const onAdd = (name: string, bytes: Uint8Array) => edit({ type: 'addImage', path: imagePathFor(name), bytes });
    const onRemove = (path: string) => edit({ type: 'removeImage', path });
    const used = new Set(usedImages(doc));
    const paths = Object.keys(doc.images).sort();
    return (
        <div className="images" data-images="">
            <h2>Images</h2>
            {missing.length > 0 && (
                <ul className="missing" role="alert">{missing.map((m, i) => (
                    <li key={i} data-missing={m.path}>Missing {m.path} ({m.screen} / {m.element})</li>
                ))}</ul>
            )}
            <ul>{paths.map((p) => (
                <li key={p} data-image={p}>
                    <Thumb bytes={doc.images[p]} />
                    <span>{p.slice('images/'.length)}</span>
                    {used.has(p)
                        ? <small>in use</small>
                        : <><small>unused, not downloaded</small> <button onClick={() => onRemove(p)}>Remove</button></>}
                </li>
            ))}</ul>
            <label className="upload">
                Add PNG…
                <input type="file" accept="image/png,.png" onChange={(e) => readUpload(e, onAdd)} />
            </label>
        </div>
    );
}
