// Autosave in the Designer: keeps the open design in browser storage after every change, and on opening offers
// to restore the design that was kept. Declining starts a new design; the kept copy is replaced on the next edit.
import { useEffect, useRef, useState } from 'react';
import { autosave, newDocument, type Doc } from './model/index.ts';
import { indexedDbStore } from './indexedDbStore.ts';
import './autosave.css';

const saver = autosave(indexedDbStore());

export function useAutosave(doc: Doc, open: (d: Doc) => void) {
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
        <div className="restore-backdrop">
            <div className="restore" role="dialog" aria-modal="true" aria-labelledby="restore-title">
                <h2 id="restore-title">Restore your last design?</h2>
                <p>The Designer kept the design you were working on. Restore it, or start a new design (the kept copy is replaced when you make your first edit).</p>
                <div className="row-buttons">
                    <button autoFocus onClick={onRestore}>Restore</button>
                    <button onClick={onDecline}>Start new design</button>
                </div>
            </div>
        </div>
    );
}

export function AutosaveProblem({ problem }: { problem: string | null }) {
    if (!problem) return null;
    return <span className="problem autosave-problem" role="status">{problem}</span>;
}
