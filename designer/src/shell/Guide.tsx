// "From design to car": how a downloaded screen file becomes an app on the head unit, in short. Opened from the main
// menu (Help, and beside Download). The details and the emulator walkthrough are in starter/README.md.
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Code = ({ children }: { children: ReactNode }) => (
    <pre className="m-0 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-[0.7rem] leading-relaxed">{children}</pre>
);
const C = ({ children }: { children: ReactNode }) => <code className="rounded bg-muted px-1 font-mono text-[0.7rem]">{children}</code>;

export function Guide({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" data-guide="">
                <DialogHeader>
                    <DialogTitle>From design to car</DialogTitle>
                    <DialogDescription>
                        The app ships your screen file and draws it on the head unit with the kit. Your code handles actions and sets
                        what elements show; links, BACK, the controller, touch and the keyboard screen are the runtime’s.
                    </DialogDescription>
                </DialogHeader>
                <ol className="m-0 flex list-decimal flex-col gap-3 pl-5 text-xs leading-relaxed">
                    <li>
                        <b>Download</b> the design (main menu). You get <C>design.zip</C>: the screen file, <C>screens.json</C>,
                        and its pictures in <C>images/</C>.
                    </li>
                    <li>
                        Copy the starter app (<C>starter/</C> in this repository) and put the download in its <C>app/</C>:
                        <Code>{'rm -rf app/screens.json app/images\nunzip design.zip -d app/'}</Code>
                    </li>
                    <li>
                        In <C>main.js</C>, handle your screens’ actions and set what elements show:
                        <Code>{`rt.on('action', (a) => { /* a.screen, a.element, a.action, a.value */ });
rt.on('screen', (c) => { /* c.screen opened, from c.from, by c.by */ });
rt.set('home', 'status', 'Ready');`}</Code>
                        An element’s action is its name unless you gave it another on the Prototype tab; a field reports the typed
                        text as <C>value</C>.
                    </li>
                    <li>
                        Give the app its own <C>id</C> and <C>version</C> in <C>mgu-app.json</C>, its <C>title</C> in{' '}
                        <C>tile.json</C> and a 96 × 96 <C>tile.png</C>.
                    </li>
                    <li>
                        Build it (Node 18 or newer on your computer; the app runs on the head unit’s Node 8):
                        <Code>{'node tools/build.js'}</Code>
                        and install the source package it writes, <C>{'<id>@<version>.src.tgz'}</C>, with mgu-store’s deploy tool.
                    </li>
                </ol>
                <p className="m-0 text-xs text-muted-foreground">
                    The details, building the OAP package with a donor, and trying it in the iDrive 7 emulator are in{' '}
                    <C>starter/README.md</C>.
                </p>
            </DialogContent>
        </Dialog>
    );
}
