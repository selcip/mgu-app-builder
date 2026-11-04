// Autosave in the Designer: keeps the open design in browser storage after every change, and on opening offers
// to restore the design that was kept. Declining starts a new design; the kept copy is replaced on the next edit.
import { useEffect, useRef, useState } from 'react';
import { autosave, newDocument, type Doc } from '../model/index.ts';
import { indexedDbStore } from '../indexedDbStore.ts';
import { docOf } from '../store/editor.ts';
import { useActions, useEditor } from '../store/react.tsx';
import { Button } from '@/components/ui/button';

const saver = autosave(indexedDbStore());

export function useAutosave() {
    const doc = useEditor(docOf);
    const { open } = useActions();
    const [checked, setChecked] = useState(false);
    const [offer, setOffer] = useState<Doc | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    // the document already kept (or deliberately not kept): saving starts once the document differs from it
    const kept = useRef<Doc>(doc);

    useEffect(() => {
        let live = true;
        saver.restore().then(({ doc: stored, problem: p }) => {
            if (!live) return;
            setOffer(stored);
            setProblem(p);
            setChecked(true);
        });
        return () => { live = false; };
    }, []);

    useEffect(() => {
        if (!checked || offer || doc === kept.current) return;
        kept.current = doc;
        let live = true;
        saver.save(doc).then((p) => { if (live) setProblem(p); });
        return () => { live = false; };
    }, [checked, offer, doc]);

    return {
        offer,
        problem,
        restore() {
            if (!offer) return;
            kept.current = offer;
            open(offer);
            setOffer(null);
        },
        decline() {
            const fresh = newDocument();
            kept.current = fresh;
            open(fresh);
            setOffer(null);
        },
    };
}

export function RestorePrompt({ onRestore, onDecline }: { onRestore: () => void; onDecline: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="flex max-w-md flex-col gap-3 rounded-xl border bg-popover p-5 text-popover-foreground shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="restore-title">
                <h2 id="restore-title" className="m-0 text-base font-semibold">Restore your last design?</h2>
                <p className="m-0 text-sm text-muted-foreground">The Designer kept the design you were working on. Restore it, or start a new design (the kept copy is replaced when you make your first edit).</p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onDecline}>Start new design</Button>
                    <Button autoFocus onClick={onRestore}>Restore</Button>
                </div>
            </div>
        </div>
    );
}

export function AutosaveProblem({ problem }: { problem: string | null }) {
    if (!problem) return null;
    return <span className="ml-2 text-destructive" role="status">{problem}</span>;
}
