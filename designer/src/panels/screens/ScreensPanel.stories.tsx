import type { Meta, StoryObj } from '@storybook/react-vite';
import { deadLinks, empty, typical } from '../../fixtures/screen-files.ts';
import type { EditorState } from '../../store/editor.ts';
import { ElementList, ScreenList } from './ScreensPanel';

/** The left panel's lists, at the docked panel's width. */
function LeftPanel() {
    return (
        <div className="w-60 rounded-lg border bg-card">
            <ScreenList />
            <ElementList />
        </div>
    );
}

const meta: Meta<typeof LeftPanel> = { title: 'Panels/Screens and elements', component: LeftPanel };
export default meta;
type Story = StoryObj<typeof LeftPanel>;

/** A new design: one screen, no elements. */
export const Empty: Story = { parameters: { screenFile: empty } };

/** Three screens, home first; two elements of home selected. */
export const Typical: Story = {
    parameters: { screenFile: typical, editor: (s: EditorState) => s.select(['toSettings', 'logo']) },
};

/** Screens whose links lead to a deleted screen are marked. */
export const DeadLinks: Story = { parameters: { screenFile: deadLinks, editor: (s: EditorState) => s.selectScreen('settings') } };
