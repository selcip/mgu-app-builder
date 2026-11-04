// A text input that commits once (Enter or leaving it) instead of on every keystroke; Escape reverts. Native input,
// on shadcn's Input.
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** A text input that commits on Enter or when it loses focus (one edit, not one per keystroke); Escape reverts. */
export function CommitInput(props: {
    value: string; onCommit: (v: string) => void; type?: string; step?: string; multiline?: boolean; placeholder?: string; className?: string;
}) {
    const [v, setV] = useState(props.value);
    useEffect(() => setV(props.value), [props.value]);
    const commit = () => { if (v !== props.value) props.onCommit(v); };
    if (props.multiline) {
        return (
            <textarea value={v} rows={5} onChange={(e) => setV(e.target.value)} onBlur={commit}
                className={cn('w-full min-w-0 rounded-md border border-input bg-input/30 px-2 py-1 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50', props.className)} />
        );
    }
    return (
        <Input type={props.type || 'text'} step={props.step} value={v} placeholder={props.placeholder}
            className={cn('h-7 rounded-md px-2 text-xs md:text-xs', props.className)}
            onChange={(e) => setV(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setV(props.value); }} />
    );
}
