import type { Meta, StoryObj } from '@storybook/react-vite';
import { empty, missingImages, textIssues, typical } from '../../fixtures/screen-files.ts';
import type { EditorState } from '../../store/editor.ts';
import { Inspector } from './Inspector';

/** The inspector at the docked panel's width. */
function RightPanel() {
    return <div className="w-80 rounded-lg border bg-card"><Inspector /></div>;
}

const meta: Meta<typeof RightPanel> = { title: 'Panels/Inspector', component: RightPanel };
export default meta;
type Story = StoryObj<typeof RightPanel>;

/** Nothing selected in a new design: the screen and the screen file's settings. */
export const NewDesign: Story = { parameters: { screenFile: empty } };

/** One button selected: its box, aligning, and its options. */
export const OneElement: Story = { parameters: { screenFile: typical, editor: (s: EditorState) => s.selectOnly('toAbout') } };

/** A picture selected: its picture option, with the design's images to pick from. */
export const Picture: Story = { parameters: { screenFile: typical, editor: (s: EditorState) => s.selectOnly('logo') } };

/** Three selected: aligning and distributing, no box. */
export const SeveralElements: Story = {
    parameters: { screenFile: typical, editor: (s: EditorState) => s.select(['heading', 'toSettings', 'toAbout']) },
};

/** Nothing selected, with pictures the design lacks and one it doesn't use. */
export const MissingImages: Story = { parameters: { screenFile: missingImages } };

/** Nothing selected, in German: missing translations and characters the head unit can't draw. */
export const TextIssues: Story = { parameters: { screenFile: textIssues, editor: (s: EditorState) => s.pick('de') } };

/** A button selected in German: its text is missing there and shows the default language's. */
export const MissingTranslation: Story = {
    parameters: { screenFile: textIssues, editor: (s: EditorState) => { s.pick('de'); s.selectOnly('toAbout'); } },
};

/** The Prototype tab with a linked button selected: its action, the screen it opens, focus order, navigation. */
export const PrototypeTab: Story = {
    parameters: { screenFile: typical, editor: (s: EditorState) => { s.setInspectorTab('prototype'); s.selectOnly('toSettings'); } },
};
