// The Layer budget section of the layout inspector: layers on each connection (8 each on the car), layers in all (32)
// and pixel memory (16 MiB, each image counted twice), taken from the engine's own packing plan (useLayerBudget). A value
// over its limit is marked and the sentence under the list says which limit. It never stops saving. Hooks: [data-budget],
// [data-budget-conn="<0-based>"], [data-budget-total], [data-budget-pixels], each with data-value and data-over.
import { Hint, Row, Section } from '@/components/designer/form';
import { cn } from '@/lib/utils';
import { useLayerBudget } from './useLayerBudget';

const mib = (b: number) => (b / 1048576).toFixed(1);

function Value({ over, children, ...rest }: { over: boolean; children: React.ReactNode } & Record<`data-${string}`, string | undefined>) {
    return (
        <span className={cn('tabular-nums', over && 'font-medium text-destructive')} data-over={String(over)} {...rest}>
            {children}{over && <span aria-hidden="true"> ⚠</span>}
        </span>
    );
}

export function LayerBudget() {
    const b = useLayerBudget();
    return (
        <Section title="Layer budget" data-budget="">
            {!b && <Hint>Counting the layers…</Hint>}
            {b && b.layers.count === 0 && <Hint>The engine does not draw this layout, so it has no layers.</Hint>}
            {b && b.layers.count > 0 && (
                <>
                    {b.connections.map((c) => (
                        <Row key={c.conn} label={`Layers on connection ${c.conn + 1}`}>
                            <Value over={c.over} data-budget-conn={String(c.conn)} data-value={String(c.layers)}>{c.layers} of {c.limit}</Value>
                        </Row>
                    ))}
                    <Row label="Layers in all"><Value over={b.layers.over} data-budget-total="" data-value={String(b.layers.count)}>{b.layers.count} of {b.layers.limit}</Value></Row>
                    <Row label="Pixel memory"><Value over={b.pixels.over} data-budget-pixels="" data-value={String(b.pixels.bytes)}>{mib(b.pixels.bytes)} of {mib(b.pixels.limit)} MiB</Value></Row>
                    <Hint>Each image counts twice. {b.effects} effect and {b.sheets} image layers.</Hint>
                    {b.over.length > 0 && (
                        <ul role="alert" data-budget-over="" className="m-0 mt-1 list-none p-0 text-xs text-destructive">
                            {b.over.map((t) => <li key={t}>{t}</li>)}
                            <li className="text-muted-foreground">The car draws what fits; you can still save.</li>
                        </ul>
                    )}
                </>
            )}
        </Section>
    );
}
