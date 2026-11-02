// Node globals the vendored kit uses, injected by esbuild where it names them (see vite.config.ts).
export { Buffer } from 'buffer';

export function setImmediate(fn, ...args) {
    return setTimeout(() => fn(...args), 0);
}
