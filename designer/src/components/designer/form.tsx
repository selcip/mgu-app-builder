// The Designer's own small building blocks for panels, on the shadcn tokens: a titled section, a label-and-control
// row, and the look of native controls (selects stay native: the browser tests and the keyboard both rely on them).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The look of a native <select>, matching shadcn's Input. */
export const selectClass = 'h-7 w-full min-w-0 rounded-md border border-input bg-input/30 px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50';
/** The look of a native checkbox. */
export const checkboxClass = 'size-3.5 accent-primary';

/** A panel section: a small title (with optional buttons on its right) over its content. */
export function Section({ title, actions, children, className, ...rest }: {
    title?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
} & Record<`data-${string}`, string | undefined>) {
    return (
        <section className={cn('border-b border-border/60 px-3 py-3 last:border-b-0', className)} {...rest}>
            {(title || actions) && (
                <div className="mb-2 flex min-h-6 items-center gap-1">
                    <h3 className="m-0 flex-1 truncate text-xs font-medium text-muted-foreground">{title}</h3>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/** A label on the left and its control on the right. */
export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
    return (
        <label className={cn('mb-1.5 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2 text-xs', className)}>
            <span className="truncate text-muted-foreground">{label}</span>
            {children}
        </label>
    );
}

/** A hint or empty-state line. */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
    return <p className={cn('m-0 text-xs text-muted-foreground', className)}>{children}</p>;
}

/** A row in a list (screens, elements, focus order…): highlighted when current. */
export const listRowClass = 'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs text-foreground hover:bg-accent/60 aria-[current=true]:bg-blue-500/25 aria-[current=true]:ring-1 aria-[current=true]:ring-blue-500/50';
