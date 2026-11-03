// A panel's frame: its header and a body that scrolls on its own. Docked: a full-height column beside the canvas.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({ side, title, children, className }: {
    side: 'left' | 'right';
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <aside data-panel={side} aria-label={title}
            className={cn('flex min-h-0 flex-none flex-col bg-card text-card-foreground',
                side === 'left' ? 'w-60 border-r' : 'w-80 border-l', className)}>
            <div className="flex h-10 flex-none items-center border-b px-3 text-xs font-medium text-muted-foreground" data-panel-header="">
                {title}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">{children}</div>
        </aside>
    );
}
