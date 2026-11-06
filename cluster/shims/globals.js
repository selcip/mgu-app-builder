// Node globals the vendored engine names, injected by esbuild in the Designer's bundle (designer/vite.config.ts,
// virtual:cluster-engine). Not used by Node's tests, which have them.
export { Buffer } from 'buffer';

export const process = { env: {}, platform: 'browser', versions: {} };
