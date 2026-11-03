import type { Meta, StoryObj } from '@storybook/react-vite';
import { deadLinks, empty, typical } from './fixtures/screen-files.ts';
import { NavigationPanel } from './Navigation';
import type { EditorState } from './store/editor.ts';

const meta: Meta<typeof NavigationPanel> = {
    title: 'Panels/Navigation',
    component: NavigationPanel,
};
export default meta;

type Story = StoryObj<typeof NavigationPanel>;

/** No links yet: the panel says how to make one. */
export const NoLinks: Story = { parameters: { screenFile: empty } };

/** Every screen's links, and the screens that open the selected one. */
export const Typical: Story = { parameters: { screenFile: typical, editor: (s: EditorState) => s.selectScreen('settings') } };

/** Links to a screen that was deleted, flagged and counted. */
export const DeadLinks: Story = { parameters: { screenFile: deadLinks } };
