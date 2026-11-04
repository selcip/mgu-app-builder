import type { Meta, StoryObj } from '@storybook/react-vite';
import { deadLinks, empty, textIssues, typical } from '../../fixtures/screen-files.ts';
import { FocusOrder, Interaction, NavigationPanel } from './Prototype';
import type { EditorState } from '../../store/editor.ts';

const meta: Meta<typeof NavigationPanel> = {
    title: 'Panels/Prototype/Navigation',
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

/** The selected element's action and link, linking to a deleted screen: the dead end is flagged. */
export const InteractionDeadLink: StoryObj<typeof Interaction> = {
    render: () => <div className="w-80 rounded-lg border bg-card"><Interaction /></div>,
    parameters: { screenFile: deadLinks, editor: (s: EditorState) => s.goTo('home', 'toAbout') },
};

/** A custom focus order, with an element left out. */
export const CustomFocusOrder: StoryObj<typeof FocusOrder> = {
    render: () => <div className="w-80 rounded-lg border bg-card"><FocusOrder /></div>,
    parameters: {
        screenFile: textIssues,
        editor: (s: EditorState) => { s.edit({ type: 'excludeFromFocus', screen: 'home', element: 'toSettings' }); },
    },
};
