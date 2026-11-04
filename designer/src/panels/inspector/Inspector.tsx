// The right panel's content, in two tabs as in Figma.
//   Design: the selection's layout (box, align, distribute) and the element's options; with nothing selected, the
//           screen's and the screen file's settings.
//   Prototype: the element's action and the screen it opens, the screen's focus order, and the navigation view.
import { PropertyPanel } from '../../PropertyPanel';
import { FocusOrder, Interaction, NavigationPanel } from './Prototype';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Arrange } from './Arrange';
import { FileSettings, ScreenSettings } from './Settings';
import { useActions, useEditor } from '../../store/react.tsx';

export function Inspector() {
    const tab = useEditor((s) => s.inspectorTab);
    const none = useEditor((s) => s.selection.length === 0);
    const { setInspectorTab } = useActions();
    return (
        <Tabs value={tab} onValueChange={(v) => setInspectorTab(v as 'design' | 'prototype')} className="gap-0">
            <div className="sticky top-0 z-10 border-b bg-card px-3 py-2">
                <TabsList className="w-full">
                    <TabsTrigger value="design" data-inspector-tab="design">Design</TabsTrigger>
                    <TabsTrigger value="prototype" data-inspector-tab="prototype">Prototype</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="design">
                {none ? <><ScreenSettings /><FileSettings /></> : <><Arrange /><PropertyPanel /></>}
            </TabsContent>
            <TabsContent value="prototype">
                <Interaction />
                <FocusOrder />
                <NavigationPanel />
            </TabsContent>
        </Tabs>
    );
}
