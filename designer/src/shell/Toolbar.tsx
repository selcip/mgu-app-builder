// The slim bar across the top, as in Figma: the main menu (the design: new, open, download; editing), adding a
// widget, undo and redo; then messages; the language shown, the View menu (grid, snap, guides, focus numbers) and the
// zoom. The Open file input stays in the bar itself (not in the menu, which is only drawn while open).
import { useRef, useState, type ChangeEvent, type ReactNode, type Ref } from 'react';
import { ChevronDown, Maximize, Minus, Plus, Redo2, Search, Undo2 } from 'lucide-react';
import { exportZip, importZip, newDocument } from '../model/index.ts';
import { WIDGETS } from '../catalog.ts';
import { WIDGET_DRAG_TYPE } from '../Canvas';
import { AutosaveProblem } from '../Autosave';
import { ShownLanguage } from '../Languages';
import { PlayButton } from '../TryPanel';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
    DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { addGuide, clearGuides, copy, cut, deleteSelection, duplicate, paste, selectAll } from './commands.ts';
import { canRedoOf, canUndoOf, docOf } from '../store/editor.ts';
import { useActions, useEditor, useEditorStore } from '../store/react.tsx';

const GRIDS = [0, 4, 8, 16, 32];
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

export function Toolbar({ autosaveProblem, children }: { autosaveProblem: string | null; children?: ReactNode }) {
    const problem = useEditor((s) => s.problem);
    const canUndo = useEditor(canUndoOf);
    const canRedo = useEditor(canRedoOf);
    const trying = useEditor((s) => s.trying);
    const { undo, redo } = useActions();
    const openInput = useRef<HTMLInputElement>(null);
    return (
        <header data-toolbar="" className="flex h-11 flex-none items-center gap-1 border-b bg-card px-2 text-sm">
            <MainMenu onOpen={() => openInput.current?.click()} />
            <OpenInput ref={openInput} />
            <span className="mx-1 h-5 w-px bg-border" />
            {!trying && <InsertMenu />}
            <Button variant="ghost" size="icon-sm" data-undo="" title={`Undo (${MOD}Z)`} disabled={!canUndo || trying} onClick={undo}><Undo2 /></Button>
            <Button variant="ghost" size="icon-sm" data-redo="" title={`Redo (${MOD}Shift+Z)`} disabled={!canRedo || trying} onClick={redo}><Redo2 /></Button>
            <span className="min-w-0 flex-1 truncate px-2 text-xs">
                {problem && <span className="problem text-destructive" role="alert">{problem}</span>}
                <AutosaveProblem problem={autosaveProblem} />
            </span>
            {children}
            <ShownLanguage />
            <PlayButton />
            <ViewMenu />
            <ZoomControl />
        </header>
    );
}

/** The hidden input that opens a design; the main menu's Open… clicks it. */
function OpenInput({ ref }: { ref: Ref<HTMLInputElement> }) {
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
    return <input ref={ref} type="file" accept=".zip,application/zip" className="hidden" data-open-input="" onChange={upload} />;
}

function MainMenu({ onOpen }: { onOpen(): void }) {
    const store = useEditorStore();
    const canUndo = useEditor(canUndoOf);
    const canRedo = useEditor(canRedoOf);
    const any = useEditor((s) => s.selection.length > 0);
    const clip = useEditor((s) => s.clipboard !== null);
    const trying = useEditor((s) => s.trying);
    const { open, undo, redo } = useActions();
    function download() {
        const bytes = exportZip(docOf(store.getState()));
        const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'design.zip';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const edits = !trying;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 font-semibold')} data-main-menu="">
                mgu Designer <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Design</DropdownMenuLabel>
                    <DropdownMenuItem data-menu-new="" onClick={() => open(newDocument())}>New design</DropdownMenuItem>
                    <DropdownMenuItem data-menu-open="" onClick={onOpen}>Open… <DropdownMenuShortcut>.zip</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem data-menu-download="" onClick={download}>Download <DropdownMenuShortcut>.zip</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Edit</DropdownMenuLabel>
                    <DropdownMenuItem disabled={!edits || !canUndo} onClick={undo}>Undo <DropdownMenuShortcut>{MOD}Z</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits || !canRedo} onClick={redo}>Redo <DropdownMenuShortcut>{MOD}⇧Z</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits || !any} data-menu-copy="" onClick={() => copy(store)}>Copy <DropdownMenuShortcut>{MOD}C</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits || !any} data-menu-cut="" onClick={() => cut(store)}>Cut <DropdownMenuShortcut>{MOD}X</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits || !clip} data-menu-paste="" onClick={() => paste(store)}>Paste <DropdownMenuShortcut>{MOD}V</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits || !any} data-menu-duplicate="" onClick={() => duplicate(store)}>Duplicate <DropdownMenuShortcut>{MOD}D</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits || !any} variant="destructive" data-menu-delete="" onClick={() => deleteSelection(store)}>Delete <DropdownMenuShortcut>Del</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled={!edits} onClick={() => selectAll(store)}>Select all <DropdownMenuShortcut>{MOD}A</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Adding a widget: a searchable list; click one to add it to the screen, or drag it onto the screen. */
function InsertMenu() {
    const { addElement } = useActions();
    const [open, setOpenState] = useState(false);
    const [q, setQ] = useState('');
    /** Opens or closes the menu; closing (by choosing a widget, a drop, Escape or a click outside) clears the search. */
    const setOpen = (o: boolean) => { setOpenState(o); if (!o) setQ(''); };
    const query = q.trim().toLowerCase();
    const shown = WIDGETS.filter((w) => !query || w.label.toLowerCase().includes(query) || w.type.toLowerCase().includes(query));
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} title="Add a widget" data-insert="">
                <Plus />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 gap-1.5 p-1.5" data-insert-menu="">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a widget…" data-insert-search=""
                        className="h-7 rounded-md pl-7 text-xs md:text-xs"
                        onKeyDown={(e) => { if (e.key === 'Enter' && shown.length) { addElement(shown[0].type); setOpen(false); } }} />
                </div>
                <ul className="m-0 grid max-h-80 list-none grid-cols-2 gap-0.5 overflow-y-auto p-0">
                    {shown.map((wd) => (
                        <li key={wd.type}>
                            <button data-widget={wd.type} draggable title="Click to add, or drag onto the screen"
                                className="flex h-7 w-full items-center rounded-md px-2 text-left text-xs hover:bg-accent"
                                onClick={() => { addElement(wd.type); setOpen(false); }}
                                onDragStart={(e) => { e.dataTransfer.setData(WIDGET_DRAG_TYPE, wd.type); e.dataTransfer.effectAllowed = 'copy'; }}
                                onDragEnd={() => setOpen(false)}>
                                <span className="truncate">{wd.label}</span>
                            </button>
                        </li>
                    ))}
                    {shown.length === 0 && <li className="col-span-2 px-2 py-1 text-xs text-muted-foreground">No widget called “{q}”.</li>}
                </ul>
            </PopoverContent>
        </Popover>
    );
}

function ViewMenu() {
    const store = useEditorStore();
    const settings = useEditor((s) => s.settings);
    const showFocus = useEditor((s) => s.showFocus);
    const { setSettings, setShowFocus } = useActions();
    const guides = settings.guides.xs.length + settings.guides.ys.length;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')} data-view-menu="">
                View <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger data-view-grid="">Grid <DropdownMenuShortcut>{settings.grid ? `${settings.grid} px` : 'off'}</DropdownMenuShortcut></DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={String(settings.grid)} onValueChange={(v) => setSettings({ ...settings, grid: Number(v) })}>
                            {GRIDS.map((g) => <DropdownMenuRadioItem key={g} value={String(g)} data-grid={g}>{g ? `${g} px` : 'Off'}</DropdownMenuRadioItem>)}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuCheckboxItem checked={settings.snap} data-view-snap="" onCheckedChange={(on) => setSettings({ ...settings, snap: !!on })}>
                    Snap to elements and guides
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showFocus} data-view-focus="" onCheckedChange={(on) => setShowFocus(!!on)}>
                    Number the focus order
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-view-add-vguide="" onClick={() => addGuide(store, 'xs')}>Add a vertical guide</DropdownMenuItem>
                <DropdownMenuItem data-view-add-hguide="" onClick={() => addGuide(store, 'ys')}>Add a horizontal guide</DropdownMenuItem>
                <DropdownMenuItem disabled={!guides} data-view-clear-guides="" onClick={() => clearGuides(store)}>Remove the guides</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ZoomControl() {
    const zoom = useEditor((s) => (s.view ? s.view.zoom : 1));
    const { zoomStep, zoomTo, zoomToFit } = useActions();
    return (
        <span className="flex items-center gap-0.5" aria-label="Zoom">
            <Button variant="ghost" size="icon-sm" data-zoom-out="" title={`Zoom out (${MOD}-)`} onClick={() => zoomStep(-1)}><Minus /></Button>
            <Button variant="ghost" size="sm" className="w-14 tabular-nums" data-zoom-reset="" title={`Zoom to 100 % (${MOD}0)`} onClick={() => zoomTo(1)}>
                <span data-zoom-level="">{Math.round(zoom * 100)}%</span>
            </Button>
            <Button variant="ghost" size="icon-sm" data-zoom-in="" title={`Zoom in (${MOD}=)`} onClick={() => zoomStep(1)}><Plus /></Button>
            <Button variant="ghost" size="icon-sm" data-zoom-fit="" title="Zoom to fit (Shift+1)" onClick={zoomToFit}><Maximize /></Button>
        </span>
    );
}

