// The rows editor: a list's (or menu's, app grid's...) default rows as a table, one input per field, with buttons to
// add, move and delete rows. Every change is a row operation on the document model (model/ops/rows.ts). Rows the
// screen file holds as a list of objects (a Store file) are shown as they are, not edited here.
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROW_FIELDS, rowsOf, type Element } from './model/index.ts';
import { CommitInput } from './PropertyPanel';

/** A row operation without its screen and element (the panel adds them). */
export type RowEdit =
    | { type: 'addRow'; fields: string[] }
    | { type: 'setRow'; row: number; fields: string[] }
    | { type: 'deleteRow'; row: number }
    | { type: 'moveRow'; row: number; to: number };

export function RowsEditor({ element, onEdit }: { element: Element; onEdit: (e: RowEdit) => void }) {
    const rows = rowsOf(element);
    const names = ROW_FIELDS[element.gpu];
    if (!rows || !names) return <code className="text-xs text-muted-foreground">{JSON.stringify(element.opts && element.opts.items)}</code>;
    const field = (r: string[], j: number) => (j < r.length ? r[j] : '');
    const setField = (i: number, j: number, v: string) => {
        const f = names.map((_, k) => field(rows[i], k));
        f[j] = v;
        onEdit({ type: 'setRow', row: i, fields: f });
    };
    return (
        <div className="flex flex-col gap-1.5" data-rows>
            <table className="w-full border-collapse text-xs">
                <thead><tr>{names.map((n) => <th key={n} className="pb-1 text-left font-normal text-muted-foreground">{n}</th>)}<th></th></tr></thead>
                <tbody>{rows.map((r, i) => (
                    <tr key={i} data-row={i}>
                        {names.map((n, j) => (
                            <td key={n} data-field={j} className="pr-1 pb-1"><CommitInput value={field(r, j)} onCommit={(v) => setField(i, j, v)} /></td>
                        ))}
                        <td className="whitespace-nowrap pb-1">
                            <Button variant="ghost" size="icon-xs" data-move-up disabled={i === 0} title="Move up" onClick={() => onEdit({ type: 'moveRow', row: i, to: i - 1 })}><ArrowUp /></Button>
                            <Button variant="ghost" size="icon-xs" data-move-down disabled={i === rows.length - 1} title="Move down" onClick={() => onEdit({ type: 'moveRow', row: i, to: i + 1 })}><ArrowDown /></Button>
                            <Button variant="ghost" size="icon-xs" data-delete-row title="Delete row" onClick={() => onEdit({ type: 'deleteRow', row: i })}><X /></Button>
                        </td>
                    </tr>
                ))}</tbody>
            </table>
            <Button variant="outline" size="xs" className="self-start" data-add-row onClick={() => onEdit({ type: 'addRow', fields: newRow(names) })}><Plus /> Add row</Button>
        </div>
    );
}

/** A new row's fields: 'New row' as its title (a list's second field, after the badge), the rest empty. */
function newRow(names: string[]): string[] {
    return names.map((_, j) => (j === Math.max(0, names.indexOf('Title')) ? 'New row' : ''));
}
