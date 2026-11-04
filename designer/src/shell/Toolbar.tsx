// The slim bar across the top: the design (new, open, download), the theme and languages, messages, and the zoom.
import { type ChangeEvent } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { exportZip, importZip, newDocument } from '../model/index.ts';
import { AutosaveProblem } from '../Autosave';
import { ShownLanguage } from '../Languages';
import { Button, buttonVariants } from '@/components/ui/button';
import { docOf } from '../store/editor.ts';
import { useActions, useEditor } from '../store/react.tsx';

export function Toolbar({ autosaveProblem }: { autosaveProblem: string | null }) {
    const doc = useEditor(docOf);
    const problem = useEditor((s) => s.problem);
    const { open, setProblem } = useActions();

    async function upload(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
            open(importZip(new Uint8Array(await f.arrayBuffer())));
        } catch (err) {
            setProblem(`Couldn’t open ${f.name}: ${(err as Error).message} Your design is unchanged.`);
        }
    }

    function download() {
        const bytes = exportZip(doc);
        const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'design.zip';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return (
        <header data-toolbar="" className="flex h-11 flex-none items-center gap-2 border-b bg-card px-3 text-sm">
            <span className="mr-2 font-semibold">mgu Designer</span>
            <Button variant="ghost" size="sm" onClick={() => open(newDocument())}>New</Button>
            <label className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' cursor-pointer'}>
                Open…
                <input type="file" accept=".zip,application/zip" className="hidden" onChange={upload} />
            </label>
            <Button variant="ghost" size="sm" onClick={download}>Download</Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <ShownLanguage />
            <span className="min-w-0 flex-1 truncate">
                {problem && <span className="problem" role="alert">{problem}</span>}
                <AutosaveProblem problem={autosaveProblem} />
            </span>
            <ZoomControl />
        </header>
    );
}

function ZoomControl() {
    const zoom = useEditor((s) => (s.view ? s.view.zoom : 1));
    const { zoomStep, zoomTo, zoomToFit } = useActions();
    return (
        <span className="flex items-center gap-0.5" aria-label="Zoom">
            <Button variant="ghost" size="icon-sm" data-zoom-out="" title="Zoom out (Ctrl+-)" onClick={() => zoomStep(-1)}><Minus /></Button>
            <Button variant="ghost" size="sm" className="w-14 tabular-nums" data-zoom-reset="" title="Zoom to 100 % (Ctrl+0)" onClick={() => zoomTo(1)}>
                <span data-zoom-level="">{Math.round(zoom * 100)}%</span>
            </Button>
            <Button variant="ghost" size="icon-sm" data-zoom-in="" title="Zoom in (Ctrl+=)" onClick={() => zoomStep(1)}><Plus /></Button>
            <Button variant="ghost" size="icon-sm" data-zoom-fit="" title="Zoom to fit (Shift+1)" onClick={zoomToFit}><Maximize /></Button>
        </span>
    );
}
