// Storybook for the Designer's panels. The Vite builder loads designer/vite.config.ts, so stories resolve '@/…',
// Tailwind and virtual:mgu-runtime exactly as the Designer does.
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    framework: { name: '@storybook/react-vite', options: {} },
    core: { disableTelemetry: true },
};

export default config;
