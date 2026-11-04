// Trying the app in the preview: arrow keys and Enter stand in for the iDrive controller, clicks for taps, Esc for
// BACK. The preview follows navigation links and BACK through the screens; what the runtime reports (actions, screen
// changes, leaving the app) is listed as the app's code would receive it.
import type { Report } from './store/editor.ts';
import { useActions, useEditor } from './store/react.tsx';
import { useEffect, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

const quote = (v: unknown) => JSON.stringify(v).replace(/^"(.*)"$/, "'$1'");

function ReportItem({ r }: { r: Report }) {
    if ('action' in r) {
        const a = r.action;
        return (
            <li data-action={a.action} className="text-emerald-300">
                <code>{`{ screen: '${a.screen}', element: '${a.element}', action: '${a.action}'`
                    + ('value' in a ? `, value: ${quote(a.value)}` : '') + ' }'}</code>
            </li>
        );
    }
    if ('change' in r) {
        const c = r.change;
        return (
            <li data-screen-change={c.screen} className="text-sky-300">
                <code>{`screen: { screen: '${c.screen}', from: ${c.from === null ? 'null' : `'${c.from}'`}, by: '${c.by}' }`}</code>
            </li>
        );
    }
    return (
        <li data-leave={r.leave} className="text-amber-300">
            <code>{`leave: { screen: '${r.leave}' }`}</code> BACK on the first screen: the driver leaves the app
        </li>
    );
}

/** The toolbar's Play button: starts trying the app on the canvas (as Figma's Present does), or stops. */
export function PlayButton() {
    const trying = useEditor((s) => s.trying);
    const { setTrying } = useActions();
    return (
        <Button variant={trying ? 'default' : 'ghost'} size="sm" role="switch" aria-checked={trying} data-try-toggle=""
            title={trying ? 'Stop trying and go back to editing' : 'Try the app: the controller and taps, from the first screen'}
            onClick={() => setTrying(!trying)}>
            {trying ? <Square className="fill-current" /> : <Play className="fill-current" />}
            {trying ? 'Stop' : 'Try'}
        </Button>
    );
}

/** While trying: a card over the canvas with the keys and what the runtime reported, as the app's code gets it. */
export function TryReport() {
    const trying = useEditor((s) => s.trying);
    const reports = useEditor((s) => s.reports);
    const { clearReports } = useActions();
    const list = useRef<HTMLOListElement>(null);
    useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [reports]);
    if (!trying) return null;
    return (
        <div data-try-panel="" aria-label="Trying"
            className="absolute right-3 bottom-3 z-30 flex max-h-[45%] w-96 flex-col rounded-lg border bg-card text-card-foreground shadow-xl shadow-black/40">
            <div className="flex h-10 flex-none items-center gap-1 border-b px-3 text-xs font-medium text-muted-foreground">
                <span className="flex-1">Reported to your code</span>
                <Button variant="ghost" size="xs" disabled={!reports.length} onClick={clearReports}>Clear</Button>
            </div>
            <p className="m-0 border-b px-3 py-2 text-[0.7rem] text-muted-foreground">
                ← → (or ↑ ↓) move the highlight, Enter or Space selects, Esc or Backspace is BACK; a click taps.
            </p>
            <ol ref={list} className="m-0 min-h-10 flex-1 list-none overflow-y-auto px-3 py-2 font-mono text-[0.7rem] leading-relaxed" aria-label="Reported to your code">
                {reports.map((r, i) => <ReportItem key={i} r={r} />)}
            </ol>
        </div>
    );
}

/** The controller input a key stands for in the preview, or null. */
export function controllerKey(key: string): 'left' | 'right' | 'press' | 'back' | null {
    switch (key) {
        case 'ArrowLeft': case 'ArrowUp': return 'left';
        case 'ArrowRight': case 'ArrowDown': return 'right';
        case 'Enter': case ' ': return 'press';
        case 'Backspace': case 'Escape': return 'back';
        default: return null;
    }
}
