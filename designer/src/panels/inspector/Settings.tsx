// What the Design tab shows with no element selected: the selected screen's settings (name, title, making it
// first, duplicating, deleting) and the screen file's (theme, languages, images, texts to look at).
import { Copy, Home, Trash2 } from 'lucide-react';
import { firstScreenOf, themeOf } from '../../model/index.ts';
import { THEMES } from '../../catalog.ts';
import { CommitInput } from '../../PropertyPanel';
import { LanguageSwitcher, TextInput, TextIssues } from '../../Languages';
import { ImagesPanel } from '../../Pictures';
import { Button } from '@/components/ui/button';
import { Row, Section, selectClass } from '@/components/designer/form';
import { fileOf, screenOf } from '../../store/editor.ts';
import { useActions, useEditor } from '../../store/react.tsx';

export function ScreenSettings() {
    const file = useEditor(fileOf);
    const screen = useEditor(screenOf);
    const { edit } = useActions();
    const first = screen.name === firstScreenOf(file);
    return (
        <Section title="Screen" data-screen-props=""
            actions={<>
                <Button variant="ghost" size="icon-xs" disabled={first} data-make-first="" title={first ? 'The first screen' : 'Make this the first screen'}
                    onClick={() => edit({ type: 'setFirstScreen', screen: screen.name })}><Home /></Button>
                <Button variant="ghost" size="icon-xs" data-duplicate-screen="" title="Duplicate"
                    onClick={() => edit({ type: 'duplicateScreen', screen: screen.name })}><Copy /></Button>
                <Button variant="ghost" size="icon-xs" data-delete-screen="" disabled={file.screens.length < 2} title="Delete"
                    onClick={() => edit({ type: 'deleteScreen', screen: screen.name })}><Trash2 /></Button>
            </>}>
            <div data-screen-name=""><Row label="Name">
                <CommitInput value={screen.name} onCommit={(name) => edit({ type: 'renameScreen', screen: screen.name, name })} />
            </Row></div>
            <Row label="Title">
                <TextInput value={screen.title} onCommit={(value, language) => edit({ type: 'setText', screen: screen.name, language, value })} />
            </Row>
        </Section>
    );
}

export function FileSettings() {
    const file = useEditor(fileOf);
    const { edit } = useActions();
    return (
        <>
            <Section title="Screen file" data-file-settings="">
                <Row label="Theme">
                    <select className={selectClass} data-theme="" value={themeOf(file)} onChange={(e) => edit({ type: 'setTheme', theme: e.target.value })}>
                        {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                </Row>
            </Section>
            <LanguageSwitcher />
            <ImagesPanel />
            <TextIssues />
        </>
    );
}
