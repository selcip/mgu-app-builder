// The Insert menu while a cluster layout is open (ticket 06): the generic cluster widgets of the engine's catalog. Click
// one to add an element of it to the layout and select it.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CLUSTER_WIDGETS } from '../cluster-catalog.ts';
import { layoutOf } from '../store/editor.ts';
import { useEditorStore } from '../store/react.tsx';

export function ClusterInsertMenu() {
    const store = useEditorStore();
    const [open, setOpen] = useState(false);
    const add = (type: string) => {
        const s = store.getState();
        const n = layoutOf(s)?.widgets.length ?? 0;
        const before = new Set((layoutOf(s)?.widgets ?? []).map((w) => (w as { id?: string }).id));
        const next = s.edit({ type: 'addWidget', widgetType: type, x: 48 + (n % 12) * 24, y: 48 + (n % 12) * 24 });
        setOpen(false);
        if (!next || next.kind !== 'cluster-layout') return;
        const added = next.layout.widgets.map((w) => (w as { id?: string }).id).find((id) => id && !before.has(id));
        if (added) store.getState().selectOnly(added);
    };
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} title="Add an element" data-insert="">
                <Plus />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 gap-1.5 p-1.5" data-insert-menu="">
                <ul className="m-0 grid list-none grid-cols-2 gap-0.5 p-0">
                    {CLUSTER_WIDGETS.map((w) => (
                        <li key={w.type}>
                            <button data-widget={w.type} className="flex h-7 w-full items-center rounded-md px-2 text-left text-xs hover:bg-accent"
                                onClick={() => add(w.type)}>
                                <span className="truncate">{w.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
